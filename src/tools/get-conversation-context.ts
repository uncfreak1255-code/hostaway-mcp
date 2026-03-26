import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { buildConversationContext } from "../hostaway/briefs.js";
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

export function registerGetConversationContextTool(server: McpServer, client: HostawayDataClient) {
  server.registerTool(
    "get_conversation_context",
    {
      description: "Return an agent-friendly conversation summary plus recent message history.",
      inputSchema: {
        conversationId: z.union([z.string(), z.number()]),
        detailLevel: z.enum(["compact", "full"]).optional(),
        messageLimit: z.number().int().min(1).max(100).optional()
      },
      outputSchema: {
        conversationId: z.string(),
        reservationId: z.string().nullable(),
        listingId: z.string().nullable(),
        guest: z.object({
          name: z.string(),
          email: z.string().nullable()
        }),
        listing: z.object({
          id: z.string().nullable(),
          name: z.string().nullable()
        }),
        reservation: z.object({
          id: z.string().nullable(),
          status: z.string().nullable(),
          arrivalDate: z.string().nullable(),
          departureDate: z.string().nullable()
        }),
        channel: z.enum(["Airbnb", "Booking.com", "VRBO", "Direct"]),
        attention: z.object({
          rawHasUnreadMessages: z.boolean().nullable(),
          latestGuestMessageTimestamp: z.string().nullable(),
          hostRepliedAfterLatestGuestMessage: z.boolean(),
          needsAttention: z.boolean()
        }),
        latestSpeaker: z.enum(["guest", "host", "unknown"]).nullable(),
        hasAttachments: z.boolean(),
        preview: z.string(),
        recentMessages: z.array(
          z.object({
            id: z.string(),
            speaker: z.enum(["guest", "host", "unknown"]),
            text: z.string(),
            timestamp: z.string().nullable(),
            hasAttachments: z.boolean()
          })
        ),
        missing: z.array(z.string()),
        notes: z.array(z.string()),
        raw: z
          .object({
            conversation: z.record(z.string(), z.unknown()),
            reservation: z.record(z.string(), z.unknown()).nullable(),
            listing: z.record(z.string(), z.unknown()).nullable()
          })
          .optional()
      }
    },
    async ({ conversationId, detailLevel, messageLimit }) => {
      const conversation = await client.getConversation(conversationId, {
        includeResources: 1
      });
      const messages = await client.getConversationMessages(conversationId, {
        limit: messageLimit ?? 10
      });
      const reservation =
        conversation.Reservation ??
        (conversation.reservationId != null ? await client.getReservation(conversation.reservationId).catch(() => null) : null);
      const listingId = conversation.listingMapId ?? conversation.listingId ?? reservation?.listingMapId ?? reservation?.listingId ?? null;
      const listing = listingId != null ? await client.getListing(listingId).catch(() => null) : null;

      return toolResult(
        buildConversationContext({
          conversation,
          messages,
          reservation,
          listing,
          detailLevel: detailLevel ?? "compact"
        })
      );
    }
  );
}
