import { analyticsConnected, keywordInSearchConsole, searchConsoleConnected } from './search-console-facts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-29T12:00:00.000Z');

/**
 * What a project may be told is connected. Both checks read the property the
 * customer chose, not merely that they signed in: authorised but not yet usable
 * is a real state, and treating it as connected shows a page of nothing.
 */
describe('connections', () => {
  const build = (integrations: Record<string, { selectedResourceId: string | null } | undefined>) =>
    ({
      integration: {
        findUnique: jest.fn(async ({ where }: any) => integrations[where.projectId_provider.provider] ?? null),
      },
    }) as any;

  it('counts Search Console as connected once a property is chosen', async () => {
    const prisma = build({ search_console: { selectedResourceId: 'sc-domain:milquu.in' } });
    expect(await searchConsoleConnected(prisma, 'p1')).toBe(true);
    expect(prisma.integration.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId_provider: { projectId: 'p1', provider: 'search_console' } } }),
    );
  });

  it('counts Google Analytics 4 as connected once a property is chosen', async () => {
    const prisma = build({ analytics: { selectedResourceId: 'properties/123' } });
    expect(await analyticsConnected(prisma, 'p1')).toBe(true);
    expect(prisma.integration.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId_provider: { projectId: 'p1', provider: 'analytics' } } }),
    );
  });

  it('does not count a connection that has not been finished, or one that does not exist', async () => {
    const authorised = build({ search_console: { selectedResourceId: null }, analytics: { selectedResourceId: null } });
    expect(await searchConsoleConnected(authorised, 'p1')).toBe(false);
    expect(await analyticsConnected(authorised, 'p1')).toBe(false);

    const none = build({});
    expect(await searchConsoleConnected(none, 'p1')).toBe(false);
    expect(await analyticsConnected(none, 'p1')).toBe(false);
  });

  it('keeps the two apart: Search Console does not vouch for Analytics', async () => {
    const prisma = build({ search_console: { selectedResourceId: 'sc-domain:milquu.in' } });
    expect(await analyticsConnected(prisma, 'p1')).toBe(false);
  });
});

describe('keywordInSearchConsole', () => {
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime()));
  afterEach(() => jest.restoreAllMocks());

  // The database does the case-insensitive matching, so the search goes in as typed.
  const search = { equals: 'A2 Milk', mode: 'insensitive' };
  const build = (connected: boolean, rows: any[] = []) => {
    const prisma = {
      integration: { findUnique: jest.fn(async () => (connected ? { selectedResourceId: 'sc-domain:milquu.in' } : null)) },
      gscDailyMetric: { findMany: jest.fn(async ({ where }: any) => rows.filter((r) => r.grain === where.grain)) },
    };
    return prisma;
  };

  it('is silent, not empty, when Search Console is not connected', async () => {
    const prisma = build(false);
    expect(await keywordInSearchConsole(prisma as any, 'p1', 'a2 milk')).toBeNull();
    expect(prisma.gscDailyMetric.findMany).not.toHaveBeenCalled();
  });

  it('reads the last 28 days by default, with no upper bound, as it always has', async () => {
    const prisma = build(true);
    await keywordInSearchConsole(prisma as any, 'p1', 'A2 Milk');

    const [query, queryPage] = prisma.gscDailyMetric.findMany.mock.calls.map(([arg]: any) => arg.where);
    expect(query).toEqual({ projectId: 'p1', grain: 'QUERY', query: search, date: { gte: new Date(NOW.getTime() - 28 * DAY) } });
    expect(queryPage).toMatchObject({ grain: 'QUERY_PAGE', date: { gte: new Date(NOW.getTime() - 28 * DAY) } });
  });

  it('reads the 28 days before those when asked, closed at the start of the latest 28', async () => {
    const prisma = build(true);
    await keywordInSearchConsole(prisma as any, 'p1', 'a2 milk', 28, 28);

    const windows = prisma.gscDailyMetric.findMany.mock.calls.map(([arg]: any) => arg.where.date);
    for (const date of windows) {
      expect(date).toEqual({ gte: new Date(NOW.getTime() - 56 * DAY), lt: new Date(NOW.getTime() - 28 * DAY) });
    }
  });

  it('adds a search up by impression, and finds the pages Google showed for it', async () => {
    const prisma = build(true, [
      { grain: 'QUERY', clicks: 10, impressions: 100, position: 4 },
      { grain: 'QUERY', clicks: 0, impressions: 300, position: 12 },
      { grain: 'QUERY_PAGE', page: 'https://milquu.in/a', clicks: 10, impressions: 100, position: 4 },
      { grain: 'QUERY_PAGE', page: 'https://milquu.in/b/', clicks: 0, impressions: 200, position: 12 },
      { grain: 'QUERY_PAGE', page: 'https://www.milquu.in/b', clicks: 0, impressions: 100, position: 12 },
    ]);

    const facts = await keywordInSearchConsole(prisma as any, 'p1', 'a2 milk');

    // Position is weighted by impressions: (4×100 + 12×300) / 400 = 10, not the plain mean of 8.
    expect(facts).toMatchObject({ clicks: 10, impressions: 400, position: 10, ctr: 0.025 });
    // The same page spelled two ways is one page, and the one shown most comes first.
    expect(facts!.pages).toHaveLength(2);
    expect(facts!.pages[0]).toMatchObject({ impressions: 300, position: 12 });
    expect(facts!.pages[1]).toMatchObject({ url: 'https://milquu.in/a', impressions: 100 });
  });
});
