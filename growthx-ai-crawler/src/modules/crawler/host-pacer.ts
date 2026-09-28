/** Longest gap honoured, however slow a site's robots.txt asks us to be. */
export const MAX_GAP_MS = 10_000;

/**
 * Spaces this process's requests to one website at least `gapMs` apart.
 *
 * Every crawl carries a `rateLimitDelayMs` — the site's own setting, or the
 * slower of that and the caller's — and until this existed nothing waited on
 * it: page workers asked for the next page the moment they were free. Small
 * sites' hosting reads that as an attack and starts answering 429 and 403, so
 * a competitor crawl stored 300 attempts of which 16 were pages.
 *
 * Each caller reserves the next free slot for the host before it sleeps, so
 * concurrent workers queue behind one another instead of all waking together.
 * Per process: one instance serves every worker in this process, which on a
 * single-instance deployment is every worker there is.
 */
export class HostPacer {
  private readonly nextFree = new Map<string, number>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async wait(host: string, gapMs: number | undefined): Promise<void> {
    if (!gapMs || gapMs <= 0) return;
    const gap = Math.min(gapMs, MAX_GAP_MS);
    const now = this.now();
    const slot = Math.max(now, this.nextFree.get(host) ?? 0);
    this.nextFree.set(host, slot + gap);
    if (this.nextFree.size > 1000) this.forgetIdle(now);
    if (slot > now) await this.sleep(slot - now);
  }

  /** Hosts whose next slot has already passed carry no state worth keeping. */
  private forgetIdle(now: number): void {
    for (const [host, next] of this.nextFree) {
      if (next <= now) this.nextFree.delete(host);
    }
  }
}
