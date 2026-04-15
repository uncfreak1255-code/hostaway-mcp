/// <reference types="@cloudflare/workers-types" />

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import type { HostawayDataClient } from "../../hostaway/client.js";
import { getCachedListing } from "../cache.js";
import { buildBookingUrl } from "../utm.js";
import { SEASCAPE_PROPERTIES, getPropertyNames } from "./properties.js";

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

export function registerGetPropertyDetailsTool(server: McpServer, client: HostawayDataClient, kv?: KVNamespace) {
  server.registerTool(
    "get_property_details",
    {
      title: "Get Property Details",
      description: "Get full details for a specific Seascape vacation rental property including location, capacity, amenities, pet policy, and pool info.",
      inputSchema: {
        listing_id: z.number().int().describe("Hostaway listing ID")
      },
      annotations: {
        title: "Get Property Details",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ listing_id }) => {
      const property = SEASCAPE_PROPERTIES[listing_id];

      if (!property) {
        return toolResult({
          error: `Property not found. Available properties: ${getPropertyNames().join(", ")}`
        });
      }

      try {
        const cached = kv ? await getCachedListing(kv, listing_id) : null;
        const listing = cached ?? await client.getListing(listing_id);

        return toolResult({
          listing_id,
          name: property.name,
          location: {
            city: listing.city ?? null,
            state: listing.state ?? null,
            address: listing.address ?? null
          },
          capacity: {
            max_guests: listing.personCapacity ?? null,
            bedrooms: listing.bedroomsNumber ?? null,
            bathrooms: listing.guestBathroomsNumber ?? null
          },
          pet_policy: {
            pet_friendly: property.petFriendly,
            pet_fee: property.petFee
          },
          pool: {
            has_pool: property.hasPool,
            heated: property.poolHeated
          },
          amenities: listing.amenities ?? [],
          booking_url: buildBookingUrl(property.slug),
          description: listing.description ?? null,
          note: "Taxes and fees calculated at booking"
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toolResult({
          listing_id,
          name: property.name,
          error: `Could not fetch listing details: ${message}`
        });
      }
    }
  );
}
