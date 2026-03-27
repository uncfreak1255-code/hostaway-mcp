import { afterEach, describe, expect, test, vi } from "vitest";

import { HostawayClient } from "../../src/hostaway/client.js";

describe("HostawayClient write methods", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("updateConversation sends PUT with JSON body and bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          result: { id: 201 }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostawayClient({ apiToken: "secret-token" });
    await client.updateConversation(201, { isRead: 1 });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("https://api.hostaway.com/v1/conversations/201");
    expect(requestInit.method).toBe("PUT");
    expect(requestInit.body).toBe(JSON.stringify({ isRead: 1 }));

    const headers = new Headers(requestInit.headers);
    expect(headers.get("Authorization")).toBe("Bearer secret-token");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  test("updateReservation sends PUT with JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          result: { id: 501 }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostawayClient({ apiToken: "secret-token" });
    await client.updateReservation(501, { notes: "Guest note" });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("https://api.hostaway.com/v1/reservations/501");
    expect(requestInit.method).toBe("PUT");
    expect(requestInit.body).toBe(JSON.stringify({ notes: "Guest note" }));
  });

  test("sendMessage sends POST with JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          result: { id: 999 }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostawayClient({ apiToken: "secret-token" });
    await client.sendMessage(201, { body: "Hello guest" });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("https://api.hostaway.com/v1/conversations/201/messages");
    expect(requestInit.method).toBe("POST");
    expect(requestInit.body).toBe(JSON.stringify({ body: "Hello guest" }));
  });

  test("write methods throw AUTH_EXPIRED on 401", async () => {
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
    await expect(client.updateConversation(201, { isRead: 1 })).rejects.toThrow("AUTH_EXPIRED");
  });

  test("write methods throw AUTH_EXPIRED on 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "fail" }), {
          status: 403,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const client = new HostawayClient({ apiToken: "bad-token" });
    await expect(client.sendMessage(201, { body: "test" })).rejects.toThrow("AUTH_EXPIRED");
  });

  test("write methods throw RATE_LIMITED on 429", async () => {
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
    await expect(client.updateReservation(501, { notes: "test" })).rejects.toThrow("RATE_LIMITED");
  });

  test("write methods throw on 500 server error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Internal Server Error" }), {
          status: 500,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const client = new HostawayClient({ apiToken: "secret-token" });
    await expect(client.sendMessage(201, { body: "test" })).rejects.toThrow("Hostaway request failed (500)");
  });

  test("write methods throw on 400 bad request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "fail", message: "Invalid field" }), {
          status: 400,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const client = new HostawayClient({ apiToken: "secret-token" });
    await expect(client.updateReservation(501, { bad: "data" })).rejects.toThrow("Hostaway request failed (400)");
  });

  test("write methods throw on 404 not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "fail", message: "Not found" }), {
          status: 404,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const client = new HostawayClient({ apiToken: "secret-token" });
    await expect(client.updateConversation(999, { isRead: 1 })).rejects.toThrow("Hostaway request failed (404)");
  });

  test("write methods handle Hostaway API-level fail status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ status: "fail", message: "Conversation not found" }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        )
      )
    );

    const client = new HostawayClient({ apiToken: "secret-token" });
    await expect(client.updateConversation(999, { isRead: 1 })).rejects.toThrow("Hostaway API error: Conversation not found");
  });

  test("respects custom baseUrl for write methods", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: "success", result: {} }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new HostawayClient({ apiToken: "token", baseUrl: "https://custom.api.com" });
    await client.sendMessage(201, { body: "test" });

    const [requestUrl] = fetchMock.mock.calls[0] as [string];
    expect(requestUrl).toBe("https://custom.api.com/v1/conversations/201/messages");
  });
});
