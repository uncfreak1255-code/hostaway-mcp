/// <reference types="@cloudflare/workers-types" />

// KV cache read/write helpers for the distribution layer.
//
// Key format:
//   "property:{listingId}"    — listing data
//   "cal:{listingId}:{date}"  — single calendar day
//
// TTL: 1200 seconds (20 minutes) — slightly longer than the 15-min cron
// interval so stale reads never happen during normal operation.

import type { RawHostawayListing, HostawayCalendarDay } from "../hostaway/types.js";

const DEFAULT_TTL_SECONDS = 1200;

// ── Listing cache ──────────────────────────────────────────────────────

export async function getCachedListing(
  kv: KVNamespace,
  listingId: number
): Promise<RawHostawayListing | null> {
  try {
    const raw = await kv.get(`property:${listingId}`);
    if (raw === null) return null;
    return JSON.parse(raw) as RawHostawayListing;
  } catch {
    return null;
  }
}

export async function putCachedListing(
  kv: KVNamespace,
  listingId: number,
  data: RawHostawayListing
): Promise<void> {
  await kv.put(`property:${listingId}`, JSON.stringify(data), {
    expirationTtl: DEFAULT_TTL_SECONDS,
  });
}

// ── Calendar cache (per-day keys) ─────────────────────────────────────

/**
 * Read cached calendar days for a set of dates.
 * Returns all days in order if every date is cached, or null if any is missing.
 */
export async function getCachedCalendar(
  kv: KVNamespace,
  listingId: number,
  dates: string[]
): Promise<HostawayCalendarDay[] | null> {
  try {
    const results = await Promise.all(
      dates.map((date) => kv.get(`cal:${listingId}:${date}`))
    );
    const days: HostawayCalendarDay[] = [];
    for (const raw of results) {
      if (raw === null) return null;
      days.push(JSON.parse(raw) as HostawayCalendarDay);
    }
    return days;
  } catch {
    return null;
  }
}

/**
 * Write calendar days to cache — one KV key per day.
 * Cron pre-warm writes the full 90-day window; tools never write.
 */
export async function putCachedCalendar(
  kv: KVNamespace,
  listingId: number,
  data: HostawayCalendarDay[]
): Promise<void> {
  await Promise.all(
    data.map((day) =>
      kv.put(`cal:${listingId}:${day.date}`, JSON.stringify(day), {
        expirationTtl: DEFAULT_TTL_SECONDS,
      })
    )
  );
}
