import { AiAssistant } from '@prisma/client';
import { buildVisibilityReport, ReportableCheck } from './visibility-report';

const PERIOD_END = new Date('2026-08-04T00:00:00Z');
const PERIOD_START = new Date('2026-07-07T00:00:00Z'); // 28 days

function check(overrides: Partial<ReportableCheck> = {}): ReportableCheck {
  return {
    assistant: AiAssistant.CLAUDE,
    checkedAt: new Date('2026-07-20T00:00:00Z'),
    cited: false,
    position: null,
    competitorsCited: [],
    error: null,
    ...overrides,
  };
}

function report(checks: ReportableCheck[], competitorLabels?: Record<string, string>) {
  return buildVisibilityReport(checks, { periodStart: PERIOD_START, periodEnd: PERIOD_END, competitorLabels });
}

describe('buildVisibilityReport', () => {
  describe('citation share', () => {
    it('is the share of ran checks that cited the customer', () => {
      const result = report([
        check({ cited: true, position: 1 }),
        check({ cited: true, position: 2 }),
        check({ cited: false }),
        check({ cited: false }),
      ]);
      expect(result.summary).toMatchObject({ checked: 4, cited: 2, citationSharePct: 50 });
    });

    it('is zero rather than NaN with no checks at all', () => {
      const result = report([]);
      expect(result.summary.citationSharePct).toBe(0);
      expect(result.summary.averagePosition).toBeNull();
    });

    it('averages position over cited answers only', () => {
      const result = report([
        check({ cited: true, position: 1 }),
        check({ cited: true, position: 4 }),
        check({ cited: false }),
      ]);
      expect(result.summary.averagePosition).toBe(2.5);
    });
  });

  describe('failed checks', () => {
    it('excludes them from the rate instead of counting them as "not cited"', () => {
      const result = report([
        check({ cited: true, position: 1 }),
        check({ error: 'provider timeout' }),
        check({ error: 'provider timeout' }),
      ]);
      // 1 of 1 that actually ran — not 1 of 3.
      expect(result.summary).toMatchObject({ checked: 1, cited: 1, citationSharePct: 100, failedChecks: 2 });
    });

    it('reports an unmeasurable assistant as failed, not as a zero score', () => {
      const result = report([
        check({ assistant: AiAssistant.AI_OVERVIEWS, error: 'No public API is available' }),
        check({ assistant: AiAssistant.CLAUDE, cited: true, position: 1 }),
      ]);
      expect(result.byAssistant.map((row) => row.assistant)).toEqual([AiAssistant.CLAUDE]);
      expect(result.summary.failedChecks).toBe(1);
    });
  });

  describe('period-over-period delta', () => {
    it('compares against the preceding window of equal length', () => {
      const result = report([
        // Previous window (2026-06-09 .. 2026-07-07): 1 of 4 cited = 25%
        check({ checkedAt: new Date('2026-06-20T00:00:00Z'), cited: true, position: 1 }),
        check({ checkedAt: new Date('2026-06-21T00:00:00Z') }),
        check({ checkedAt: new Date('2026-06-22T00:00:00Z') }),
        check({ checkedAt: new Date('2026-06-23T00:00:00Z') }),
        // Current window: 3 of 4 cited = 75%
        check({ checkedAt: new Date('2026-07-20T00:00:00Z'), cited: true, position: 1 }),
        check({ checkedAt: new Date('2026-07-21T00:00:00Z'), cited: true, position: 1 }),
        check({ checkedAt: new Date('2026-07-22T00:00:00Z'), cited: true, position: 2 }),
        check({ checkedAt: new Date('2026-07-23T00:00:00Z') }),
      ]);

      expect(result.summary.citationSharePct).toBe(75);
      expect(result.summary.previousCitationSharePct).toBe(25);
      expect(result.summary.deltaPt).toBe(50);
    });

    it('reports a null delta when there is no prior data to compare', () => {
      const result = report([check({ cited: true, position: 1 })]);
      expect(result.summary.previousCitationSharePct).toBeNull();
      expect(result.summary.deltaPt).toBeNull();
    });

    it('ignores checks outside both windows', () => {
      const result = report([
        check({ checkedAt: new Date('2026-01-01T00:00:00Z'), cited: true, position: 1 }),
        check({ checkedAt: new Date('2026-07-20T00:00:00Z') }),
      ]);
      expect(result.summary.checked).toBe(1);
      expect(result.summary.previousCitationSharePct).toBeNull();
    });
  });

  describe('per-assistant breakdown', () => {
    it('scores each assistant separately, best first', () => {
      const result = report([
        check({ assistant: AiAssistant.CLAUDE, cited: true, position: 1 }),
        check({ assistant: AiAssistant.CLAUDE, cited: true, position: 1 }),
        check({ assistant: AiAssistant.CHATGPT, cited: true, position: 3 }),
        check({ assistant: AiAssistant.CHATGPT }),
        check({ assistant: AiAssistant.GEMINI }),
      ]);

      expect(result.byAssistant).toEqual([
        { assistant: AiAssistant.CLAUDE, checked: 2, cited: 2, citationSharePct: 100 },
        { assistant: AiAssistant.CHATGPT, checked: 2, cited: 1, citationSharePct: 50 },
        { assistant: AiAssistant.GEMINI, checked: 1, cited: 0, citationSharePct: 0 },
      ]);
    });
  });

  describe('share of voice', () => {
    it('ranks the customer against competitors across the same answers', () => {
      const result = report(
        [
          check({ cited: true, position: 2, competitorsCited: ['trailheadco.com'] }),
          check({ cited: false, competitorsCited: ['trailheadco.com', 'summitgrove.com'] }),
          check({ cited: true, position: 1 }),
          check({ cited: false, competitorsCited: ['trailheadco.com'] }),
        ],
        { 'trailheadco.com': 'Trailhead Co' },
      );

      expect(result.shareOfVoice).toEqual([
        { domain: 'trailheadco.com', label: 'Trailhead Co', mentions: 3, sharePct: 75 },
        { domain: null, label: 'You', mentions: 2, sharePct: 50 },
        { domain: 'summitgrove.com', label: 'summitgrove.com', mentions: 1, sharePct: 25 },
      ]);
    });

    it('falls back to the bare domain when no label is set', () => {
      const result = report([check({ competitorsCited: ['rival.com'] })]);
      expect(result.shareOfVoice.find((r) => r.domain === 'rival.com')?.label).toBe('rival.com');
    });

    it('always includes the customer row, even at zero', () => {
      const result = report([check({ cited: false })]);
      expect(result.shareOfVoice[0]).toEqual({ domain: null, label: 'You', mentions: 0, sharePct: 0 });
    });
  });

  describe('weekly trend', () => {
    it('buckets by ISO week starting Monday, oldest first', () => {
      const result = report([
        // Mon 2026-07-13 week
        check({ checkedAt: new Date('2026-07-15T00:00:00Z'), cited: true, position: 1 }),
        check({ checkedAt: new Date('2026-07-16T00:00:00Z') }),
        // Mon 2026-07-20 week
        check({ checkedAt: new Date('2026-07-22T00:00:00Z'), cited: true, position: 1 }),
        check({ checkedAt: new Date('2026-07-23T00:00:00Z'), cited: true, position: 2 }),
      ]);

      expect(result.trend).toEqual([
        { weekStart: '2026-07-13', checked: 2, citationSharePct: 50 },
        { weekStart: '2026-07-20', checked: 2, citationSharePct: 100 },
      ]);
    });

    it('puts a Sunday in the week that began the previous Monday', () => {
      // 2026-07-19 is a Sunday; its week starts Monday 2026-07-13.
      const result = report([check({ checkedAt: new Date('2026-07-19T12:00:00Z'), cited: true, position: 1 })]);
      expect(result.trend[0].weekStart).toBe('2026-07-13');
    });
  });
});
