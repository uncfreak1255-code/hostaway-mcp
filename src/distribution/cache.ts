/// <reference types="@cloudflare/workers-types" />

// KV cache read/write helpers for the distribution layer.
//
// TODO: implement get/put wrappers around Workers KV with:
// - typed deserialization via PropertyCacheEntry
// - TTL-aware writes
// - batch pre-warm for cron handler

import type { PropertyCacheEntry } from "./types.js";

export async function getCachedProperty(
  _kv: KVNamespace,
  _listingId: number
): Promise<PropertyCacheEntry | null> {
  // TODO: implement KV read with JSON deserialization
  return null;
}

export async function putCachedProperty(
  _kv: KVNamespace,
  _entry: PropertyCacheEntry,
  _ttlSeconds: number
): Promise<void> {
  // TODO: implement KV write with TTL
}
