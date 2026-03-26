import { describe, expect, test } from "vitest";

import hostRepliedAfterFixture from "../../fixtures/hostaway/messages/host-replied-after.json" with { type: "json" };
import needsAttentionFixture from "../../fixtures/hostaway/messages/needs-attention.json" with { type: "json" };

import {
  deriveThreadAttention,
  latestGuestMessageTimestamp,
  hostRepliedAfterLatestGuestMessage
} from "../../src/hostaway/attention.js";

describe("thread attention heuristics", () => {
  test("detects the latest guest message timestamp", () => {
    expect(latestGuestMessageTimestamp(needsAttentionFixture)).toBe("2026-07-01T12:15:00Z");
  });

  test("detects when the host replied after the latest guest message", () => {
    expect(hostRepliedAfterLatestGuestMessage(needsAttentionFixture)).toBe(false);
    expect(hostRepliedAfterLatestGuestMessage(hostRepliedAfterFixture)).toBe(true);
  });

  test("derives needs_attention from guest-last plus host-replied-after heuristic", () => {
    expect(deriveThreadAttention(needsAttentionFixture)).toMatchObject({
      hostRepliedAfterLatestGuestMessage: false,
      needsAttention: true
    });

    expect(deriveThreadAttention(hostRepliedAfterFixture)).toMatchObject({
      hostRepliedAfterLatestGuestMessage: true,
      needsAttention: false
    });
  });
});
