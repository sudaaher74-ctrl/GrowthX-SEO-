import { findOvertakes, placements, Standing } from './rank-tracking.service';

const at = (iso: string) => new Date(iso);
function standing(own: number | null, competitors: Record<string, number>, when = '2026-09-21'): Standing {
  return {
    checkedAt: at(when),
    own,
    competitors: Object.fromEntries(Object.entries(competitors).map(([d, p]) => [d, { position: p, url: `https://${d}/p` }])),
  };
}

describe('findOvertakes', () => {
  it('finds a competitor that moved from below you to above you', () => {
    const { lost, won } = findOvertakes('a2 milk pune', standing(4, { 'cd.in': 7 }), standing(6, { 'cd.in': 3 }, '2026-09-28'));
    expect(won).toEqual([]);
    expect(lost).toEqual([
      {
        keyword: 'a2 milk pune',
        competitor: 'cd.in',
        before: { own: 4, competitor: 7, checkedAt: at('2026-09-21') },
        now: { own: 6, competitor: 3, checkedAt: at('2026-09-28') },
        competitorUrl: 'https://cd.in/p',
      },
    ]);
  });

  it('counts a competitor arriving from outside the results, straight above you', () => {
    expect(findOvertakes('k', standing(8, {}), standing(9, { 'cd.in': 5 })).lost).toHaveLength(1);
  });

  it('counts you dropping out of the results below a competitor who stayed', () => {
    expect(findOvertakes('k', standing(5, { 'cd.in': 9 }), standing(null, { 'cd.in': 9 })).lost).toHaveLength(1);
  });

  it('records the reverse as a win', () => {
    const { lost, won } = findOvertakes('k', standing(9, { 'cd.in': 2 }), standing(1, { 'cd.in': 2 }));
    expect(lost).toEqual([]);
    expect(won.map((w) => w.competitor)).toEqual(['cd.in']);
  });

  it('is not an overtake when neither of you was in the results before', () => {
    expect(findOvertakes('k', standing(null, {}), standing(null, { 'cd.in': 4 })).lost).toEqual([]);
  });

  it('is not an overtake when the order did not change', () => {
    expect(findOvertakes('k', standing(2, { 'cd.in': 5 }), standing(3, { 'cd.in': 4 }))).toEqual({ lost: [], won: [] });
  });
});

describe('placements', () => {
  const results = {
    keyword: 'milk',
    country: 'India',
    language: 'en',
    device: 'desktop' as const,
    features: [],
    questions: [],
    totalResults: null,
    costUsd: null,
    organic: [
      { position: 1, url: 'https://www.countrydelight.in/milk', domain: 'countrydelight.in', title: null, snippet: null },
      { position: 4, url: 'https://shop.milquu.in/a2', domain: 'shop.milquu.in', title: null, snippet: null },
      { position: 6, url: 'https://milquu.in/', domain: 'milquu.in', title: null, snippet: null },
    ],
  };

  it("finds your best result, on any subdomain, and each tracked competitor's", () => {
    const { own, competitorPositions } = placements(results, 'milquu.in', [
      { domain: 'https://countrydelight.in', label: 'Country Delight' },
      { domain: 'akshayakalpa.org', label: null },
    ]);
    expect(own).toMatchObject({ position: 4, url: 'https://shop.milquu.in/a2' });
    expect(competitorPositions).toEqual({ 'countrydelight.in': { position: 1, url: 'https://www.countrydelight.in/milk' } });
  });

  it('never lists your own domain as a competitor', () => {
    expect(placements(results, 'milquu.in', [{ domain: 'milquu.in', label: null }]).competitorPositions).toEqual({});
  });
});
