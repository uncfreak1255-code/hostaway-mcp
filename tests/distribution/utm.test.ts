import { describe, expect, test } from "vitest";

import { buildBookingUrl } from "../../src/distribution/utm.js";

describe("buildBookingUrl", () => {
  test("builds URL with all params", () => {
    const url = buildBookingUrl("palma-sola-paradise", {
      checkin: "2026-06-01",
      checkout: "2026-06-05",
      guests: 4,
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://seascapevacations.com");
    expect(parsed.pathname).toBe("/listing/palma-sola-paradise");
    expect(parsed.searchParams.get("utm_source")).toBe("mcp");
    expect(parsed.searchParams.get("utm_medium")).toBe("claude");
    expect(parsed.searchParams.get("ref")).toBe("mcp-distribution");
    expect(parsed.searchParams.get("checkin")).toBe("2026-06-01");
    expect(parsed.searchParams.get("checkout")).toBe("2026-06-05");
    expect(parsed.searchParams.get("guests")).toBe("4");
  });

  test("builds URL without optional params", () => {
    const url = buildBookingUrl("bradenton-beach-bungalow");

    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/listing/bradenton-beach-bungalow");
    expect(parsed.searchParams.get("utm_source")).toBe("mcp");
    expect(parsed.searchParams.get("utm_medium")).toBe("claude");
    expect(parsed.searchParams.get("ref")).toBe("mcp-distribution");
    expect(parsed.searchParams.has("checkin")).toBe(false);
    expect(parsed.searchParams.has("checkout")).toBe(false);
    expect(parsed.searchParams.has("guests")).toBe(false);
  });

  test("encodes special characters", () => {
    const url = buildBookingUrl("test property & more");

    const parsed = new URL(url);
    // URL constructor normalizes & in the path segment (no double-encoding)
    expect(parsed.pathname).toBe("/listing/test%20property%20&%20more");
    expect(parsed.searchParams.get("utm_source")).toBe("mcp");
  });
});
