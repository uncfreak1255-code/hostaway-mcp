import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { buildReservationBrief } from "../hostaway/briefs.js";
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

export function registerGetReservationBriefTool(server: McpServer, client: HostawayDataClient) {
  server.registerTool(
    "get_reservation_brief",
    {
      description: "Return the minimum useful reservation context for an agent or operator.",
      inputSchema: {
        reservationId: z.union([z.string(), z.number()]),
        detailLevel: z.enum(["compact", "full"]).optional()
      },
      outputSchema: {
        reservationId: z.string().nullable(),
        listingId: z.string().nullable(),
        listingName: z.string().nullable(),
        guestName: z.string(),
        guestEmail: z.string().nullable(),
        channel: z.enum(["Airbnb", "Booking.com", "VRBO", "Direct"]),
        status: z.string().nullable(),
        arrivalDate: z.string().nullable(),
        departureDate: z.string().nullable(),
        occupancy: z
          .object({
            totalGuests: z.number().nullable(),
            adults: z.number().nullable(),
            children: z.number().nullable(),
            infants: z.number().nullable(),
            pets: z.number().nullable()
          })
          .nullable(),
        missing: z.array(z.string()),
        notes: z.array(z.string()),
        raw: z
          .object({
            reservation: z.record(z.string(), z.unknown()),
            listing: z.record(z.string(), z.unknown()).nullable()
          })
          .optional()
      }
    },
    async ({ reservationId, detailLevel }) => {
      const reservation = await client.getReservation(reservationId);
      const listingId = reservation.listingMapId ?? reservation.listingId ?? null;
      const listing = listingId != null ? await client.getListing(listingId).catch(() => null) : null;

      return toolResult(
        buildReservationBrief({
          reservation,
          listing,
          detailLevel: detailLevel ?? "compact"
        })
      );
    }
  );
}
