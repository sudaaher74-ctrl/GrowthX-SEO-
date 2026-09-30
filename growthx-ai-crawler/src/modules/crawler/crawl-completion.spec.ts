import { findAll, issueKey, responseStats } from './crawl-completion';

describe('findAll', () => {
  const table = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i).padStart(6, '0') }));

  /** Behaves like prisma's cursor paging: ordered by id, `skip: 1` steps past the cursor row. */
  const pager = (rows: { id: string }[]) =>
    jest.fn(async ({ take, skip, cursor }: { take: number; skip?: number; cursor?: { id: string } }) => {
      const start = cursor ? rows.findIndex((r) => r.id === cursor.id) + (skip ?? 0) : 0;
      return rows.slice(start, start + take);
    });

  it('returns a small table in one read', async () => {
    const find = pager(table(3));
    await expect(findAll(find)).resolves.toHaveLength(3);
    expect(find).toHaveBeenCalledTimes(1);
  });

  it('reads past the page size without dropping or repeating a row', async () => {
    const rows = table(25_000);
    const find = pager(rows);

    const all = await findAll(find);

    expect(all).toHaveLength(25_000);
    expect(new Set(all.map((r) => r.id)).size).toBe(25_000);
    expect(find).toHaveBeenCalledTimes(3);
  });

  it('reads an exact multiple of the page size and stops on the empty page', async () => {
    const find = pager(table(10_000));
    await expect(findAll(find)).resolves.toHaveLength(10_000);
    expect(find).toHaveBeenCalledTimes(2);
  });
});

describe('issueKey', () => {
  it('prefers the dedup key', () => {
    expect(issueKey({ dedupKey: 'k', issueType: 'T', affectedUrl: 'u' })).toBe('k');
  });

  it('falls back to page URL and type, then to the affected URL', () => {
    expect(issueKey({ issueType: 'T', page: { url: 'https://a.test/p' }, affectedUrl: 'x' })).toBe('https://a.test/p::T');
    expect(issueKey({ issueType: 'T', affectedUrl: 'https://a.test/q' })).toBe('https://a.test/q::T');
  });
});

describe('responseStats', () => {
  it('buckets status codes and averages only the pages that reported a time', () => {
    const stats = responseStats([
      { statusCode: 200, responseTimeMs: 100 },
      { statusCode: 404, responseTimeMs: 300 },
      { statusCode: null, responseTimeMs: null },
    ]);
    expect(stats.statusCodes).toEqual({ '2xx': 1, '4xx': 1, other: 1 });
    expect(stats.avgResponseTimeMs).toBe(200);
  });

  it('reports zero, not NaN, when no page has a time', () => {
    expect(responseStats([{ statusCode: 200, responseTimeMs: null }]).avgResponseTimeMs).toBe(0);
  });
});
