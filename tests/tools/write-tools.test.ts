import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import type {
  RawHostawayConversation,
  RawHostawayMessage,
  RawHostawayReservationLike,
  RawHostawayListing
} from "../../src/hostaway/types.js";
import type { HostawayWriteResult } from "../../src/hostaway/client.js";

import conversation201 from "../../fixtures/hostaway/conversations/conversation-201-jane.json" with { type: "json" };
import messages201 from "../../fixtures/hostaway/messages/conversation-201.json" with { type: "json" };
import reservation501 from "../../fixtures/hostaway/reservations/reservation-501.json" with { type: "json" };
import listing135880 from "../../fixtures/hostaway/listings/listing-135880.json" with { type: "json" };

import { createHostawayMcpServer } from "../../src/server.js";
import { NoopAuditLogger } from "../../src/write-infra/audit-logger.js";
import { WriteRateLimiter } from "../../src/write-infra/rate-limiter.js";

class FakeWriteClient {
  updateConversationCalls: Array<{ conversationId: string | number; body: Record<string, unknown> }> = [];
  updateReservationCalls: Array<{ reservationId: string | number; body: Record<string, unknown> }> = [];
  sendMessageCalls: Array<{ conversationId: string | number; body: Record<string, unknown> }> = [];

  nextError: Error | null = null;
  nextReservationReadError: Error | null = null;
  reservationHostNotes: Record<string, string> = {};

  async listConversations() {
    return [conversation201 as RawHostawayConversation];
  }

  async getConversation(conversationId: string | number) {
    if (`${conversationId}` === "201") {
      return conversation201 as RawHostawayConversation;
    }
    throw new Error(`Conversation ${conversationId} not found`);
  }

  async getConversationMessages(conversationId: string | number) {
    if (`${conversationId}` === "201") {
      return messages201 as RawHostawayMessage[];
    }
    return [];
  }

  async listReservations() {
    return [reservation501 as RawHostawayReservationLike];
  }

  async getReservation(reservationId: string | number) {
    if (this.nextReservationReadError) {
      const err = this.nextReservationReadError;
      this.nextReservationReadError = null;
      throw err;
    }

    if (`${reservationId}` === "501") {
      const base = reservation501 as RawHostawayReservationLike;
      const hostNote = this.reservationHostNotes["501"];
      if (hostNote !== undefined) {
        return { ...base, hostNote } as unknown as RawHostawayReservationLike;
      }
      return base;
    }
    throw new Error(`Reservation ${reservationId} not found`);
  }

  async listListings() {
    return [listing135880 as RawHostawayListing];
  }

  async getListing(listingId: string | number) {
    if (`${listingId}` === "135880") {
      return listing135880 as RawHostawayListing;
    }
    throw new Error(`Listing ${listingId} not found`);
  }

  async getCalendar() {
    return [];
  }

  async updateConversation(conversationId: string | number, body: Record<string, unknown>): Promise<HostawayWriteResult> {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    this.updateConversationCalls.push({ conversationId, body });
    return { status: "success", result: { id: conversationId } };
  }

  async updateReservation(reservationId: string | number, body: Record<string, unknown>): Promise<HostawayWriteResult> {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    this.updateReservationCalls.push({ reservationId, body });
    return { status: "success", result: { id: reservationId } };
  }

  async sendMessage(conversationId: string | number, body: Record<string, unknown>): Promise<HostawayWriteResult> {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    this.sendMessageCalls.push({ conversationId, body });
    return { status: "success", result: { id: 999 } };
  }
}

describe("Write tools", () => {
  let mcpClient: Client;
  let transport: InMemoryTransport;
  let fakeClient: FakeWriteClient;
  let auditLogger: NoopAuditLogger;
  let rateLimiter: WriteRateLimiter;

  beforeEach(async () => {
    vi.useFakeTimers();

    fakeClient = new FakeWriteClient();
    auditLogger = new NoopAuditLogger();
    rateLimiter = new WriteRateLimiter({ maxTokens: 10, refillIntervalMs: 60_000 });

    const server = createHostawayMcpServer({
      client: fakeClient,
      name: "hostaway-mcp-write-test",
      version: "0.1.0-test",
      auditLogger,
      rateLimiter
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    mcpClient = new Client({
      name: "write-test-client",
      version: "1.0.0"
    });
    transport = clientTransport;

    await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await transport.close();
  });

  test("registers all 9 tools (6 read + 3 write)", async () => {
    const result = await mcpClient.listTools();
    expect(result.tools.map((t) => t.name).sort()).toEqual([
      "add_reservation_note",
      "get_conversation_context",
      "get_listing_brief",
      "get_reservation_brief",
      "list_unread_guest_threads",
      "mark_conversation_read",
      "search_conversations",
      "search_reservations",
      "send_guest_message"
    ]);
  });

  // ---- mark_conversation_read ----

  describe("mark_conversation_read", () => {
    test("dry-run when confirm is false — no HTTP call made", async () => {
      const result = await mcpClient.callTool({
        name: "mark_conversation_read",
        arguments: { conversationId: 201, confirm: false }
      });

      expect((result.structuredContent as { dry_run: boolean }).dry_run).toBe(true);
      expect((result.structuredContent as { preview: { would_send: unknown } }).preview.would_send).toEqual({ hasUnreadMessages: 0 });
      expect(fakeClient.updateConversationCalls).toHaveLength(0);
    });

    test("dry-run when confirm is missing — no HTTP call made", async () => {
      const result = await mcpClient.callTool({
        name: "mark_conversation_read",
        arguments: { conversationId: 201 }
      });

      expect((result.structuredContent as { dry_run: boolean }).dry_run).toBe(true);
      expect(fakeClient.updateConversationCalls).toHaveLength(0);
      expect(auditLogger.entries.at(-1)?.params).toContain("\"confirm\":false");
    });

    test("happy path — marks conversation as read", async () => {
      const result = await mcpClient.callTool({
        name: "mark_conversation_read",
        arguments: { conversationId: 201, confirm: true }
      });

      expect(result.structuredContent).toMatchObject({
        success: true,
        conversationId: "201",
        action: "marked_read"
      });

      expect(fakeClient.updateConversationCalls).toHaveLength(1);
      expect(fakeClient.updateConversationCalls[0]).toEqual({
        conversationId: 201,
        body: { hasUnreadMessages: 0 }
      });
    });

    test("logs audit entry on successful execution", async () => {
      await mcpClient.callTool({
        name: "mark_conversation_read",
        arguments: { conversationId: 201, confirm: true }
      });

      const okEntries = auditLogger.entries.filter((e) => e.result_status === "ok");
      expect(okEntries).toHaveLength(1);
      expect(okEntries[0]!.tool).toBe("mark_conversation_read");
    });

    test("logs audit entry on dry-run", async () => {
      await mcpClient.callTool({
        name: "mark_conversation_read",
        arguments: { conversationId: 201, confirm: false }
      });

      const dryRunEntries = auditLogger.entries.filter((e) => e.result_status === "dry_run");
      expect(dryRunEntries).toHaveLength(1);
    });

    test("handles API error gracefully", async () => {
      fakeClient.nextError = new Error("Hostaway request failed (500): Internal Server Error");

      const result = await mcpClient.callTool({
        name: "mark_conversation_read",
        arguments: { conversationId: 201, confirm: true }
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ text: string }>)[0]!.text;
      expect(text).toContain("Failed to mark conversation read");

      const errorEntries = auditLogger.entries.filter((e) => e.result_status === "error");
      expect(errorEntries).toHaveLength(1);
    });

    test("handles 401 auth error", async () => {
      fakeClient.nextError = new Error("AUTH_EXPIRED");

      const result = await mcpClient.callTool({
        name: "mark_conversation_read",
        arguments: { conversationId: 201, confirm: true }
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ text: string }>)[0]!.text;
      expect(text).toContain("AUTH_EXPIRED");
    });

    test("handles 404 not found", async () => {
      fakeClient.nextError = new Error("Hostaway request failed (404): Not Found");

      const result = await mcpClient.callTool({
        name: "mark_conversation_read",
        arguments: { conversationId: 999, confirm: true }
      });

      expect(result.isError).toBe(true);
    });
  });

  // ---- add_reservation_note ----

  describe("add_reservation_note", () => {
    test("dry-run when confirm is false — no HTTP call made", async () => {
      const result = await mcpClient.callTool({
        name: "add_reservation_note",
        arguments: { reservationId: 501, note: "Test note", confirm: false }
      });

      expect((result.structuredContent as { dry_run: boolean }).dry_run).toBe(true);
      expect(fakeClient.updateReservationCalls).toHaveLength(0);
    });

    test("dry-run when confirm is missing — no HTTP call made", async () => {
      const result = await mcpClient.callTool({
        name: "add_reservation_note",
        arguments: { reservationId: 501, note: "Test note" }
      });

      expect((result.structuredContent as { dry_run: boolean }).dry_run).toBe(true);
      expect(fakeClient.updateReservationCalls).toHaveLength(0);
      expect(auditLogger.entries.at(-1)?.params).toContain("\"confirm\":false");
    });

    test("dry-run in replace mode shows existing notes and warning", async () => {
      fakeClient.reservationHostNotes["501"] = "Old existing note";

      const result = await mcpClient.callTool({
        name: "add_reservation_note",
        arguments: { reservationId: 501, note: "New note", mode: "replace", confirm: false }
      });

      const preview = (result.structuredContent as { preview: { existing_notes: string; warning: string } }).preview;
      expect(preview.existing_notes).toBe("Old existing note");
      expect(preview.warning).toContain("overwrite existing hostNote");
    });

    test("happy path — appends note (default mode)", async () => {
      const result = await mcpClient.callTool({
        name: "add_reservation_note",
        arguments: { reservationId: 501, note: "Guest prefers early check-in", confirm: true }
      });

      expect(result.structuredContent).toMatchObject({
        success: true,
        reservationId: "501",
        action: "note_appended"
      });

      expect(fakeClient.updateReservationCalls).toHaveLength(1);
      expect(fakeClient.updateReservationCalls[0]!.body).toEqual({ hostNote: "Guest prefers early check-in" });
    });

    test("append mode concatenates with existing notes", async () => {
      fakeClient.reservationHostNotes["501"] = "Existing note";

      const result = await mcpClient.callTool({
        name: "add_reservation_note",
        arguments: { reservationId: 501, note: "New note", mode: "append", confirm: true }
      });

      expect(result.structuredContent).toMatchObject({
        success: true,
        action: "note_appended"
      });

      expect(fakeClient.updateReservationCalls[0]!.body).toEqual({ hostNote: "Existing note\nNew note" });
    });

    test("append mode fails closed when existing notes cannot be fetched", async () => {
      fakeClient.nextReservationReadError = new Error("Reservation 501 fetch failed");

      const result = await mcpClient.callTool({
        name: "add_reservation_note",
        arguments: { reservationId: 501, note: "New note", mode: "append", confirm: true }
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ text: string }>)[0]!.text;
      expect(text).toContain("Failed to fetch existing reservation notes");
      expect(fakeClient.updateReservationCalls).toHaveLength(0);
    });

    test("replace mode sends only the new note", async () => {
      fakeClient.reservationHostNotes["501"] = "Old note to be replaced";

      const result = await mcpClient.callTool({
        name: "add_reservation_note",
        arguments: { reservationId: 501, note: "Brand new note", mode: "replace", confirm: true }
      });

      expect(result.structuredContent).toMatchObject({
        success: true,
        action: "note_replaced"
      });

      expect(fakeClient.updateReservationCalls[0]!.body).toEqual({ hostNote: "Brand new note" });
    });

    test("logs audit entry on successful execution", async () => {
      await mcpClient.callTool({
        name: "add_reservation_note",
        arguments: { reservationId: 501, note: "Test", confirm: true }
      });

      const okEntries = auditLogger.entries.filter((e) => e.result_status === "ok" && e.tool === "add_reservation_note");
      expect(okEntries).toHaveLength(1);
    });

    test("handles API error gracefully", async () => {
      fakeClient.nextError = new Error("Hostaway request failed (400): Bad Request");

      const result = await mcpClient.callTool({
        name: "add_reservation_note",
        arguments: { reservationId: 501, note: "Test", confirm: true }
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ text: string }>)[0]!.text;
      expect(text).toContain("Failed to update reservation notes");
    });

    test("validates note length max 2000", async () => {
      const longNote = "x".repeat(2001);

      const result = await mcpClient.callTool({
        name: "add_reservation_note",
        arguments: { reservationId: 501, note: longNote, confirm: true }
      });

      // MCP SDK Zod validation should reject this
      expect(result.isError).toBe(true);
      expect(fakeClient.updateReservationCalls).toHaveLength(0);
    });

    test("validates note cannot be empty", async () => {
      const result = await mcpClient.callTool({
        name: "add_reservation_note",
        arguments: { reservationId: 501, note: "", confirm: true }
      });

      expect(result.isError).toBe(true);
      expect(fakeClient.updateReservationCalls).toHaveLength(0);
    });
  });

  // ---- send_guest_message ----

  describe("send_guest_message", () => {
    test("dry-run when confirm is false — no HTTP call, returns preview with context", async () => {
      const result = await mcpClient.callTool({
        name: "send_guest_message",
        arguments: { conversationId: 201, body: "Hello, welcome!", confirm: false }
      });

      const structured = result.structuredContent as {
        dry_run: boolean;
        preview: {
          action: string;
          message_preview: string;
          conversation_context: { guestName: string; channel: string } | null;
          warning: string;
        };
      };

      expect(structured.dry_run).toBe(true);
      expect(structured.preview.message_preview).toBe("Hello, welcome!");
      expect(structured.preview.conversation_context).toMatchObject({
        guestName: "Jane Smith",
        channel: "Airbnb"
      });
      expect(structured.preview.warning).toContain("IMMEDIATELY");
      expect(fakeClient.sendMessageCalls).toHaveLength(0);
    });

    test("dry-run when confirm is missing — no HTTP call, returns preview with context", async () => {
      const result = await mcpClient.callTool({
        name: "send_guest_message",
        arguments: { conversationId: 201, body: "Hello, welcome!" }
      });

      const structured = result.structuredContent as {
        dry_run: boolean;
        preview: {
          message_preview: string;
          conversation_context: { guestName: string; channel: string } | null;
        };
      };

      expect(structured.dry_run).toBe(true);
      expect(structured.preview.message_preview).toBe("Hello, welcome!");
      expect(structured.preview.conversation_context).toMatchObject({
        guestName: "Jane Smith",
        channel: "Airbnb"
      });
      expect(fakeClient.sendMessageCalls).toHaveLength(0);
      expect(auditLogger.entries.at(-1)?.params).toContain("\"confirm\":false");
    });

    test("happy path — sends message", async () => {
      const result = await mcpClient.callTool({
        name: "send_guest_message",
        arguments: { conversationId: 201, body: "Hello Jane, your check-in is confirmed!", confirm: true }
      });

      expect(result.structuredContent).toMatchObject({
        success: true,
        conversationId: "201",
        action: "message_sent"
      });

      expect(fakeClient.sendMessageCalls).toHaveLength(1);
      expect(fakeClient.sendMessageCalls[0]).toEqual({
        conversationId: 201,
        body: { body: "Hello Jane, your check-in is confirmed!" }
      });
    });

    test("logs audit entry with truncated message body", async () => {
      const longMessage = "A".repeat(300);
      await mcpClient.callTool({
        name: "send_guest_message",
        arguments: { conversationId: 201, body: longMessage, confirm: true }
      });

      const okEntries = auditLogger.entries.filter((e) => e.result_status === "ok" && e.tool === "send_guest_message");
      expect(okEntries).toHaveLength(1);
      // Params should be truncated
      expect(okEntries[0]!.params.length).toBeLessThanOrEqual(203);
    });

    test("handles API error gracefully", async () => {
      fakeClient.nextError = new Error("Hostaway request failed (403): Forbidden");

      const result = await mcpClient.callTool({
        name: "send_guest_message",
        arguments: { conversationId: 201, body: "Test message", confirm: true }
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ text: string }>)[0]!.text;
      expect(text).toContain("Failed to send message");

      const errorEntries = auditLogger.entries.filter((e) => e.result_status === "error");
      expect(errorEntries).toHaveLength(1);
    });

    test("validates body length max 4000", async () => {
      const longBody = "x".repeat(4001);

      const result = await mcpClient.callTool({
        name: "send_guest_message",
        arguments: { conversationId: 201, body: longBody, confirm: true }
      });

      expect(result.isError).toBe(true);
      expect(fakeClient.sendMessageCalls).toHaveLength(0);
    });

    test("validates body cannot be empty", async () => {
      const result = await mcpClient.callTool({
        name: "send_guest_message",
        arguments: { conversationId: 201, body: "", confirm: true }
      });

      expect(result.isError).toBe(true);
      expect(fakeClient.sendMessageCalls).toHaveLength(0);
    });
  });

  // ---- Rate limiter integration ----

  describe("rate limiter", () => {
    test("rejects after 10 rapid write calls with clear error", async () => {
      // Consume all 10 tokens
      for (let i = 0; i < 10; i++) {
        const result = await mcpClient.callTool({
          name: "mark_conversation_read",
          arguments: { conversationId: 201, confirm: true }
        });
        expect(result.isError).toBeUndefined();
      }

      // 11th call should be rate limited
      const result = await mcpClient.callTool({
        name: "mark_conversation_read",
        arguments: { conversationId: 201, confirm: true }
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ text: string }>)[0]!.text;
      expect(text).toContain("Rate limited");

      // Audit log should record rate_limited
      const rateLimitedEntries = auditLogger.entries.filter((e) => e.result_status === "rate_limited");
      expect(rateLimitedEntries.length).toBeGreaterThanOrEqual(1);
    });

    test("rate limiter is shared across all write tools", async () => {
      // Use 4 on mark_read, 3 on add_note, 3 on send_message = 10 total
      for (let i = 0; i < 4; i++) {
        await mcpClient.callTool({
          name: "mark_conversation_read",
          arguments: { conversationId: 201, confirm: true }
        });
      }
      for (let i = 0; i < 3; i++) {
        await mcpClient.callTool({
          name: "add_reservation_note",
          arguments: { reservationId: 501, note: "Test", confirm: true }
        });
      }
      for (let i = 0; i < 3; i++) {
        await mcpClient.callTool({
          name: "send_guest_message",
          arguments: { conversationId: 201, body: "Test", confirm: true }
        });
      }

      // 11th call across any tool should be rate limited
      const result = await mcpClient.callTool({
        name: "send_guest_message",
        arguments: { conversationId: 201, body: "This should fail", confirm: true }
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ text: string }>)[0]!.text;
      expect(text).toContain("Rate limited");
    });

    test("dry-run does NOT consume rate limit tokens", async () => {
      // 20 dry-run calls should all succeed
      for (let i = 0; i < 20; i++) {
        const result = await mcpClient.callTool({
          name: "mark_conversation_read",
          arguments: { conversationId: 201, confirm: false }
        });
        expect((result.structuredContent as { dry_run: boolean }).dry_run).toBe(true);
      }

      // First confirmed call should still succeed
      const result = await mcpClient.callTool({
        name: "mark_conversation_read",
        arguments: { conversationId: 201, confirm: true }
      });
      expect(result.structuredContent).toMatchObject({ success: true });
    });

    test("rate limiter rejects BEFORE making HTTP call", async () => {
      // Exhaust all tokens
      for (let i = 0; i < 10; i++) {
        await mcpClient.callTool({
          name: "mark_conversation_read",
          arguments: { conversationId: 201, confirm: true }
        });
      }

      const callCountBefore = fakeClient.updateConversationCalls.length;

      // This should be rate limited — no HTTP call
      await mcpClient.callTool({
        name: "mark_conversation_read",
        arguments: { conversationId: 201, confirm: true }
      });

      expect(fakeClient.updateConversationCalls.length).toBe(callCountBefore);
    });
  });

  // ---- Confirmation guard integration ----

  describe("confirmation guard across all tools", () => {
    test("mark_conversation_read defaults to dry-run when confirm is omitted", async () => {
      const result = await mcpClient.callTool({
        name: "mark_conversation_read",
        arguments: { conversationId: 201 }
      });
      expect((result.structuredContent as { dry_run: boolean }).dry_run).toBe(true);
      expect(fakeClient.updateConversationCalls).toHaveLength(0);
    });

    test("add_reservation_note defaults to dry-run when confirm is omitted", async () => {
      const result = await mcpClient.callTool({
        name: "add_reservation_note",
        arguments: { reservationId: 501, note: "Test" }
      });
      expect((result.structuredContent as { dry_run: boolean }).dry_run).toBe(true);
      expect(fakeClient.updateReservationCalls).toHaveLength(0);
    });

    test("send_guest_message defaults to dry-run when confirm is omitted", async () => {
      const result = await mcpClient.callTool({
        name: "send_guest_message",
        arguments: { conversationId: 201, body: "Test" }
      });
      expect((result.structuredContent as { dry_run: boolean }).dry_run).toBe(true);
      expect(fakeClient.sendMessageCalls).toHaveLength(0);
    });
  });
});
