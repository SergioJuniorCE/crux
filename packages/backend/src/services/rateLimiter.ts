/**
 * Token-bucket rate limiter for Riot API requests.
 *
 * Usage:
 *   const limiter = new RateLimiter({ capacity: 20, refillPerSec: 20 });
 *   await limiter.acquire(); // blocks until a token is available
 *
 * Preset:
 *   RateLimiter.dev()   — 20 req/s, burst 100 (development key)
 *   RateLimiter.prod()  — 500 req/10s, burst 30,000 (production key)
 */

export type RateLimiterConfig = {
  /** Maximum number of tokens the bucket can hold (burst capacity) */
  capacity: number;
  /** Tokens added per second */
  refillPerSec: number;
};

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillIntervalMs: number;
  private readonly refillAmount: number;

  private waiting: Array<{ resolve: () => void; timer: ReturnType<typeof setTimeout> }> = [];
  private processing = false;

  constructor(config: RateLimiterConfig) {
    this.capacity = config.capacity;
    this.tokens = config.capacity;
    this.lastRefill = Date.now();

    // Refill 1 token every (1000 / refillPerSec) ms
    this.refillIntervalMs = 1000 / config.refillPerSec;
    this.refillAmount = 1;
  }

  /** Dev key: 20 req/s, burst 100 per 2 minutes */
  static dev(): RateLimiter {
    return new RateLimiter({ capacity: 100, refillPerSec: 20 });
  }

  /** Production key: 500 req/10s, burst 30,000 per 10 minutes */
  static prod(): RateLimiter {
    return new RateLimiter({ capacity: 500, refillPerSec: 50 });
  }

  /**
   * Acquire a token, blocking until one is available.
   * Resolves immediately if tokens remain.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // No tokens available — queue
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.removeWaiting(resolve);
        resolve();
      }, 30_000); // safety timeout

      this.waiting.push({ resolve, timer });
      if (!this.processing) {
        this.processing = true;
        this.processQueue();
      }
    });
  }

  /**
   * Check how many tokens are available without consuming one.
   */
  peek(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Get the time in ms until the next token becomes available (0 if tokens remain).
   */
  timeUntilNext(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return this.refillIntervalMs - (Date.now() - this.lastRefill);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;

    const newTokens = Math.floor(elapsed / this.refillIntervalMs);
    if (newTokens > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + newTokens);
      this.lastRefill = now - (elapsed % this.refillIntervalMs);
    }
  }

  private processQueue(): void {
    if (this.waiting.length === 0) {
      this.processing = false;
      return;
    }

    this.refill();

    while (this.waiting.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      const next = this.waiting.shift()!;
      clearTimeout(next.timer);
      next.resolve();
    }

    if (this.waiting.length > 0) {
      const delay = Math.max(0, this.timeUntilNext());
      setTimeout(() => this.processQueue(), delay + 1);
    } else {
      this.processing = false;
    }
  }

  private removeWaiting(resolve: () => void): void {
    this.waiting = this.waiting.filter((w) => w.resolve !== resolve);
  }
}
