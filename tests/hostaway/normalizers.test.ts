import { describe, expect, test } from "vitest";

import airbnbRecipientName from "../../fixtures/hostaway/conversations/airbnb-recipient-name.json" with { type: "json" };
import airbnb2018FallbackName from "../../fixtures/hostaway/conversations/airbnb-2018-fallback-name.json" with { type: "json" };
import vrboGuestName from "../../fixtures/hostaway/conversations/vrbo-guest-name.json" with { type: "json" };
import unknownDirect from "../../fixtures/hostaway/conversations/unknown-direct.json" with { type: "json" };

import {
  normalizeChannel,
  normalizeConversation,
  normalizeGuestName,
  normalizeMessageText,
  normalizeTimestamp
} from "../../src/hostaway/normalizers.js";

describe("normalizeChannel", () => {
  test("maps canonical Hostaway channel ids", () => {
    expect(normalizeChannel(airbnbRecipientName)).toBe("Airbnb");
    expect(normalizeChannel(airbnb2018FallbackName)).toBe("Airbnb");
    expect(normalizeChannel(vrboGuestName)).toBe("VRBO");
    expect(normalizeChannel(unknownDirect)).toBe("Direct");
  });
});

describe("normalizeGuestName", () => {
  test("prefers recipientName before other guest name fields", () => {
    expect(normalizeGuestName(airbnbRecipientName)).toBe("Jane Smith");
  });

  test("falls back to first and last name, then guestName, then Unknown Guest", () => {
    expect(normalizeGuestName(airbnb2018FallbackName)).toBe("Sam Taylor");
    expect(normalizeGuestName(vrboGuestName)).toBe("Alex Rivera");
    expect(normalizeGuestName(unknownDirect)).toBe("Unknown Guest");
  });
});

describe("normalizeConversation", () => {
  test("builds a compact canonical conversation shape", () => {
    expect(normalizeConversation(airbnbRecipientName)).toMatchObject({
      id: "101",
      listingId: "135880",
      channel: "Airbnb",
      guestName: "Jane Smith",
      isArchived: false,
      arrivalDate: "2026-07-01",
      departureDate: "2026-07-05"
    });
  });
});

describe("message field normalization", () => {
  test("normalizes text and timestamps across Hostaway field variants", () => {
    expect(normalizeMessageText({ body: "from-body" })).toBe("from-body");
    expect(normalizeMessageText({ message: "from-message" })).toBe("from-message");
    expect(normalizeMessageText({ text: "from-text" })).toBe("from-text");
    expect(normalizeMessageText({})).toBe("");

    expect(normalizeTimestamp({ insertedOn: "2026-01-01T00:00:00Z" })).toBe("2026-01-01T00:00:00Z");
    expect(normalizeTimestamp({ createdOn: "2026-01-02T00:00:00Z" })).toBe("2026-01-02T00:00:00Z");
    expect(normalizeTimestamp({ date: "2026-01-03T00:00:00Z" })).toBe("2026-01-03T00:00:00Z");
    expect(normalizeTimestamp({})).toBeNull();
  });
});
