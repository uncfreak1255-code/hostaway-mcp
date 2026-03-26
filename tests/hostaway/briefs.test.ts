import { describe, expect, test } from "vitest";

import conversation201 from "../../fixtures/hostaway/conversations/conversation-201-jane.json" with { type: "json" };
import conversation201Messages from "../../fixtures/hostaway/messages/conversation-201.json" with { type: "json" };
import reservation501 from "../../fixtures/hostaway/reservations/reservation-501.json" with { type: "json" };
import reservation503 from "../../fixtures/hostaway/reservations/reservation-503-missing-fields.json" with { type: "json" };
import listing135880 from "../../fixtures/hostaway/listings/listing-135880.json" with { type: "json" };
import listing487798 from "../../fixtures/hostaway/listings/listing-487798-missing-fields.json" with { type: "json" };

import {
  buildConversationContext,
  buildListingBrief,
  buildReservationBrief
} from "../../src/hostaway/briefs.js";

describe("brief builders", () => {
  test("builds a compact conversation context with stable fields first", () => {
    const context = buildConversationContext({
      conversation: conversation201,
      messages: conversation201Messages,
      reservation: reservation501,
      listing: listing135880
    });

    expect(context).toMatchObject({
      conversationId: "201",
      reservationId: "501",
      listingId: "135880",
      guest: {
        name: "Jane Smith",
        email: "jane@example.com"
      },
      listing: {
        id: "135880",
        name: "River House"
      },
      reservation: {
        id: "501",
        status: "confirmed",
        arrivalDate: "2026-07-01",
        departureDate: "2026-07-05"
      },
      attention: {
        rawHasUnreadMessages: true,
        hostRepliedAfterLatestGuestMessage: false,
        needsAttention: true
      },
      latestSpeaker: "guest",
      hasAttachments: false,
      missing: []
    });

    expect(context.recentMessages).toEqual([
      {
        id: "1",
        speaker: "host",
        text: "Welcome in. Let us know if you need anything before arrival.",
        timestamp: "2026-07-01T12:00:00Z",
        hasAttachments: false
      },
      {
        id: "2",
        speaker: "guest",
        text: "Can we check in early?",
        timestamp: "2026-07-01T12:15:00Z",
        hasAttachments: false
      }
    ]);
  });

  test("expands conversation context predictably in full detail mode", () => {
    const context = buildConversationContext({
      conversation: conversation201,
      messages: conversation201Messages,
      reservation: reservation501,
      listing: listing135880,
      detailLevel: "full"
    });

    expect("raw" in context && context.raw).toMatchObject({
      conversation: { id: 201 },
      reservation: { id: 501 },
      listing: { id: 135880 }
    });
  });

  test("builds reservation briefs with explicit missing-field notes", () => {
    const brief = buildReservationBrief({
      reservation: reservation503,
      listing: listing487798
    });

    expect(brief).toMatchObject({
      reservationId: "503",
      listingId: "487798",
      guestName: "Morgan Lee",
      channel: "Direct"
    });
    expect(brief.missing).toEqual(expect.arrayContaining(["status", "occupancy"]));
  });

  test("builds listing briefs with shared field names and missing metadata", () => {
    const brief = buildListingBrief({
      listing: listing487798
    });

    expect(brief).toMatchObject({
      listingId: "487798",
      listingName: "Bradenton Pool Home",
      channelFacingName: "Bradenton Pool Home"
    });
    expect(brief.missing).toEqual(expect.arrayContaining(["city", "country", "personCapacity"]));
  });
});
