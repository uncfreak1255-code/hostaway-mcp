import { afterEach, describe, expect, test } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import type { HostawayDataClient } from "../../src/hostaway/client.js";
import type { RawHostawayListing } from "../../src/hostaway/types.js";
import { registerGetPropertyDetailsTool } from "../../src/distribution/tools/get-property-details.js";

function makeFakeListing(overrides: Partial<RawHostawayListing> = {}): RawHostawayListing {
  return {
    id: 206016,
    name: "Palma Sola Paradise",
    city: "Bradenton",
    state: "FL",
    address: "123 Test St",
    personCapacity: 12,
    bedroomsNumber: 4,
    guestBathroomsNumber: 3,
    description: "A lovely property",
    amenities: ["wifi", "pool"],
    ...overrides,
  };
}

function makeFakeClient(listing: RawHostawayListing): HostawayDataClient {
  return {
    listConversations: async () => [],
    getConversation: async () => { throw new Error("not implemented"); },
    getConversationMessages: async () => [],
    listReservations: async () => [],
    getReservation: async () => { throw new Error("not implemented"); },
    listListings: async () => [],
    getListing: async () => listing,
    getCalendar: async () => [],
  };
}

describe("get_property_details", () => {
  let client: Client;
  let transport: InMemoryTransport;

  async function connect(fakeClient: HostawayDataClient) {
    const server = new McpServer({ name: "test-details", version: "0.0.1" });
    registerGetPropertyDetailsTool(server, fakeClient);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "1.0.0" });
    transport = clientTransport;
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  }

  afterEach(async () => {
    if (transport) await transport.close();
  });

  test("returns property details for valid listing", async () => {
    const listing = makeFakeListing();
    await connect(makeFakeClient(listing));

    const result = await client.callTool({
      name: "get_property_details",
      arguments: { listing_id: 206016 },
    });

    const content = result.structuredContent as {
      listing_id: number;
      name: string;
      location: { city: string; state: string };
      capacity: { max_guests: number; bedrooms: number };
      pet_policy: { pet_friendly: boolean };
      pool: { has_pool: boolean; heated: boolean };
    };
    expect(content.listing_id).toBe(206016);
    expect(content.name).toBe("Palma Sola Paradise");
    expect(content.location.city).toBe("Bradenton");
    expect(content.capacity.max_guests).toBe(12);
    expect(content.pet_policy.pet_friendly).toBe(false);
    expect(content.pool.has_pool).toBe(true);
    expect(content.pool.heated).toBe(true);
  });

  test("returns error for unknown listing_id", async () => {
    await connect(makeFakeClient(makeFakeListing()));

    const result = await client.callTool({
      name: "get_property_details",
      arguments: { listing_id: 999999 },
    });

    const content = result.structuredContent as { error: string };
    expect(content.error).toMatch(/property not found/i);
  });

  test("handles client error gracefully", async () => {
    const failClient: HostawayDataClient = {
      listConversations: async () => [],
      getConversation: async () => { throw new Error("not implemented"); },
      getConversationMessages: async () => [],
      listReservations: async () => [],
      getReservation: async () => { throw new Error("not implemented"); },
      listListings: async () => [],
      getListing: async () => { throw new Error("API timeout"); },
      getCalendar: async () => [],
    };

    await connect(failClient);

    const result = await client.callTool({
      name: "get_property_details",
      arguments: { listing_id: 206016 },
    });

    const content = result.structuredContent as { error: string };
    expect(content.error).toMatch(/could not fetch/i);
  });
});
