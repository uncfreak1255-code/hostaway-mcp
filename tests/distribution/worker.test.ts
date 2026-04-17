import { describe, expect, test } from "vitest";

/**
 * Tests for the worker's fetch handler routing, auth, and error handling.
 *
 * We import the default export from worker.ts and call fetch() directly
 * with a minimal Env stub. The MCP transport requires full SDK wiring
 * so we only test routing/auth/error paths, not MCP tool dispatch.
 */

// The worker exports { fetch, scheduled }. We test fetch.
import workerModule from "../../src/worker.js";

function makeEnv(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    HOSTAWAY_API_TOKEN: "test-token",
    MCP_AUTH_TOKEN: "secret-bearer-token",
    ENVIRONMENT: "test",
    PROPERTY_CACHE: {} as KVNamespace,
    ...overrides,
  };
}

describe("worker routing", () => {
  test("GET /health returns 200 without auth", async () => {
    const req = new Request("https://example.com/health", { method: "GET" });
    const res = await workerModule.fetch(req, makeEnv() as any);

    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("ok");
  });

  test("unknown path returns 404", async () => {
    const req = new Request("https://example.com/unknown", { method: "GET" });
    const res = await workerModule.fetch(req, makeEnv() as any);

    expect(res.status).toBe(404);
  });

  test("OPTIONS returns 204 with CORS headers", async () => {
    const req = new Request("https://example.com/mcp", { method: "OPTIONS" });
    const res = await workerModule.fetch(req, makeEnv() as any);

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

describe("worker auth", () => {
  test("POST /mcp without auth returns 401", async () => {
    const req = new Request("https://example.com/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await workerModule.fetch(req, makeEnv() as any);

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/unauthorized/i);
  });

  test("POST /mcp with wrong token returns 401", async () => {
    const req = new Request("https://example.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong-token",
      },
      body: "{}",
    });
    const res = await workerModule.fetch(req, makeEnv() as any);

    expect(res.status).toBe(401);
  });

  test("GET /mcp without auth returns 401", async () => {
    const req = new Request("https://example.com/mcp", { method: "GET" });
    const res = await workerModule.fetch(req, makeEnv() as any);

    expect(res.status).toBe(401);
  });

  test("DELETE /mcp without auth returns 401", async () => {
    const req = new Request("https://example.com/mcp", { method: "DELETE" });
    const res = await workerModule.fetch(req, makeEnv() as any);

    expect(res.status).toBe(401);
  });
});

describe("worker error handling", () => {
  test("500 response never leaks internal error message", async () => {
    // Force an error by passing no HOSTAWAY_API_TOKEN with a valid auth token
    // The MCP handler will fail when trying to use the client
    const req = new Request("https://example.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret-bearer-token",
        "MCP-Protocol-Version": "2025-03-26",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } },
        id: 1,
      }),
    });

    const env = makeEnv({ HOSTAWAY_API_TOKEN: "" });
    const res = await workerModule.fetch(req, env as any);

    // If it errors, should be "Internal server error", not raw error
    if (res.status === 500) {
      const body = await res.json() as { error: string };
      expect(body.error).toBe("Internal server error");
    }
    // If it doesn't error (MCP SDK handles it gracefully), that's fine too
  });
});
