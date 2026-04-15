export function buildBookingUrl(
  listingSlug: string,
  opts?: { checkin?: string; checkout?: string; guests?: number }
): string {
  const base = `https://seascapevacations.com/listing/${listingSlug}`;
  const params = new URLSearchParams({
    utm_source: "mcp",
    utm_medium: "claude",
    ref: "mcp-distribution",
  });
  if (opts?.checkin) params.set("checkin", opts.checkin);
  if (opts?.checkout) params.set("checkout", opts.checkout);
  if (opts?.guests) params.set("guests", String(opts.guests));
  return `${base}?${params}`;
}
