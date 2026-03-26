import { afterEach, describe, expect, test, vi } from "vitest";

import { HostawayClient } from "../../src/hostaway/client.js";

describe("HostawayClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("unwraps standard result envelopes and sends bearer auth with query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          result: [{ id: 501 }]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostawayClient({ apiToken: "secret-token" });
    const result = await client.listReservations({
      limit: 5,
      match: "Jane Smith",
      hasUnreadConversationMessages: 1
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(requestInit.headers);

    expect(requestUrl).toBe(
      "https://api.hostaway.com/v1/reservations?limit=5&match=Jane+Smith&hasUnreadConversationMessages=1"
    );
    expect(headers.get("Authorization")).toBe("Bearer secret-token");
    expect(result).toEqual([{ id: 501 }]);
  });

  test("throws AUTH_EXPIRED on 401 responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "fail" }), {
          status: 401,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const client = new HostawayClient({ apiToken: "expired-token" });

    await expect(client.getConversation(201)).rejects.toThrow("AUTH_EXPIRED");
  });

  test("throws RATE_LIMITED on 429 responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "fail" }), {
          status: 429,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const client = new HostawayClient({ apiToken: "slow-down" });

    await expect(client.listConversations({ limit: 10 })).rejects.toThrow("RATE_LIMITED");
  });

  test("throws a parse error on malformed JSON payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{this-is-not-json", {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const client = new HostawayClient({ apiToken: "secret-token" });

    await expect(client.getListing(135880)).rejects.toThrow("JSON parse error");
  });
});
