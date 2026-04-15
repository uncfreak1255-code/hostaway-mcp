import { afterEach, describe, expect, test } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import type { HostawayDataClient } from "../../src/hostaway/client.js";
import type { HostawayCalendarDay } from "../../src/hostaway/types.js";
import { registerGetRatesTool } from "../../src/distribution/tools/get-rates.js";

function makeCalendarDay(overrides: Partial<HostawayCalendarDay> & { date: string }): HostawayCalendarDay {
  return {
    id: 1,
    isAvailable: 1,
    status: "available",
    price: 200,
    minimumStay: 2,
    maximumStay: 30,
    closedOnArrival: 0,
    closedOnDeparture: 0,
    note: null,
    countAvailableUnits: 1,
    availableUnitsToSell: 1,
    ...overrides,
  };
}

function makeFakeClient(calendar: HostawayCalendarDay[]): HostawayDataClient {
  return {
    listConversations: async () => [],
    getConversation: async () => { throw new Error("not implemented"); },
    getConversationMessages: async () => [],
    listReservations: async () => [],
    getReservation: async () => { throw new Error("not implemented"); },
    listListings: async () => [],
    getListing: async () => { throw new Error("not implemented"); },
    getCalendar: async () => calendar,
  };
}

describe("get_rates", () => {
  let client: Client;
  let transport: InMemoryTransport;

  async function connect(fakeClient: HostawayDataClient) {
    const server = new McpServer({ name: "test-rates", version: "0.0.1" });
    registerGetRatesTool(server, fakeClient);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "1.0.0" });
    transport = clientTransport;
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  }

  afterEach(async () => {
    if (transport) await transport.close();
  });

  test("returns per-night breakdown", async () => {
    const calendar = [
      makeCalendarDay({ date: "2026-06-01", price: 250 }),
      makeCalendarDay({ date: "2026-06-02", price: 300 }),
      makeCalendarDay({ date: "2026-06-03", price: 275 }),
    ];

    await connect(makeFakeClient(calendar));

    const result = await client.callTool({
      name: "get_rates",
      arguments: { listing_id: 206016, checkin: "2026-06-01", checkout: "2026-06-04" },
    });

    const content = result.structuredContent as {
      rates: Array<{ date: string; price: number; available: boolean; minimum_stay: number }>;
    };
    expect(content.rates).toHaveLength(3);
    expect(content.rates[0]).toMatchObject({ date: "2026-06-01", price: 250, available: true });
    expect(content.rates[1]).toMatchObject({ date: "2026-06-02", price: 300, available: true });
    expect(content.rates[2]).toMatchObject({ date: "2026-06-03", price: 275, available: true });
  });

  test("computes correct summary (total, avg, min, max)", async () => {
    const calendar = [
      makeCalendarDay({ date: "2026-06-01", price: 100 }),
      makeCalendarDay({ date: "2026-06-02", price: 200 }),
      makeCalendarDay({ date: "2026-06-03", price: 300 }),
    ];

    await connect(makeFakeClient(calendar));

    const result = await client.callTool({
      name: "get_rates",
      arguments: { listing_id: 206016, checkin: "2026-06-01", checkout: "2026-06-04" },
    });

    const content = result.structuredContent as {
      summary: { total_price: number; avg_nightly_rate: number; min_night: number; max_night: number };
    };
    expect(content.summary.total_price).toBe(600);
    expect(content.summary.avg_nightly_rate).toBe(200);
    expect(content.summary.min_night).toBe(100);
    expect(content.summary.max_night).toBe(300);
  });

  test("rejects invalid date format", async () => {
    await connect(makeFakeClient([]));

    const result = await client.callTool({
      name: "get_rates",
      arguments: { listing_id: 206016, checkin: "not-a-date", checkout: "2026-06-04" },
    });

    const content = result.structuredContent as { error: string };
    expect(content.error).toMatch(/invalid.*date/i);
  });

  test("rejects non-existent date like Feb 30", async () => {
    await connect(makeFakeClient([]));

    const result = await client.callTool({
      name: "get_rates",
      arguments: { listing_id: 206016, checkin: "2026-02-30", checkout: "2026-03-02" },
    });

    const content = result.structuredContent as { error: string };
    expect(content.error).toMatch(/invalid.*date/i);
  });

  test("handles unavailable nights correctly", async () => {
    const calendar = [
      makeCalendarDay({ date: "2026-06-01", price: 200, isAvailable: 1 }),
      makeCalendarDay({ date: "2026-06-02", price: 200, isAvailable: 0 }),
    ];

    await connect(makeFakeClient(calendar));

    const result = await client.callTool({
      name: "get_rates",
      arguments: { listing_id: 206016, checkin: "2026-06-01", checkout: "2026-06-03" },
    });

    const content = result.structuredContent as {
      rates: Array<{ date: string; available: boolean }>;
      all_available: boolean;
    };
    expect(content.rates[0]!.available).toBe(true);
    expect(content.rates[1]!.available).toBe(false);
    expect(content.all_available).toBe(false);
  });
});
