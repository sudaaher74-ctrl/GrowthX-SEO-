import { SearchRankingsService } from './search-rankings.service';

const range = { start: new Date('2026-08-31'), end: new Date('2026-09-27') };

/**
 * The rankings table is the first thing a customer sees on the Google Search
 * page. The quiet failures are the ones that look like success: a join that
 * matches no page and shows every page as having no visits, or a "not
 * connected" that reads like "connected, and nobody visits".
 */
describe('SearchRankingsService', () => {
  const table = (rows: any[], over: any = {}) => ({
    range,
    comparisonRange: { start: new Date('2026-08-03'), end: new Date('2026-08-30') },
    searches: rows.length,
    top3: 0,
    pageOne: 1,
    pageTwo: 0,
    beyond: 0,
    movedUp: 0,
    movedDown: 1,
    rows,
    ...over,
  });
  const row = (query: string, over: any = {}) => ({
    query,
    position: 8.4,
    previousPosition: 5.1,
    movement: -3.3,
    clicks: 28,
    impressions: 869,
    ctr: 0.032,
    ...over,
  });

  function build(opts: { searchConsole?: boolean; analytics?: boolean; table?: any; pages?: Record<string, string>; visits?: Map<string, any> | null }) {
    const integrations: Record<string, boolean> = { search_console: opts.searchConsole ?? true, analytics: opts.analytics ?? true };
    const prisma = {
      integration: {
        findUnique: jest.fn(async ({ where }: any) => (integrations[where.projectId_provider.provider] ? { selectedResourceId: 'chosen' } : null)),
      },
    };
    const searchConsole = {
      queriesWithMovement: jest.fn(async () => (opts.table === undefined ? null : opts.table)),
      topPageForQueries: jest.fn(async () => new Map(Object.entries(opts.pages ?? {}))),
    };
    const analytics = { visitsByPage: jest.fn(async () => (opts.visits === undefined ? null : opts.visits)) };
    return { prisma, searchConsole, analytics, service: new SearchRankingsService(prisma as any, searchConsole as any, analytics as any) };
  }

  it('says it is not connected, and reads nothing, when no Search Console property is chosen', async () => {
    const { service, searchConsole, analytics } = build({ searchConsole: false, analytics: false, table: table([]) });

    expect(await service.report('p1')).toMatchObject({
      connected: false,
      analyticsConnected: false,
      hasData: false,
      summary: null,
      rows: [],
    });
    expect(searchConsole.queriesWithMovement).not.toHaveBeenCalled();
    expect(analytics.visitsByPage).not.toHaveBeenCalled();
  });

  it('tells connected-but-not-fetched apart from not connected', async () => {
    const { service } = build({ table: null });
    expect(await service.report('p1')).toMatchObject({ connected: true, hasData: false, rows: [], summary: null, range: null });
  });

  it('joins each search to the visits its page received, however the two systems spell the page', async () => {
    const { service } = build({
      table: table([row('a2 milk delivery near me'), row('benefits of a2 milk'), row('lonely page')]),
      pages: {
        'a2 milk delivery near me': 'https://milquu.in/products/a2-milk',
        'benefits of a2 milk': 'https://milquu.in/blog/why-a2/?utm_source=x',
        'lonely page': 'https://milquu.in/never-visited',
      },
      // GA4 reports a path; Search Console reports a URL.
      visits: new Map([
        ['/products/a2-milk', { sessions: 2031, engagementRate: 0.71, conversions: 90 }],
        ['/blog/why-a2', { sessions: 988, engagementRate: 0.4, conversions: null }],
      ]),
    });

    const report = await service.report('p1');

    const byQuery = Object.fromEntries(report.rows.map((r) => [r.query, r]));
    expect(byQuery['a2 milk delivery near me'].visits).toEqual({ sessions: 2031, conversions: 90 });
    // Not tracking conversions is passed on as such, not as zero.
    expect(byQuery['benefits of a2 milk'].visits).toEqual({ sessions: 988, conversions: null });
    // A page Analytics never saw has no visits to show: not a made-up zero.
    expect(byQuery['lonely page'].visits).toBeNull();
    expect(report).toMatchObject({ connected: true, analyticsConnected: true, hasData: true, analyticsHasData: true });
  });

  it('carries the counts, the range and the movement through untouched', async () => {
    const { service } = build({ table: table([row('x')], { searches: 40, top3: 3, pageOne: 12, pageTwo: 20, beyond: 5, movedUp: 7, movedDown: 2 }), pages: { x: 'https://milquu.in/' } });

    const report = await service.report('p1', { days: 28 });

    expect(report.summary).toEqual({ searches: 40, top3: 3, pageOne: 12, pageTwo: 20, beyond: 5, movedUp: 7, movedDown: 2 });
    expect(report.range).toEqual(range);
    expect(report.rows[0]).toMatchObject({ position: 8.4, previousPosition: 5.1, movement: -3.3, page: 'https://milquu.in/' });
  });

  it('leaves visits blank, and does not ask Analytics, when Analytics is not connected', async () => {
    const { service, analytics } = build({ analytics: false, table: table([row('x')]), pages: { x: 'https://milquu.in/a' }, visits: new Map([['/a', { sessions: 5, engagementRate: 1, conversions: 0 }]]) });

    const report = await service.report('p1');

    expect(analytics.visitsByPage).not.toHaveBeenCalled();
    expect(report.rows[0].visits).toBeNull();
    expect(report).toMatchObject({ analyticsConnected: false, analyticsHasData: false });
  });

  it('says Analytics is connected but has synced nothing yet, rather than that pages have no visits', async () => {
    const { service } = build({ table: table([row('x')]), pages: { x: 'https://milquu.in/a' }, visits: null });
    expect(await service.report('p1')).toMatchObject({ analyticsConnected: true, analyticsHasData: false });
  });

  it('asks for the window and the number of searches it was given, and finds pages over the same window', async () => {
    const { service, searchConsole } = build({ table: table([row('x')]) });

    await service.report('p1', { days: 90, limit: 40 });

    expect(searchConsole.queriesWithMovement).toHaveBeenCalledWith('p1', { days: 90, limit: 40 });
    expect(searchConsole.topPageForQueries).toHaveBeenCalledWith('p1', ['x'], { days: 90 });
  });

  it('reports a search with no page Google is known to show as having none', async () => {
    const { service } = build({ table: table([row('orphan')]), pages: {}, visits: new Map() });
    expect((await service.report('p1')).rows[0]).toMatchObject({ page: null, visits: null });
  });
});
