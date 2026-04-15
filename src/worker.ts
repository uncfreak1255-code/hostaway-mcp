/// <reference types="@cloudflare/workers-types" />

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { HostawayClient } from "./hostaway/client.js";
import { registerDistributionTools } from "./distribution/tools/index.js";
import { putCachedListing, putCachedCalendar } from "./distribution/cache.js";
import { SEASCAPE_LISTING_IDS } from "./distribution/tools/properties.js";

/**
 * Cloudflare Workers entry point for the hostaway-mcp distribution layer.
 *
 * Routes:
 *   POST /mcp    — MCP Streamable HTTP transport (stateless)
 *   GET  /mcp    — MCP SSE stream (Streamable HTTP)
 *   DELETE /mcp  — MCP session close
 *   GET  /health — health check
 *   *            — 404
 */

interface Env {
  HOSTAWAY_API_TOKEN: string;
  PROPERTY_CACHE: KVNamespace;
  ENVIRONMENT: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

async function handleMcpRequest(request: Request, env: Env): Promise<Response> {
  const client = new HostawayClient({ apiToken: env.HOSTAWAY_API_TOKEN });
  const server = new McpServer({
    name: "seascape-distribution",
    version: "1.0.0",
  });

  registerDistributionTools(server, client, env.PROPERTY_CACHE);

  // Stateless transport — each request is self-contained (no session tracking)
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  await server.connect(transport);

  const response = await transport.handleRequest(request);

  // Append CORS headers to the MCP transport response
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);

  if (url.pathname === "/health" && request.method === "GET") {
    return jsonResponse({
      status: "ok",
      environment: env.ENVIRONMENT,
      timestamp: new Date().toISOString(),
    });
  }

  if (url.pathname === "/mcp") {
    return handleMcpRequest(request, env);
  }

  return errorResponse("Not found", 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      console.error("[WORKER]", err);
      return errorResponse("Internal server error", 500);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const client = new HostawayClient({ apiToken: env.HOSTAWAY_API_TOKEN });
    const kv = env.PROPERTY_CACHE;

    const today = new Date();
    const startDate = today.toISOString().slice(0, 10);
    const endDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    let success = 0;
    let failed = 0;

    const tasks = SEASCAPE_LISTING_IDS.map(async (listingId) => {
      try {
        const [listing, calendar] = await Promise.all([
          client.getListing(listingId),
          client.getCalendar(listingId, startDate, endDate),
        ]);

        await Promise.all([
          putCachedListing(kv, listingId, listing),
          putCachedCalendar(kv, listingId, calendar),
        ]);

        success++;
      } catch (err) {
        failed++;
        console.error(
          `[PREWARM] Failed for listing ${listingId}:`,
          err instanceof Error ? err.message : err
        );
      }
    });

    ctx.waitUntil(
      Promise.all(tasks).then(() => {
        console.log(
          `[PREWARM] Complete: ${success} succeeded, ${failed} failed`
        );
      })
    );
  },
};
