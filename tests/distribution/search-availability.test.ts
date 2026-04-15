import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import type { HostawayDataClient } from "../../src/hostaway/client.js";
import type { HostawayCalendarDay } from "../../src/hostaway/types.js";
import { registerSearchAvailabilityTool } from "../../src/distribution/tools/search-availability.js";

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

function makeFakeClient(calendarByListing: Record<number, HostawayCalendarDay[]>): HostawayDataClient {
  return {
    listConversations: async () => [],
    getConversation: async () => { throw new Error("not implemented"); },
    getConversationMessages: async () => [],
    listReservations: async () => [],
    getReservation: async () => { throw new Error("not implemented"); },
    listListings: async () => [],
    getListing: async () => { throw new Error("not implemented"); },
    getCalendar: async (listingId: number) => {
      const data = calendarByListing[listingId];
      if (data === undefined) throw new Error(`No calendar for ${listingId}`);
      return data;
    },
  };
}

describe("search_availability", () => {
  let client: Client;
  let transport: InMemoryTransport;

  function setup(fakeClient: HostawayDataClient) {
    const server = new McpServer({ name: "test-distribution", version: "0.0.1" });
    registerSearchAvailabilityTool(server, fakeClient);
    return server;
  }

  async function connect(fakeClient: HostawayDataClient) {
    const server = setup(fakeClient);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "1.0.0" });
    transport = clientTransport;
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  }

  afterEach(async () => {
    if (transport) await transport.close();
  });

  test("returns available properties for valid date range", async () => {
    // All 5 properties available
    const days = [
      makeCalendarDay({ date: "2026-06-01", price: 250 }),
      makeCalendarDay({ date: "2026-06-02", price: 300 }),
    ];
    const calendarByListing: Record<number, HostawayCalendarDay[]> = {
      206016: days,
      135880: days,
      135881: days,
      189511: days,
      487798: days,
    };

    await connect(makeFakeClient(calendarByListing));

    const result = await client.callTool({
      name: "search_availability",
      arguments: { checkin: "2026-06-01", checkout: "2026-06-03", guests: 2 },
    });

    const content = result.structuredContent as {
      results: Array<{ listing_id: number; available: boolean; total_price: number }>;
    };
    const available = content.results.filter((r) => r.available);
    expect(available).toHaveLength(5);
    expect(available[0]!.total_price).toBe(550);
  });

  test("filters out unavailable properties", async () => {
    const available = [
      makeCalendarDay({ date: "2026-06-01", price: 200 }),
      makeCalendarDay({ date: "2026-06-02", price: 200 }),
    ];
    const unavailable = [
      makeCalendarDay({ date: "2026-06-01", price: 200, isAvailable: 0 }),
      makeCalendarDay({ date: "2026-06-02", price: 200 }),
    ];

    const calendarByListing: Record<number, HostawayCalendarDay[]> = {
      206016: available,
      135880: unavailable,
      135881: available,
      189511: unavailable,
      487798: available,
    };

    await connect(makeFakeClient(calendarByListing));

    const result = await client.callTool({
      name: "search_availability",
      arguments: { checkin: "2026-06-01", checkout: "2026-06-03", guests: 2 },
    });

    const content = result.structuredContent as {
      results: Array<{ listing_id: number; available: boolean }>;
    };
    const availableResults = content.results.filter((r) => r.available);
    const unavailableResults = content.results.filter((r) => !r.available);
    expect(availableResults).toHaveLength(3);
    expect(unavailableResults).toHaveLength(2);
  });

  test("filters by pets when pets=true", async () => {
    // Pet-friendly listings: 135880, 135881
    const days = [
      makeCalendarDay({ date: "2026-06-01", price: 200 }),
      makeCalendarDay({ date: "2026-06-02", price: 200 }),
    ];
    const calendarByListing: Record<number, HostawayCalendarDay[]> = {
      135880: days,
      135881: days,
    };

    await connect(makeFakeClient(calendarByListing));

    const result = await client.callTool({
      name: "search_availability",
      arguments: { checkin: "2026-06-01", checkout: "2026-06-03", guests: 2, pets: true },
    });

    const content = result.structuredContent as {
      results: Array<{ listing_id: number; available: boolean }>;
    };
    // Should only check 135880 and 135881 (the pet-friendly ones)
    expect(content.results).toHaveLength(2);
    expect(content.results.every((r) => r.available)).toBe(true);
  });

  test("respects minimum_nights filter", async () => {
    const shortStayOk = [
      makeCalendarDay({ date: "2026-06-01", price: 200, minimumStay: 2 }),
      makeCalendarDay({ date: "2026-06-02", price: 200, minimumStay: 2 }),
    ];
    const longMinStay = [
      makeCalendarDay({ date: "2026-06-01", price: 200, minimumStay: 5 }),
      makeCalendarDay({ date: "2026-06-02", price: 200, minimumStay: 5 }),
    ];

    const calendarByListing: Record<number, HostawayCalendarDay[]> = {
      206016: shortStayOk,
      135880: longMinStay,
      135881: shortStayOk,
      189511: longMinStay,
      487798: shortStayOk,
    };

    await connect(makeFakeClient(calendarByListing));

    const result = await client.callTool({
      name: "search_availability",
      arguments: {
        checkin: "2026-06-01",
        checkout: "2026-06-03",
        guests: 2,
        minimum_nights_ok: false,
      },
    });

    const content = result.structuredContent as {
      results: Array<{ listing_id: number; available: boolean }>;
    };
    const availableResults = content.results.filter((r) => r.available);
    // 135880, 189511 have minimumStay 5 > 2 requested nights, so filtered out
    expect(availableResults).toHaveLength(3);
  });

  test("handles calendar API failure gracefully (returns available: false)", async () => {
    const days = [
      makeCalendarDay({ date: "2026-06-01", price: 200 }),
      makeCalendarDay({ date: "2026-06-02", price: 200 }),
    ];

    // Only provide data for some listings — others will throw
    const fakeClient: HostawayDataClient = {
      listConversations: async () => [],
      getConversation: async () => { throw new Error("not implemented"); },
      getConversationMessages: async () => [],
      listReservations: async () => [],
      getReservation: async () => { throw new Error("not implemented"); },
      listListings: async () => [],
      getListing: async () => { throw new Error("not implemented"); },
      getCalendar: async (listingId: number) => {
        if (listingId === 206016) return days;
        throw new Error("API unavailable");
      },
    };

    await connect(fakeClient);

    const result = await client.callTool({
      name: "search_availability",
      arguments: { checkin: "2026-06-01", checkout: "2026-06-03", guests: 2 },
    });

    const content = result.structuredContent as {
      results: Array<{ listing_id: number; available: boolean; error?: string }>;
    };
    const available = content.results.filter((r) => r.available);
    const failed = content.results.filter((r) => !r.available && r.error);
    expect(available).toHaveLength(1);
    expect(available[0]!.listing_id).toBe(206016);
    expect(failed.length).toBeGreaterThanOrEqual(1);
  });

  test("rejects invalid date format", async () => {
    await connect(makeFakeClient({}));

    const result = await client.callTool({
      name: "search_availability",
      arguments: { checkin: "foo", checkout: "2026-06-03", guests: 2 },
    });

    const content = result.structuredContent as { error: string };
    expect(content.error).toMatch(/invalid.*date/i);
  });

  test("rejects non-existent date", async () => {
    await connect(makeFakeClient({}));

    const result = await client.callTool({
      name: "search_availability",
      arguments: { checkin: "2026-02-30", checkout: "2026-03-02", guests: 2 },
    });

    const content = result.structuredContent as { error: string };
    expect(content.error).toMatch(/invalid.*date/i);
  });

  test("treats partial calendar response as unavailable", async () => {
    // Request 3 nights but API only returns 2 days
    const partialCalendar = [
      makeCalendarDay({ date: "2026-06-01", price: 200 }),
      makeCalendarDay({ date: "2026-06-02", price: 200 }),
    ];

    const calendarByListing: Record<number, HostawayCalendarDay[]> = {
      206016: partialCalendar,
      135880: partialCalendar,
      135881: partialCalendar,
      189511: partialCalendar,
      487798: partialCalendar,
    };

    await connect(makeFakeClient(calendarByListing));

    const result = await client.callTool({
      name: "search_availability",
      arguments: { checkin: "2026-06-01", checkout: "2026-06-04", guests: 2 },
    });

    const content = result.structuredContent as {
      results: Array<{ listing_id: number; available: boolean }>;
    };
    // 3 nights requested but only 2 days returned — all should be unavailable
    expect(content.results.every((r) => !r.available)).toBe(true);
  });

  test("sorts by total price ascending", async () => {
    const cheap = [
      makeCalendarDay({ date: "2026-06-01", price: 100 }),
      makeCalendarDay({ date: "2026-06-02", price: 100 }),
    ];
    const mid = [
      makeCalendarDay({ date: "2026-06-01", price: 200 }),
      makeCalendarDay({ date: "2026-06-02", price: 200 }),
    ];
    const expensive = [
      makeCalendarDay({ date: "2026-06-01", price: 500 }),
      makeCalendarDay({ date: "2026-06-02", price: 500 }),
    ];

    const calendarByListing: Record<number, HostawayCalendarDay[]> = {
      206016: expensive,
      135880: cheap,
      135881: mid,
      189511: mid,
      487798: expensive,
    };

    await connect(makeFakeClient(calendarByListing));

    const result = await client.callTool({
      name: "search_availability",
      arguments: { checkin: "2026-06-01", checkout: "2026-06-03", guests: 2 },
    });

    const content = result.structuredContent as {
      results: Array<{ listing_id: number; available: boolean; total_price: number }>;
    };
    const prices = content.results
      .filter((r): r is typeof r & { available: true; total_price: number } => r.available)
      .map((r) => r.total_price);

    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!);
    }
  });
});
