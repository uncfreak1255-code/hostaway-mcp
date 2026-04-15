import { describe, expect, test } from "vitest";

import type { HostawayCalendarDay } from "../../src/hostaway/types.js";
import {
  getCachedCalendar,
  putCachedCalendar,
  getCachedListing,
  putCachedListing,
} from "../../src/distribution/cache.js";

function makeDay(date: string, price = 200): HostawayCalendarDay {
  return {
    id: 1,
    date,
    isAvailable: 1,
    status: "available",
    price,
    minimumStay: 2,
    maximumStay: 30,
    closedOnArrival: 0,
    closedOnDeparture: 0,
    note: null,
    countAvailableUnits: 1,
    availableUnitsToSell: 1,
  };
}

/** In-memory KVNamespace mock */
function makeMockKV(): KVNamespace {
  const store = new Map<string, { value: string; expiration?: number }>();
  return {
    get: async (key: string) => store.get(key)?.value ?? null,
    put: async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, { value, expiration: opts?.expirationTtl });
    },
    delete: async (key: string) => { store.delete(key); },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

describe("cache", () => {
  describe("calendar per-day cache", () => {
    test("cache hit: returns days for requested dates", async () => {
      const kv = makeMockKV();
      const days = [makeDay("2026-06-01", 250), makeDay("2026-06-02", 300)];

      await putCachedCalendar(kv, 206016, days);

      const result = await getCachedCalendar(
        kv,
        206016,
        ["2026-06-01", "2026-06-02"]
      );
      expect(result).toHaveLength(2);
      expect(result![0]!.price).toBe(250);
      expect(result![1]!.price).toBe(300);
    });

    test("cache miss: returns null when any day is missing", async () => {
      const kv = makeMockKV();
      // Only cache one day
      await putCachedCalendar(kv, 206016, [makeDay("2026-06-01")]);

      const result = await getCachedCalendar(
        kv,
        206016,
        ["2026-06-01", "2026-06-02"]
      );
      expect(result).toBeNull();
    });

    test("malformed JSON returns null", async () => {
      const kv = makeMockKV();
      await kv.put("cal:206016:2026-06-01", "not-json");

      const result = await getCachedCalendar(kv, 206016, ["2026-06-01"]);
      expect(result).toBeNull();
    });

    test("cron pre-warm keys match tool lookups", async () => {
      const kv = makeMockKV();
      // Simulate cron writing 90 days
      const days = Array.from({ length: 90 }, (_, i) => {
        const d = new Date(2026, 5, 1 + i); // June 1 + i
        return makeDay(d.toISOString().slice(0, 10), 200 + i);
      });

      await putCachedCalendar(kv, 206016, days);

      // Tool queries Jun 10-15 (5 nights)
      const toolDates = ["2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14"];
      const result = await getCachedCalendar(kv, 206016, toolDates);
      expect(result).toHaveLength(5);
      expect(result![0]!.date).toBe("2026-06-10");
      expect(result![4]!.date).toBe("2026-06-14");
    });
  });

  describe("listing cache", () => {
    test("cache hit returns listing", async () => {
      const kv = makeMockKV();
      const listing = { id: 206016, name: "Test Property" };

      await putCachedListing(kv, 206016, listing as any);

      const result = await getCachedListing(kv, 206016);
      expect(result).toEqual(listing);
    });

    test("cache miss returns null", async () => {
      const kv = makeMockKV();
      const result = await getCachedListing(kv, 999);
      expect(result).toBeNull();
    });
  });
});
