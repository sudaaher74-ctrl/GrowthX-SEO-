import { demandPromptLines, indexSearches, measure, MeasuredSearch, searchKey, SearchDemand } from './search-demand';
import { SearchDemandService } from './search-demand.service';

const s = (query: string, impressions: number, clicks: number, position: number, page: string | null = null): MeasuredSearch => ({
  query,
  impressions,
  clicks,
  position,
  page,
});

describe('matching a suggested phrase to a real search', () => {
  it('matches the same words in any order, case and punctuation aside', () => {
    expect(searchKey('A2 Cow-Milk, Pune!')).toBe(searchKey('pune a2 cow milk'));
  });

  it('gives Google\'s numbers only for the same search, never a near one', () => {
    const index = indexSearches([s('a2 cow milk pune', 340, 12, 14.26, 'https://x.in/a2')]);
    expect(measure('Pune A2 cow milk', index)).toEqual({ impressions: 340, clicks: 12, position: 14.3, days: 28, page: 'https://x.in/a2' });
    // One word more is a different search, with numbers nobody measured.
    expect(measure('a2 cow milk pune price', index)).toBeNull();
    expect(measure('a2 milk pune', index)).toBeNull();
  });

  it('keeps the more-seen spelling when two searches have the same words', () => {
    const index = indexSearches([s('milk a2', 5, 0, 30), s('a2 milk', 90, 4, 12)]);
    expect(measure('a2 milk', index)?.impressions).toBe(90);
  });
});

describe('demandPromptLines', () => {
  const demand: SearchDemand = {
    status: 'OK',
    days: 28,
    range: { start: '2026-08-31', end: '2026-09-27' },
    topSearches: [s('milquufresh', 900, 210, 1.2, 'https://x.in/')],
    almostWinning: [s('a2 cow milk pune', 340, 12, 14.26, 'https://x.in/a2')],
  };

  it('lists the real searches with their numbers and the page Google shows', () => {
    const lines = demandPromptLines(demand, (u) => new URL(u).pathname);
    expect(lines).toContain('last 28 days');
    expect(lines).toContain('- "a2 cow milk pune": shown 340 times, 12 clicks, average position 14.3, page /a2');
    expect(lines).toContain('SEARCHES IT ALMOST WINS');
  });

  it('adds nothing when there is no data', () => {
    expect(demandPromptLines({ ...demand, status: 'NOT_CONNECTED', topSearches: [], almostWinning: [] })).toBe('');
  });
});

describe('SearchDemandService', () => {
  function build({ integration = { status: 'CONNECTED' } as { status: string } | null, coverage = { newestDate: new Date('2026-09-27'), oldestDate: new Date('2026-06-01') } as any } = {}) {
    const prisma = { integration: { findUnique: jest.fn().mockResolvedValue(integration) } };
    const insights = {
      coverage: jest.fn().mockResolvedValue(coverage),
      top: jest.fn().mockResolvedValue([
        { key: 'milquufresh', clicks: 210, impressions: 900, ctr: 0.23, position: 1.2 },
        { key: 'a2 cow milk pune', clicks: 12, impressions: 340, ctr: 0.03, position: 14.3 },
        { key: 'paneer near me', clicks: 0, impressions: 6, ctr: 0, position: 11 },
        { key: 'ghee price', clicks: 0, impressions: 50, ctr: 0, position: 42 },
      ]),
      topPageForQueries: jest.fn().mockResolvedValue(new Map([['a2 cow milk pune', 'https://x.in/a2']])),
    };
    return { service: new SearchDemandService(prisma as any, insights as any), insights };
  }

  it('says Search Console is not connected, rather than showing zeros', async () => {
    const { service } = build({ integration: null, coverage: null });
    expect(await service.forProject('p')).toMatchObject({ status: 'NOT_CONNECTED', topSearches: [], almostWinning: [] });
  });

  it('tells "connected, no data yet" apart from "needs attention"', async () => {
    expect((await build({ coverage: null }).service.forProject('p')).status).toBe('NO_DATA_YET');
    expect((await build({ integration: { status: 'NEEDS_REAUTH' }, coverage: null }).service.forProject('p')).status).toBe('NEEDS_ATTENTION');
  });

  it('lists searches just off page one that enough people saw, with the page Google shows', async () => {
    const demand = await build().service.forProject('p');
    expect(demand.status).toBe('OK');
    expect(demand.range).toEqual({ start: '2026-08-31', end: '2026-09-27' });
    // Position 1.2 is already won, 6 impressions is noise, position 42 is not close.
    expect(demand.almostWinning).toEqual([{ query: 'a2 cow milk pune', impressions: 340, clicks: 12, position: 14.3, page: 'https://x.in/a2' }]);
    expect(demand.topSearches.map((t) => t.query)).toEqual(['milquufresh', 'a2 cow milk pune', 'paneer near me', 'ghee price']);
  });

  it('never throws; a failure reads as no data', async () => {
    const { service, insights } = build();
    insights.top.mockRejectedValue(new Error('db down'));
    expect((await service.forProject('p')).status).toBe('NO_DATA_YET');
  });
});
