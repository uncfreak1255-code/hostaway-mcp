/// <reference types="@cloudflare/workers-types" />

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import type { HostawayDataClient } from "../../hostaway/client.js";
import type { HostawayCalendarDay } from "../../hostaway/types.js";
import { getCachedCalendar } from "../cache.js";
import { buildBookingUrl } from "../utm.js";
import { SEASCAPE_PROPERTIES, SEASCAPE_LISTING_IDS } from "./properties.js";

const MS_PER_DAY = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function dateRange(checkin: string, nights: number): string[] {
  const dates: string[] = [];
  const start = new Date(checkin + "T00:00:00Z");
  for (let i = 0; i < nights; i++) {
    dates.push(new Date(start.getTime() + i * MS_PER_DAY).toISOString().slice(0, 10));
  }
  return dates;
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

interface AvailableResult {
  listing_id: number;
  name: string;
  available: true;
  total_price: number;
  avg_nightly_rate: number;
  min_night_price: number;
  max_night_price: number;
  nights: number;
  pet_policy: { pet_friendly: boolean; pet_fee: number | null };
  pool: { has_pool: boolean; heated: boolean };
  booking_url: string;
  note: string;
}

interface UnavailableResult {
  listing_id: number;
  name: string;
  available: false;
  error?: string;
}

type PropertyResult = AvailableResult | UnavailableResult;

export function registerSearchAvailabilityTool(server: McpServer, client: HostawayDataClient, kv?: KVNamespace) {
  server.registerTool(
    "search_availability",
    {
      title: "Search Availability",
      description: "Search for available Seascape vacation rental properties matching guest criteria and date range. Returns pricing, amenities, and direct booking links.",
      inputSchema: {
        checkin: z.string().describe("Check-in date (YYYY-MM-DD)"),
        checkout: z.string().describe("Check-out date (YYYY-MM-DD)"),
        guests: z.number().int().min(1).describe("Number of guests"),
        pets: z.boolean().optional().default(false).describe("Whether guests are bringing pets"),
        minimum_nights_ok: z.boolean().optional().default(true).describe("If false, skip properties where minimumStay exceeds requested nights")
      },
      annotations: {
        title: "Search Availability",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ checkin, checkout, guests, pets, minimum_nights_ok }) => {
      if (!isValidDateString(checkin) || !isValidDateString(checkout)) {
        return toolResult({
          error: "Invalid date format. Use YYYY-MM-DD with a real calendar date.",
          results: []
        });
      }

      const requestedNights = Math.round(
        (new Date(checkout).getTime() - new Date(checkin).getTime()) / MS_PER_DAY
      );

      if (requestedNights < 1) {
        return toolResult({
          error: "checkout must be after checkin",
          results: []
        });
      }

      let listingIds = SEASCAPE_LISTING_IDS.filter(
        (id) => SEASCAPE_PROPERTIES[id]!.maxGuests >= guests
      );
      if (pets) {
        listingIds = listingIds.filter((id) => SEASCAPE_PROPERTIES[id]!.petFriendly);
      }

      const results: PropertyResult[] = await Promise.all(
        listingIds.map(async (listingId): Promise<PropertyResult> => {
          const property = SEASCAPE_PROPERTIES[listingId]!;

          let calendar: HostawayCalendarDay[];
          try {
            const dates = dateRange(checkin, requestedNights);
            const cached = kv ? await getCachedCalendar(kv, listingId, dates) : null;
            calendar = cached ?? await client.getCalendar(listingId, checkin, checkout);
          } catch {
            return {
              listing_id: listingId,
              name: property.name,
              available: false,
              error: "Could not check availability"
            };
          }

          // Verify API returned exactly the number of nights requested
          if (calendar.length !== requestedNights) {
            return {
              listing_id: listingId,
              name: property.name,
              available: false,
              error: "Incomplete calendar data"
            };
          }

          // A property is available if ALL nights in the range are available
          const allAvailable = calendar.every((day) => day.isAvailable === 1);

          // Check arrival/departure restrictions
          if (allAvailable) {
            const firstDay = calendar[0]!;
            const lastDay = calendar[calendar.length - 1]!;
            if (firstDay.closedOnArrival === 1 || lastDay.closedOnDeparture === 1) {
              return {
                listing_id: listingId,
                name: property.name,
                available: false
              };
            }
          }

          if (!allAvailable) {
            return {
              listing_id: listingId,
              name: property.name,
              available: false
            };
          }

          // Check minimum stay if requested
          if (!minimum_nights_ok) {
            const exceedsMinStay = calendar.some((day) => day.minimumStay > requestedNights);
            if (exceedsMinStay) {
              return {
                listing_id: listingId,
                name: property.name,
                available: false
              };
            }
          }

          const prices = calendar.map((day) => day.price);
          const totalPrice = prices.reduce((sum, p) => sum + p, 0);

          return {
            listing_id: listingId,
            name: property.name,
            available: true,
            total_price: Math.round(totalPrice * 100) / 100,
            avg_nightly_rate: Math.round((totalPrice / requestedNights) * 100) / 100,
            min_night_price: Math.min(...prices),
            max_night_price: Math.max(...prices),
            nights: requestedNights,
            pet_policy: {
              pet_friendly: property.petFriendly,
              pet_fee: property.petFee
            },
            pool: {
              has_pool: property.hasPool,
              heated: property.poolHeated
            },
            booking_url: buildBookingUrl(property.slug, { checkin, checkout, guests }),
            note: "Taxes and fees calculated at booking"
          };
        })
      );

      // Sort: available properties by total_price ascending, then unavailable at the end
      results.sort((a, b) => {
        if (a.available && b.available) {
          return a.total_price - b.total_price;
        }
        if (a.available) return -1;
        if (b.available) return 1;
        return 0;
      });

      return toolResult({
        checkin,
        checkout,
        nights: requestedNights,
        guests,
        pets_required: pets,
        results
      });
    }
  );
}
