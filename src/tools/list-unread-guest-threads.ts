import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { buildUnreadThreadSummary } from "../hostaway/briefs.js";
import type { HostawayDataClient } from "../hostaway/client.js";
import type { RawHostawayConversation, RawHostawayListing, RawHostawayReservationLike } from "../hostaway/types.js";

function listingIdFrom(conversation: RawHostawayConversation, reservation?: RawHostawayReservationLike | null) {
  return conversation.listingMapId ?? conversation.listingId ?? reservation?.listingMapId ?? reservation?.listingId ?? null;
}

function toolResult<T>(structuredContent: T) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(structuredContent, null, 2)
      }
    ],
    structuredContent
  };
}

export function registerListUnreadGuestThreadsTool(server: McpServer, client: HostawayDataClient) {
  server.registerTool(
    "list_unread_guest_threads",
    {
      description: "List recent guest threads with raw unread metadata and derived attention signals.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional(),
        messageLimit: z.number().int().min(1).max(50).optional()
      },
      outputSchema: {
        total: z.number(),
        threads: z.array(
          z.object({
            conversationId: z.string(),
            reservationId: z.string().nullable(),
            listingId: z.string().nullable(),
            listingName: z.string().nullable(),
            guestName: z.string(),
            channel: z.enum(["Airbnb", "Booking.com", "VRBO", "Direct"]),
            arrivalDate: z.string().nullable(),
            departureDate: z.string().nullable(),
            latestGuestMessageTimestamp: z.string().nullable(),
            rawHasUnreadMessages: z.boolean().nullable(),
            hostRepliedAfterLatestGuestMessage: z.boolean(),
            needsAttention: z.boolean(),
            preview: z.string()
          })
        )
      }
    },
    async ({ limit, messageLimit }) => {
      const reservationCache = new Map<string, Promise<RawHostawayReservationLike | null>>();
      const listingCache = new Map<string, Promise<RawHostawayListing | null>>();

      const conversations = await client.listConversations({
        limit: limit ?? 10,
        includeResources: 1
      });

      async function getReservation(conversation: RawHostawayConversation) {
        if (conversation.Reservation) {
          return conversation.Reservation;
        }

        if (conversation.reservationId == null) {
          return null;
        }

        const key = `${conversation.reservationId}`;
        if (!reservationCache.has(key)) {
          reservationCache.set(
            key,
            client.getReservation(conversation.reservationId).catch(() => null)
          );
        }

        return reservationCache.get(key)!;
      }

      async function getListing(conversation: RawHostawayConversation, reservation: RawHostawayReservationLike | null) {
        const listingId = listingIdFrom(conversation, reservation);
        if (listingId == null) {
          return null;
        }

        const key = `${listingId}`;
        if (!listingCache.has(key)) {
          listingCache.set(key, client.getListing(listingId).catch(() => null));
        }

        return listingCache.get(key)!;
      }

      const summaries = [];

      for (const conversation of conversations) {
        if (conversation.isArchived) {
          continue;
        }

        const [messages, reservation] = await Promise.all([
          client.getConversationMessages(conversation.id ?? "", {
            limit: messageLimit ?? 10
          }),
          getReservation(conversation)
        ]);
        const listing = await getListing(conversation, reservation);

        const summary = buildUnreadThreadSummary({
          conversation,
          messages,
          reservation,
          listing
        });

        if (summary.rawHasUnreadMessages === true || summary.needsAttention) {
          summaries.push(summary);
        }
      }

      summaries.sort((left, right) => {
        if (left.needsAttention !== right.needsAttention) {
          return Number(right.needsAttention) - Number(left.needsAttention);
        }

        const leftTime = left.latestGuestMessageTimestamp ? new Date(left.latestGuestMessageTimestamp).getTime() : 0;
        const rightTime = right.latestGuestMessageTimestamp ? new Date(right.latestGuestMessageTimestamp).getTime() : 0;
        return rightTime - leftTime;
      });

      return toolResult({
        total: summaries.length,
        threads: summaries
      });
    }
  );
}
