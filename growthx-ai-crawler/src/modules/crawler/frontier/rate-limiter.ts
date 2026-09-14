/**
 * A per-host token bucket.
 *
 * Politeness has to be per host, not per job: two crawls of the same site must
 * not each get the full rate, and one crawl of ten hosts should not be limited
 * to one host's rate. The previous crawler had only a fixed delay passed along
 * in the job payload, which each worker applied on its own, so the actual rate
 * against a host was the configured rate multiplied by the worker count.
 *
 * Refills continuously rather than on a timer, so nothing is scheduled and an
 * idle host costs nothing.
 */
export class HostRateLimiter {
  private readonly buckets = new Map<string, { tokens: number; lastRefillMs: number; ratePerSec: number; burst: number }>();

  constructor(
    private readonly defaultRatePerSec = Number(process.env.CRAWL_RATE_PER_SEC || 2),
    private readonly defaultBurst = Number(process.env.CRAWL_BURST || 2),
  ) {}

  /** Applies a host's own Crawl-delay, which always wins if it is slower. */
  setHostRate(host: string, ratePerSec: number, burst = 1): void {
    const existing = this.buckets.get(host);
    const rate = Math.max(0.01, ratePerSec);
    if (existing) {
      existing.ratePerSec = Math.min(existing.ratePerSec, rate);
      existing.burst = Math.min(existing.burst, burst);
      existing.tokens = Math.min(existing.tokens, existing.burst);
      return;
    }
    this.buckets.set(host, { tokens: burst, lastRefillMs: Date.now(), ratePerSec: rate, burst });
  }

  /** Applies a Crawl-delay in milliseconds, as robots.txt expresses it. */
  setHostCrawlDelay(host: string, crawlDelayMs: number): void {
    if (!crawlDelayMs || crawlDelayMs <= 0) return;
    this.setHostRate(host, 1000 / crawlDelayMs, 1);
  }

  private bucketFor(host: string) {
    let bucket = this.buckets.get(host);
    if (!bucket) {
      bucket = { tokens: this.defaultBurst, lastRefillMs: Date.now(), ratePerSec: this.defaultRatePerSec, burst: this.defaultBurst };
      this.buckets.set(host, bucket);
    }
    return bucket;
  }

  /** How long to wait before the next request to this host may go out. */
  delayForNext(host: string, now = Date.now()): number {
    const bucket = this.bucketFor(host);
    const elapsedSec = Math.max(0, now - bucket.lastRefillMs) / 1000;
    const tokens = Math.min(bucket.burst, bucket.tokens + elapsedSec * bucket.ratePerSec);
    if (tokens >= 1) return 0;
    return Math.ceil(((1 - tokens) / bucket.ratePerSec) * 1000);
  }

  /** Blocks until this host may be hit again, then spends a token. */
  async acquire(host: string): Promise<void> {
    for (;;) {
      const now = Date.now();
      const bucket = this.bucketFor(host);
      const elapsedSec = Math.max(0, now - bucket.lastRefillMs) / 1000;
      bucket.tokens = Math.min(bucket.burst, bucket.tokens + elapsedSec * bucket.ratePerSec);
      bucket.lastRefillMs = now;

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil(((1 - bucket.tokens) / bucket.ratePerSec) * 1000);
      await new Promise((resolve) => setTimeout(resolve, Math.max(10, waitMs)));
    }
  }

  /** Backs a host off after it said 429 or 503, honouring Retry-After. */
  backOff(host: string, attempt: number, retryAfterSeconds?: number): number {
    const base = retryAfterSeconds !== undefined ? retryAfterSeconds * 1000 : Math.min(60000, 1000 * 2 ** Math.max(0, attempt));
    const bucket = this.bucketFor(host);
    // Halve the sustained rate as well as waiting: a host that is shedding load
    // is telling us our steady rate is too high, not just that this one request
    // came too soon.
    bucket.ratePerSec = Math.max(0.05, bucket.ratePerSec / 2);
    bucket.tokens = 0;
    bucket.lastRefillMs = Date.now() + base;
    return base;
  }
}
