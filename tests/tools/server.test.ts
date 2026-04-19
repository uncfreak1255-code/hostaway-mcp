import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { RawHostawayConversation, RawHostawayMessage, RawHostawayReservationLike, RawHostawayListing } from "../../src/hostaway/types.js";

import conversation201 from "../../fixtures/hostaway/conversations/conversation-201-jane.json" with { type: "json" };
import conversation202 from "../../fixtures/hostaway/conversations/conversation-202-alex.json" with { type: "json" };
import conversation203 from "../../fixtures/hostaway/conversations/conversation-203-morgan.json" with { type: "json" };
import messages201 from "../../fixtures/hostaway/messages/conversation-201.json" with { type: "json" };
import messages202 from "../../fixtures/hostaway/messages/conversation-202.json" with { type: "json" };
import messages203 from "../../fixtures/hostaway/messages/conversation-203.json" with { type: "json" };
import reservation501 from "../../fixtures/hostaway/reservations/reservation-501.json" with { type: "json" };
import reservation502 from "../../fixtures/hostaway/reservations/reservation-502.json" with { type: "json" };
import reservation503 from "../../fixtures/hostaway/reservations/reservation-503-missing-fields.json" with { type: "json" };
import listing135880 from "../../fixtures/hostaway/listings/listing-135880.json" with { type: "json" };
import listing206016 from "../../fixtures/hostaway/listings/listing-206016.json" with { type: "json" };
import listing487798 from "../../fixtures/hostaway/listings/listing-487798-missing-fields.json" with { type: "json" };

import { createHostawayClientFromEnv, createHostawayMcpServer } from "../../src/server.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

class FakeHostawayClient {
  private readonly conversations: RawHostawayConversation[] = [
    conversation201 as RawHostawayConversation,
    conversation202 as RawHostawayConversation,
    conversation203 as RawHostawayConversation
  ];
  private readonly reservations: RawHostawayReservationLike[] = [
    reservation501 as RawHostawayReservationLike,
    reservation502 as RawHostawayReservationLike,
    reservation503 as RawHostawayReservationLike
  ];
  private readonly listings: RawHostawayListing[] = [
    listing135880 as RawHostawayListing,
    listing206016 as RawHostawayListing,
    listing487798 as RawHostawayListing
  ];
  private readonly messagesByConversationId = new Map<string, RawHostawayMessage[]>([
    ["201", messages201 as RawHostawayMessage[]],
    ["202", messages202 as RawHostawayMessage[]],
    ["203", messages203 as RawHostawayMessage[]]
  ]);

  async listConversations(params: {
    reservationId?: string | number;
    limit?: number;
  } = {}) {
    let items = [...this.conversations];

    if (params.reservationId != null) {
      items = items.filter((conversation) => `${conversation.reservationId ?? ""}` === `${params.reservationId}`);
    }

    return items.slice(0, params.limit ?? items.length);
  }

  async getConversation(conversationId: string | number) {
    const conversation = this.conversations.find((item) => `${item.id}` === `${conversationId}`);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    return conversation;
  }

  async getConversationMessages(conversationId: string | number, params: { limit?: number } = {}) {
    const messages = this.messagesByConversationId.get(`${conversationId}`) ?? [];
    return messages.slice(0, params.limit ?? messages.length);
  }

  async listReservations(params: {
    match?: string;
    guestEmail?: string;
    listingId?: string | number;
    arrivalStartDate?: string;
    arrivalEndDate?: string;
    departureStartDate?: string;
    departureEndDate?: string;
    limit?: number;
  } = {}) {
    let items = [...this.reservations];

    if (params.match) {
      const match = params.match.toLowerCase();
      items = items.filter((reservation) =>
        `${reservation.guestName ?? `${reservation.guestFirstName ?? ""} ${reservation.guestLastName ?? ""}`}`
          .toLowerCase()
          .includes(match)
      );
    }

    if (params.guestEmail) {
      items = items.filter((reservation) => reservation.guestEmail === params.guestEmail);
    }

    if (params.listingId != null) {
      items = items.filter((reservation) => `${reservation.listingMapId ?? reservation.listingId ?? ""}` === `${params.listingId}`);
    }

    if (params.arrivalStartDate) {
      items = items.filter((reservation) => (reservation.arrivalDate ?? "") >= params.arrivalStartDate!);
    }

    if (params.arrivalEndDate) {
      items = items.filter((reservation) => (reservation.arrivalDate ?? "") <= params.arrivalEndDate!);
    }

    if (params.departureStartDate) {
      items = items.filter((reservation) => (reservation.departureDate ?? "") >= params.departureStartDate!);
    }

    if (params.departureEndDate) {
      items = items.filter((reservation) => (reservation.departureDate ?? "") <= params.departureEndDate!);
    }

    return items.slice(0, params.limit ?? items.length);
  }

  async getReservation(reservationId: string | number) {
    const reservation = this.reservations.find((item) => `${item.id}` === `${reservationId}`);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    return reservation;
  }

  async listListings() {
    return [...this.listings];
  }

  async getListing(listingId: string | number) {
    const listing = this.listings.find((item) => `${item.id}` === `${listingId}`);
    if (!listing) {
      throw new Error(`Listing ${listingId} not found`);
    }

    return listing;
  }

  async getCalendar() {
    return [];
  }
}

describe("Hostaway MCP server", () => {
  let client: Client;
  let transport: InMemoryTransport;

  beforeEach(async () => {
    const fakeClient = new FakeHostawayClient();
    const server = createHostawayMcpServer({
      client: fakeClient,
      name: "hostaway-mcp-test",
      version: "0.1.0-test"
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({
      name: "hostaway-mcp-test-client",
      version: "1.0.0"
    });
    transport = clientTransport;

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await transport.close();
  });

  test("fails clearly when HOSTAWAY_API_TOKEN is missing", () => {
    const previous = process.env.HOSTAWAY_API_TOKEN;
    delete process.env.HOSTAWAY_API_TOKEN;

    expect(() => createHostawayClientFromEnv()).toThrow("HOSTAWAY_API_TOKEN");

    if (previous) {
      process.env.HOSTAWAY_API_TOKEN = previous;
    }
  });

  test("advertises the package version by default", async () => {
    const server = createHostawayMcpServer({
      client: new FakeHostawayClient()
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const versionClient = new Client({
      name: "hostaway-mcp-version-client",
      version: "1.0.0"
    });

    await Promise.all([server.connect(serverTransport), versionClient.connect(clientTransport)]);

    try {
      const result = await versionClient.getServerVersion();
      expect(result).toBeDefined();
      if (!result) {
        throw new Error("Expected server version response");
      }
      expect(result.version).toBe(pkg.version);
    } finally {
      await clientTransport.close();
    }
  });

  test("registers exactly the six pinned v1 tools", async () => {
    const result = await client.listTools();

    expect(result.tools.map((tool) => tool.name).sort()).toEqual([
      "get_conversation_context",
      "get_listing_brief",
      "get_reservation_brief",
      "list_unread_guest_threads",
      "search_conversations",
      "search_reservations"
    ]);
  });

  test("lists unread guest threads with raw and derived attention fields", async () => {
    const result = await client.callTool({
      name: "list_unread_guest_threads",
      arguments: {
        limit: 10
      }
    });

    expect(result.structuredContent).toMatchObject({
      total: 3,
      threads: [
        {
          conversationId: "203",
          guestName: "Morgan Lee",
          listingId: "487798",
          listingName: "Bradenton Pool Home",
          rawHasUnreadMessages: false,
          needsAttention: true
        },
        {
          conversationId: "201",
          guestName: "Jane Smith",
          listingId: "135880",
          listingName: "River House",
          rawHasUnreadMessages: true,
          needsAttention: true
        },
        {
          conversationId: "202",
          guestName: "Alex Rivera",
          listingId: "206016",
          listingName: "Dockside Dreams",
          rawHasUnreadMessages: true,
          needsAttention: false
        }
      ]
    });
  });

  test("returns conversation context with chronological recent messages", async () => {
    const result = await client.callTool({
      name: "get_conversation_context",
      arguments: {
        conversationId: 201
      }
    });

    expect(result.structuredContent).toMatchObject({
      conversationId: "201",
      reservationId: "501",
      listingId: "135880",
      latestSpeaker: "guest",
      attention: {
        needsAttention: true
      }
    });
    expect((result.structuredContent as { recentMessages: unknown[] }).recentMessages).toHaveLength(2);
  });

  test("returns reservation briefs keyed by reservation id", async () => {
    const result = await client.callTool({
      name: "get_reservation_brief",
      arguments: {
        reservationId: 501
      }
    });

    expect(result.structuredContent).toMatchObject({
      reservationId: "501",
      listingId: "135880",
      listingName: "River House",
      guestName: "Jane Smith",
      channel: "Airbnb"
    });
  });

  test("returns listing briefs keyed by listing id", async () => {
    const result = await client.callTool({
      name: "get_listing_brief",
      arguments: {
        listingId: 135880
      }
    });

    expect(result.structuredContent).toMatchObject({
      listingId: "135880",
      listingName: "River House",
      city: "Anna Maria",
      personCapacity: 6
    });
  });

  test("searches reservations by guest and listing filters", async () => {
    const result = await client.callTool({
      name: "search_reservations",
      arguments: {
        guestName: "Jane",
        listingId: 135880
      }
    });

    expect(result.structuredContent).toMatchObject({
      total: 1,
      results: [
        {
          reservationId: "501",
          listingId: "135880",
          guestName: "Jane Smith"
        }
      ]
    });
  });

  test("searches conversations by guest, listing, and reservation filters", async () => {
    const result = await client.callTool({
      name: "search_conversations",
      arguments: {
        guestName: "Morgan",
        listingId: 487798
      }
    });

    expect(result.structuredContent).toMatchObject({
      total: 1,
      results: [
        {
          conversationId: "203",
          listingId: "487798",
          guestName: "Morgan Lee"
        }
      ]
    });
  });
});
