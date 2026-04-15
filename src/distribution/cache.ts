/// <reference types="@cloudflare/workers-types" />

// KV cache read/write helpers for the distribution layer.
//
// Key format:
//   "property:{listingId}"                         — listing data
//   "calendar:{listingId}:{startDate}:{endDate}"   — calendar data
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

// ── Calendar cache ─────────────────────────────────────────────────────

export async function getCachedCalendar(
  kv: KVNamespace,
  listingId: number,
  startDate: string,
  endDate: string
): Promise<HostawayCalendarDay[] | null> {
  try {
    const raw = await kv.get(`calendar:${listingId}:${startDate}:${endDate}`);
    if (raw === null) return null;
    return JSON.parse(raw) as HostawayCalendarDay[];
  } catch {
    return null;
  }
}

export async function putCachedCalendar(
  kv: KVNamespace,
  listingId: number,
  startDate: string,
  endDate: string,
  data: HostawayCalendarDay[]
): Promise<void> {
  await kv.put(
    `calendar:${listingId}:${startDate}:${endDate}`,
    JSON.stringify(data),
    { expirationTtl: DEFAULT_TTL_SECONDS }
  );
}
