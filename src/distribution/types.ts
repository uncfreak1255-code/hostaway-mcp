// Distribution-specific types for the Cloudflare Workers layer.

export interface PropertyCacheEntry {
  listingId: number;
  slug: string;
  name: string;
  updatedAt: string;
  // TODO: calendar data, pricing summary, availability windows
}

export interface DistributionConfig {
  /** Origin base URL for the Hostaway API */
  hostawayBaseUrl: string;
  /** KV TTL in seconds for cached property data */
  cacheTtlSeconds: number;
  /** Whether to include write tools in distribution */
  readonly: boolean;
}
