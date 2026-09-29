import { AlertKpi, detectAlerts } from './google-alerts';

const kpi = (over: Partial<AlertKpi>): AlertKpi => ({
  key: 'clicks', label: 'Organic clicks', source: 'GSC', format: 'count', value: 100, previous: 100, delta: { kind: 'pct', value: 0 }, lowerIsBetter: false, ...over,
});

describe('detectAlerts', () => {
  it('flags a large fall as bad and a large rise as good', () => {
    const a = detectAlerts([kpi({ value: 40, previous: 100, delta: { kind: 'pct', value: -60 } }), kpi({ key: 'impressions', label: 'Impressions', value: 300, previous: 200, delta: { kind: 'pct', value: 50 } })], [], 28);
    expect(a.map((x) => [x.id, x.direction, x.severity])).toEqual([['kpi-clicks', 'BAD', 'HIGH'], ['kpi-impressions', 'GOOD', 'MEDIUM']]);
  });

  it('ignores small moves, tiny volumes and unmeasured figures', () => {
    expect(detectAlerts([kpi({ delta: { kind: 'pct', value: -10 } }), kpi({ previous: 10, value: 2, delta: { kind: 'pct', value: -80 } }), kpi({ value: null, delta: null })], [], 28)).toEqual([]);
  });

  it('treats a bigger position number as worse', () => {
    const a = detectAlerts([kpi({ key: 'position', label: 'Average position', format: 'position', value: 12, previous: 9, lowerIsBetter: true, delta: { kind: 'places', value: 3 } })], [], 28);
    expect(a[0].direction).toBe('BAD');
    expect(a[0].title).toContain('worsened');
  });

  it('groups pages that lost a large share of their clicks', () => {
    const a = detectAlerts([], [{ url: '/a', previousClicks: 100, clicks: 20 }, { url: '/b', previousClicks: 100, clicks: 90 }, { url: '/c', previousClicks: 10, clicks: 0 }], 28);
    expect(a).toHaveLength(1);
    expect(a[0].title).toContain('1 page lost');
  });
});
