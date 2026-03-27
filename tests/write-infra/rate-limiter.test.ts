import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { WriteRateLimiter } from "../../src/write-infra/rate-limiter.js";

describe("WriteRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("allows up to maxTokens burst requests", () => {
    const limiter = new WriteRateLimiter({ maxTokens: 10, refillIntervalMs: 60_000 });

    for (let i = 0; i < 10; i++) {
      expect(limiter.tryConsume()).toBe(true);
    }

    // 11th should fail
    expect(limiter.tryConsume()).toBe(false);
  });

  test("rejects after burst is exhausted", () => {
    const limiter = new WriteRateLimiter({ maxTokens: 3, refillIntervalMs: 60_000 });

    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
    expect(limiter.tryConsume()).toBe(false);
  });

  test("refills tokens proportionally over time", () => {
    const limiter = new WriteRateLimiter({ maxTokens: 10, refillIntervalMs: 60_000 });

    // Exhaust all tokens
    for (let i = 0; i < 10; i++) {
      limiter.tryConsume();
    }
    expect(limiter.tryConsume()).toBe(false);

    // Advance 30 seconds — should refill 5 tokens (half of 10)
    vi.advanceTimersByTime(30_000);
    expect(limiter.availableTokens()).toBe(5);

    // Consume 5
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume()).toBe(true);
    }
    expect(limiter.tryConsume()).toBe(false);
  });

  test("refills fully after one complete interval", () => {
    const limiter = new WriteRateLimiter({ maxTokens: 10, refillIntervalMs: 60_000 });

    // Exhaust all tokens
    for (let i = 0; i < 10; i++) {
      limiter.tryConsume();
    }

    // Advance full minute
    vi.advanceTimersByTime(60_000);
    expect(limiter.availableTokens()).toBe(10);
  });

  test("never exceeds maxTokens even after long idle period", () => {
    const limiter = new WriteRateLimiter({ maxTokens: 10, refillIntervalMs: 60_000 });

    // Advance 10 minutes without using any
    vi.advanceTimersByTime(600_000);
    expect(limiter.availableTokens()).toBe(10);
  });

  test("uses default 10 tokens per 60 seconds when no options provided", () => {
    const limiter = new WriteRateLimiter();

    for (let i = 0; i < 10; i++) {
      expect(limiter.tryConsume()).toBe(true);
    }
    expect(limiter.tryConsume()).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(limiter.availableTokens()).toBe(10);
  });
});
