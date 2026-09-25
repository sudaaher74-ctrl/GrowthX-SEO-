import { CrawlPage, mergeMoves, movesFromCrawls, movesFromSnapshots, SnapshotRow } from './rival-moves';
import { RivalMovesService } from './rival-moves.service';

const rival = { name: 'Country Delight', domain: 'countrydelight.in' };
const day = (d: number) => new Date(Date.UTC(2026, 8, d, 3));
const snap = (url: string, d: number, extra: Partial<SnapshotRow> = {}): SnapshotRow => ({
  url,
  statusCode: 200,
  title: 'Cow milk',
  h1: null,
  schemaTypes: [],
  wordCount: 400,
  capturedAt: day(d),
  ...extra,
});

describe('movesFromSnapshots', () => {
  const since = day(1);

  it('treats the first check of a domain as a baseline, not a burst of new pages', () => {
    const moves = movesFromSnapshots([snap('https://countrydelight.in/a', 2), snap('https://countrydelight.in/b', 2)], rival, since);
    expect(moves).toEqual([]);
  });

  it('reports a page that appears after the baseline as new', () => {
    const moves = movesFromSnapshots(
      [snap('https://countrydelight.in/a', 2), snap('https://countrydelight.in/a2-milk', 10, { title: 'A2 milk' })],
      rival,
      since,
    );
    expect(moves).toMatchObject([{ kind: 'NEW_PAGE', url: 'https://countrydelight.in/a2-milk', title: 'A2 milk', source: 'daily-check' }]);
  });

  it('reports new headlines, new Google details, bigger pages and removed pages', () => {
    const u = 'https://countrydelight.in/a';
    const moves = movesFromSnapshots(
      [
        snap(u, 2),
        snap(u, 5, { title: 'Cow milk delivery in Pune', schemaTypes: ['FAQPage'], wordCount: 900 }),
        snap(u, 9, { statusCode: 404, title: null }),
      ],
      rival,
      since,
    );
    expect(moves.map((m) => m.kind).sort()).toEqual(['EXPANDED', 'PAGE_GONE', 'RETITLED', 'SCHEMA_ADDED']);
    expect(moves.find((m) => m.kind === 'RETITLED')).toMatchObject({ from: 'Cow milk', to: 'Cow milk delivery in Pune' });
    expect(moves.find((m) => m.kind === 'SCHEMA_ADDED')?.added).toEqual(['FAQPage']);
    expect(moves.find((m) => m.kind === 'EXPANDED')?.words).toEqual({ from: 400, to: 900 });
    expect(moves.find((m) => m.kind === 'PAGE_GONE')?.title).toBe('Cow milk delivery in Pune');
  });

  it('ignores small edits and anything older than the window', () => {
    const u = 'https://countrydelight.in/a';
    expect(movesFromSnapshots([snap(u, 2), snap(u, 5, { wordCount: 450 })], rival, since)).toEqual([]);
    expect(movesFromSnapshots([snap(u, 2), snap(u, 5, { title: 'New' })], rival, day(6))).toEqual([]);
  });
});

describe('movesFromCrawls', () => {
  const page = (k: string, title = k): CrawlPage => ({ key: k, url: `https://countrydelight.in/${k}`, title });
  const map = (pages: CrawlPage[]) => new Map(pages.map((p) => [p.key, p]));
  const base = Array.from({ length: 40 }, (_, i) => page(`p${i}`));

  it('reports added, removed and retitled pages', () => {
    const latest = map([...base.slice(1), page('p1', 'Renamed'), page('new')]);
    const moves = movesFromCrawls(latest, map(base), rival, day(10));
    expect(moves.map((m) => `${m.kind}:${m.url?.split('/').pop()}`).sort()).toEqual(['NEW_PAGE:new', 'PAGE_GONE:p0', 'RETITLED:p1']);
  });

  it('keeps quiet when a crawl simply reached many more pages', () => {
    const latest = map([...base, ...Array.from({ length: 30 }, (_, i) => page(`extra${i}`))]);
    expect(movesFromCrawls(latest, map(base), rival, day(10))).toEqual([]);
  });
});

describe('mergeMoves', () => {
  it('shows one change seen by both the daily check and a crawl once, newest first', () => {
    const a = { id: '1', kind: 'NEW_PAGE' as const, rival: 'R', rivalDomain: 'r.in', url: 'https://www.r.in/x/', title: null, at: day(5).toISOString(), source: 'daily-check' as const };
    const b = { ...a, id: '2', url: 'https://r.in/x', source: 'crawl' as const, at: day(4).toISOString() };
    const c = { ...a, id: '3', kind: 'RETITLED' as const, at: day(8).toISOString() };
    expect(mergeMoves([b, a, c], 10).map((m) => m.id)).toEqual(['3', '1']);
  });
});

describe('RivalMovesService.feed', () => {
  it('adds AI answers that named a competitor and not you', async () => {
    const prisma = {
      competitorDomain: { findMany: jest.fn().mockResolvedValue([{ domain: 'www.countrydelight.in', name: 'Country Delight', label: null, websiteId: null }]) },
      rivalPageSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
      crawlJob: { findMany: jest.fn() },
      page: { findMany: jest.fn() },
      promptCheck: {
        findMany: jest.fn().mockResolvedValue([
          { checkedAt: day(20), competitorsCited: ['countrydelight.in'], trackedPrompt: { text: 'best milk delivery in pune' } },
          { checkedAt: day(19), competitorsCited: ['countrydelight.in'], trackedPrompt: { text: 'best milk delivery in pune' } },
          { checkedAt: day(18), competitorsCited: ['other.in'], trackedPrompt: { text: 'a2 milk' } },
        ]),
      },
    };
    const res = await new RivalMovesService(prisma as any).feed('p1', day(25));
    expect(res.moves).toEqual([
      expect.objectContaining({ kind: 'AI_NAMED', rival: 'Country Delight', count: 2, questions: ['best milk delivery in pune'] }),
    ]);
    expect(res.watching).toEqual([{ name: 'Country Delight', domain: 'countrydelight.in', lastCheckedAt: null, lastCrawlAt: null, pagesRead: null, lastChangeAt: null }]);
    expect(prisma.promptCheck.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ cited: false }) }));
  });
});
