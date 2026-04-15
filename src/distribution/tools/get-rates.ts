/// <reference types="@cloudflare/workers-types" />

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import type { HostawayDataClient } from "../../hostaway/client.js";
import { getCachedCalendar } from "../cache.js";
import { buildBookingUrl } from "../utm.js";
import { SEASCAPE_PROPERTIES, getPropertyNames } from "./properties.js";
import { toolResult, MS_PER_DAY } from "./tool-result.js";

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

export function registerGetRatesTool(server: McpServer, client: HostawayDataClient, kv?: KVNamespace) {
  server.registerTool(
    "get_rates",
    {
      title: "Get Rates",
      description: "Get per-night rate breakdown for a specific Seascape vacation rental property and date range. Includes availability status per night and pricing summary.",
      inputSchema: {
        listing_id: z.number().int().describe("Hostaway listing ID"),
        checkin: z.string().describe("Check-in date (YYYY-MM-DD)"),
        checkout: z.string().describe("Check-out date (YYYY-MM-DD)")
      },
      annotations: {
        title: "Get Rates",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ listing_id, checkin, checkout }) => {
      if (!isValidDateString(checkin) || !isValidDateString(checkout)) {
        return toolResult({
          error: "Invalid date format. Use YYYY-MM-DD with a real calendar date."
        });
      }

      const property = SEASCAPE_PROPERTIES[listing_id];

      if (!property) {
        return toolResult({
          error: `Property not found. Available properties: ${getPropertyNames().join(", ")}`
        });
      }

      const nights = Math.round(
        (new Date(checkout).getTime() - new Date(checkin).getTime()) / MS_PER_DAY
      );

      if (nights < 1) {
        return toolResult({
          error: "checkout must be after checkin"
        });
      }

      try {
        const dates = dateRange(checkin, nights);
        const cached = kv ? await getCachedCalendar(kv, listing_id, dates) : null;
        const calendar = cached ?? await client.getCalendar(listing_id, checkin, checkout);

        if (calendar.length !== nights) {
          return toolResult({
            listing_id,
            name: property.name,
            checkin,
            checkout,
            error: `Incomplete calendar data: expected ${nights} nights, got ${calendar.length}`
          });
        }

        const rates = calendar.map((day) => ({
          date: day.date,
          price: day.price,
          available: day.isAvailable === 1,
          minimum_stay: day.minimumStay
        }));

        const prices = calendar.map((day) => day.price);
        const totalPrice = prices.reduce((sum, p) => sum + p, 0);
        const allAvailable = calendar.length > 0 && calendar.every((day) => day.isAvailable === 1);

        return toolResult({
          listing_id,
          name: property.name,
          checkin,
          checkout,
          nights,
          rates,
          summary: {
            total_price: Math.round(totalPrice * 100) / 100,
            avg_nightly_rate: Math.round((totalPrice / nights) * 100) / 100,
            min_night: prices.length > 0 ? Math.min(...prices) : 0,
            max_night: prices.length > 0 ? Math.max(...prices) : 0
          },
          all_available: allAvailable,
          booking_url: buildBookingUrl(property.slug, { checkin, checkout }),
          note: "Taxes and fees calculated at booking"
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return toolResult({
          listing_id,
          name: property.name,
          checkin,
          checkout,
          error: `Could not fetch rates: ${message}`
        });
      }
    }
  );
}
