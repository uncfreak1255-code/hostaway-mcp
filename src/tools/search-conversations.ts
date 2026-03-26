import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { buildConversationSearchResult } from "../hostaway/briefs.js";
import { normalizeConversation } from "../hostaway/normalizers.js";
import type { HostawayDataClient } from "../hostaway/client.js";

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

export function registerSearchConversationsTool(server: McpServer, client: HostawayDataClient) {
  server.registerTool(
    "search_conversations",
    {
      description: "Lookup conversations by guest name, listing, reservation id, or conversation id.",
      inputSchema: {
        conversationId: z.union([z.string(), z.number()]).optional(),
        reservationId: z.union([z.string(), z.number()]).optional(),
        guestName: z.string().optional(),
        listingId: z.union([z.string(), z.number()]).optional(),
        limit: z.number().int().min(1).max(100).optional()
      },
      outputSchema: {
        total: z.number(),
        results: z.array(
          z.object({
            conversationId: z.string(),
            reservationId: z.string().nullable(),
            listingId: z.string().nullable(),
            listingName: z.string().nullable(),
            guestName: z.string(),
            channel: z.enum(["Airbnb", "Booking.com", "VRBO", "Direct"]),
            arrivalDate: z.string().nullable(),
            departureDate: z.string().nullable(),
            rawHasUnreadMessages: z.boolean().nullable()
          })
        )
      }
    },
    async ({ conversationId, reservationId, guestName, listingId, limit }) => {
      const conversations = conversationId != null
        ? [await client.getConversation(conversationId, { includeResources: 1 })]
        : await client.listConversations({
            ...(reservationId != null ? { reservationId } : {}),
            limit: limit ?? 10,
            includeResources: 1
          });

      const filtered = conversations.filter((conversation) => {
        const normalized = normalizeConversation(conversation);
        const normalizedListingId = normalized.listingId;
        const normalizedReservationId = normalized.reservationId;

        if (reservationId != null && normalizedReservationId !== `${reservationId}`) {
          return false;
        }

        if (listingId != null && normalizedListingId !== `${listingId}`) {
          return false;
        }

        if (guestName) {
          return normalized.guestName.toLowerCase().includes(guestName.toLowerCase());
        }

        return true;
      });

      return toolResult({
        total: filtered.length,
        results: filtered.map((conversation) =>
          buildConversationSearchResult({
            conversation,
            reservation: conversation.Reservation ?? null
          })
        )
      });
    }
  );
}
