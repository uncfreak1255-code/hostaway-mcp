import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { buildReservationSearchResult } from "../hostaway/briefs.js";
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

export function registerSearchReservationsTool(server: McpServer, client: HostawayDataClient) {
  server.registerTool(
    "search_reservations",
    {
      description: "Lookup reservations by guest name, date range, listing, or reservation id.",
      inputSchema: {
        reservationId: z.union([z.string(), z.number()]).optional(),
        guestName: z.string().optional(),
        guestEmail: z.string().optional(),
        listingId: z.union([z.string(), z.number()]).optional(),
        arrivalStartDate: z.string().optional(),
        arrivalEndDate: z.string().optional(),
        departureStartDate: z.string().optional(),
        departureEndDate: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional()
      },
      outputSchema: {
        total: z.number(),
        results: z.array(
          z.object({
            reservationId: z.string().nullable(),
            listingId: z.string().nullable(),
            listingName: z.string().nullable(),
            guestName: z.string(),
            channel: z.enum(["Airbnb", "Booking.com", "VRBO", "Direct"]),
            arrivalDate: z.string().nullable(),
            departureDate: z.string().nullable(),
            status: z.string().nullable()
          })
        )
      }
    },
    async ({ reservationId, guestName, guestEmail, listingId, arrivalStartDate, arrivalEndDate, departureStartDate, departureEndDate, limit }) => {
      const reservations = reservationId != null
        ? [await client.getReservation(reservationId)]
        : await client.listReservations({
            limit: limit ?? 10,
            ...(guestName ? { match: guestName } : {}),
            ...(guestEmail ? { guestEmail } : {}),
            ...(listingId != null ? { listingId } : {}),
            ...(arrivalStartDate ? { arrivalStartDate } : {}),
            ...(arrivalEndDate ? { arrivalEndDate } : {}),
            ...(departureStartDate ? { departureStartDate } : {}),
            ...(departureEndDate ? { departureEndDate } : {}),
            includeResources: 1
          });

      return toolResult({
        total: reservations.length,
        results: reservations.map((reservation) =>
          buildReservationSearchResult({
            reservation
          })
        )
      });
    }
  );
}
