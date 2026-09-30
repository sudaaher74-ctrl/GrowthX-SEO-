const PAGE_SIZE = 10_000;

/**
 * Reads every row a query matches, PAGE_SIZE at a time.
 *
 * A finished crawl can hold tens of thousands of pages and issues, so they are
 * read in cursor pages, and the event loop gets a turn between pages so a large
 * crawl's summary does not stall the worker's other jobs.
 */
export async function findAll<T extends { id: string }>(
  findPage: (paging: { take: number; orderBy: { id: 'asc' }; skip?: number; cursor?: { id: string } }) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const batch = await findPage({
      take: PAGE_SIZE,
      orderBy: { id: 'asc' },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
    cursor = batch[batch.length - 1].id;
    await new Promise((resolve) => setImmediate(resolve));
  }
}

/** One issue is one defect on one page, however many times it was raised. */
export function issueKey(issue: { dedupKey?: string | null; issueType: string; affectedUrl?: string | null; page?: { url: string } | null }): string {
  return issue.dedupKey || `${issue.page?.url || issue.affectedUrl}::${issue.issueType}`;
}

/** Status-code buckets ("2xx", "other") and the mean response time over pages that reported one. */
export function responseStats(pages: { statusCode: number | null; responseTimeMs: number | null }[]) {
  const statusCodes: Record<string, number> = {};
  let total = 0;
  let timed = 0;
  for (const p of pages) {
    const bucket = p.statusCode ? `${Math.floor(p.statusCode / 100)}xx` : 'other';
    statusCodes[bucket] = (statusCodes[bucket] || 0) + 1;
    if (p.responseTimeMs && p.responseTimeMs > 0) {
      total += p.responseTimeMs;
      timed++;
    }
  }
  return { statusCodes, avgResponseTimeMs: timed > 0 ? Math.round(total / timed) : 0 };
}
