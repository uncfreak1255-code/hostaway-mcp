/// <reference types="@cloudflare/workers-types" />

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { HostawayClient } from "./hostaway/client.js";
import { registerDistributionTools } from "./distribution/tools/index.js";

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

  registerDistributionTools(server, client);

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
      const message = err instanceof Error ? err.message : "Internal server error";
      return errorResponse(message, 500);
    }
  },

  async scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext): Promise<void> {
    // Phase 3: KV pre-warm — fetch listings + calendar, write to PROPERTY_CACHE
  },
};
