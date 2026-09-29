import { findCannibalization, keywordMovement } from './keyword-movement';

const q = (key: string, clicks: number, impressions: number, position: number) => ({ key, clicks, impressions, position });

describe('keywordMovement', () => {
  it('says nothing can be compared when there is no earlier window', () => {
    expect(keywordMovement([q('a', 10, 100, 5)], null)).toBeNull();
  });

  it('calls a query new only when the earlier window has data and lacks it', () => {
    const r = keywordMovement([q('fresh', 5, 80, 9), q('old', 5, 80, 9), q('tiny', 1, 5, 9)], [q('old', 5, 80, 9)])!;
    expect(r.new.map((n) => n.query)).toEqual(['fresh']);
  });

  it('flags rising on clicks or on a real position gain, not on noise', () => {
    const r = keywordMovement(
      [q('clicks', 20, 200, 8), q('places', 4, 100, 5), q('flat', 11, 200, 8), q('lowvol', 9, 20, 3)],
      [q('clicks', 10, 200, 8), q('places', 4, 100, 9), q('flat', 10, 200, 8), q('lowvol', 1, 20, 9)],
    )!;
    expect(r.rising.map((x) => x.query).sort()).toEqual(['clicks', 'places']);
    expect(r.rising.find((x) => x.query === 'places')!.movement).toBe(4);
  });
});

describe('findCannibalization', () => {
  const r = (query: string, page: string, impressions: number) => ({ query, page, clicks: 1, impressions, position: 5 });

  it('finds a query split across two pages that each matter', () => {
    const out = findCannibalization([r('milk', '/a', 300), r('milk', '/b', 200), r('solo', '/a', 500)]);
    expect(out).toHaveLength(1);
    expect(out[0].query).toBe('milk');
    expect(out[0].pages[0].share).toBeCloseTo(0.6);
  });

  it('ignores a page that only has a sliver, and low-volume queries', () => {
    expect(findCannibalization([r('milk', '/a', 500), r('milk', '/b', 20)])).toEqual([]);
    expect(findCannibalization([r('rare', '/a', 30), r('rare', '/b', 30)])).toEqual([]);
  });
});
