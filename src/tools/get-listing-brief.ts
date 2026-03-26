import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { buildListingBrief } from "../hostaway/briefs.js";
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

export function registerGetListingBriefTool(server: McpServer, client: HostawayDataClient) {
  server.registerTool(
    "get_listing_brief",
    {
      description: "Return the minimum useful listing context tied to conversations or reservations.",
      inputSchema: {
        listingId: z.union([z.string(), z.number()]),
        detailLevel: z.enum(["compact", "full"]).optional()
      },
      outputSchema: {
        listingId: z.string().nullable(),
        listingName: z.string(),
        channelFacingName: z.string(),
        city: z.string().nullable(),
        country: z.string().nullable(),
        personCapacity: z.number().nullable(),
        bedrooms: z.number().nullable(),
        bathrooms: z.number().nullable(),
        missing: z.array(z.string()),
        notes: z.array(z.string()),
        raw: z
          .object({
            listing: z.record(z.string(), z.unknown())
          })
          .optional()
      }
    },
    async ({ listingId, detailLevel }) => {
      const listing = await client.getListing(listingId);

      return toolResult(
        buildListingBrief({
          listing,
          detailLevel: detailLevel ?? "compact"
        })
      );
    }
  );
}
