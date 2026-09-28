import { computeGaps, sharedGaps } from './keyword-gap.service';

const kw = (keyword: string, position: number, searchVolume: number | null = 100) => ({ keyword, position, searchVolume, url: `https://rival.in/${keyword.replace(/ /g, '-')}`, intent: null });

describe('computeGaps', () => {
  it('lists what they rank for and you do not, most searched first', () => {
    const rows = computeGaps([kw('cow milk', 3, 500), kw('a2 ghee', 5, 2400), kw('buffalo milk', 8, 900)], [kw('cow milk', 2)], new Map());
    expect(rows.map((r) => [r.keyword, r.status])).toEqual([
      ['a2 ghee', 'MISSING'],
      ['buffalo milk', 'MISSING'],
    ]);
  });

  it('never calls a search missing when Search Console shows you appear for it', () => {
    const rows = computeGaps([kw('a2 ghee', 5)], [], new Map([['a2 ghee', 7.4]]));
    expect(rows).toEqual([]);
  });

  it('flags a search you rank for far below them as behind, with where each of you stands', () => {
    const rows = computeGaps([kw('A2 Ghee', 4)], [], new Map([['a2 ghee', 34.6]]));
    expect(rows).toEqual([expect.objectContaining({ keyword: 'A2 Ghee', status: 'BEHIND', ownPosition: 35, ownSource: 'SEARCH_CONSOLE', competitorPosition: 4 })]);
  });

  it('prefers your Google ranking over Search Console when both exist', () => {
    const rows = computeGaps([kw('a2 ghee', 2)], [kw('a2 ghee', 41)], new Map([['a2 ghee', 12]]));
    expect(rows[0]).toMatchObject({ ownPosition: 41, ownSource: 'GOOGLE_RANKINGS', status: 'BEHIND' });
  });
});

describe('sharedGaps', () => {
  it('keeps the searches two or more competitors win and you are missing', () => {
    const shared = sharedGaps([
      { domain: 'a.in', rows: computeGaps([kw('a2 ghee', 3, 2400), kw('paneer', 2, 800)], [], new Map()) },
      { domain: 'b.in', rows: computeGaps([kw('A2 ghee', 6, 2400)], [], new Map()) },
    ]);
    expect(shared).toEqual([
      {
        keyword: 'a2 ghee',
        searchVolume: 2400,
        competitors: [
          { domain: 'a.in', position: 3, url: 'https://rival.in/a2-ghee' },
          { domain: 'b.in', position: 6, url: 'https://rival.in/A2-ghee' },
        ],
      },
    ]);
  });
});
