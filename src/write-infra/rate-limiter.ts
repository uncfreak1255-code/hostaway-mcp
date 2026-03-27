/**
 * In-process token bucket rate limiter for write operations.
 * Max 10 write operations per minute, shared across all write tools.
 */
export class WriteRateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private lastRefillTime: number;

  constructor(options?: { maxTokens?: number; refillIntervalMs?: number }) {
    this.maxTokens = options?.maxTokens ?? 10;
    this.refillIntervalMs = options?.refillIntervalMs ?? 60_000;
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
  }

  /**
   * Attempt to consume one token. Returns true if allowed, false if rate limited.
   * Refills tokens proportionally based on elapsed time since last refill.
   */
  tryConsume(): boolean {
    this.refill();

    if (this.tokens < 1) {
      return false;
    }

    this.tokens -= 1;
    return true;
  }

  /** Returns the number of tokens currently available. */
  availableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;

    if (elapsed <= 0) {
      return;
    }

    const tokensToAdd = (elapsed / this.refillIntervalMs) * this.maxTokens;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }
}
