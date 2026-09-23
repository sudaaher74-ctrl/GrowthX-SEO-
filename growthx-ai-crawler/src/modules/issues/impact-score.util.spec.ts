import {
  confidenceScore,
  FIX_CLASS_MULTIPLIER,
  impactScore,
  NEUTRAL_REACH,
  severityScore,
} from './impact-score.util';
import { SEVERITY_WEIGHTS } from './health-score.util';

describe('impactScore', () => {
  it('ranks AUTO above MANUAL when severity, confidence and reach are equal', () => {
    // The multiplier is deliberate: when two findings score close, push the
    // user toward the one we can fix for them.
    const common = { severity: 'HIGH', confidence: 'CONFIRMED', reach: 40 };
    const auto = impactScore({ ...common, fixClass: 'AUTO' });
    const approval = impactScore({ ...common, fixClass: 'APPROVAL' });
    const manual = impactScore({ ...common, fixClass: 'MANUAL' });

    expect(auto.impact).toBeGreaterThan(approval.impact);
    expect(approval.impact).toBeGreaterThan(manual.impact);
  });

  it('uses the neutral stand-in, and says so, when Search Console is not connected', () => {
    const result = impactScore({ severity: 'HIGH', confidence: 'LIKELY', fixClass: 'AUTO', reach: null });
    const asIfFifty = impactScore({ severity: 'HIGH', confidence: 'LIKELY', fixClass: 'AUTO', reach: 50 });

    expect(NEUTRAL_REACH).toBe(50);
    expect(result.reachAvailable).toBe(false);
    expect(result.impact).toBe(asIfFifty.impact);
  });

  it('treats a measured zero as measured, not as missing', () => {
    // A page Search Console reports and nobody visits is real information. It
    // must not be silently promoted to the neutral 50 an unconnected project gets.
    const zero = impactScore({ severity: 'HIGH', confidence: 'LIKELY', fixClass: 'AUTO', reach: 0 });
    const unknown = impactScore({ severity: 'HIGH', confidence: 'LIKELY', fixClass: 'AUTO', reach: null });

    expect(zero.reachAvailable).toBe(true);
    expect(zero.impact).toBeLessThan(unknown.impact);
  });

  it('stays within 0-100 for every severity, confidence and fix class', () => {
    for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']) {
      for (const confidence of ['CONFIRMED', 'LIKELY', 'ADVISORY', 'UNKNOWN']) {
        for (const fixClass of ['AUTO', 'APPROVAL', 'MANUAL'] as const) {
          for (const reach of [null, 0, 50, 100, -20, 250, NaN]) {
            const { impact } = impactScore({ severity, confidence, fixClass, reach });
            expect(Number.isFinite(impact)).toBe(true);
            expect(impact).toBeGreaterThanOrEqual(0);
            expect(impact).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });

  it('scores a perfect input at exactly 100', () => {
    const { impact } = impactScore({ severity: 'CRITICAL', confidence: 'CONFIRMED', fixClass: 'AUTO', reach: 100 });
    expect(impact).toBe(100);
  });

  it('applies the fix-class multiplier exactly as specified', () => {
    expect(FIX_CLASS_MULTIPLIER).toEqual({ AUTO: 1.0, APPROVAL: 0.92, MANUAL: 0.78 });
  });
});

describe('severityScore', () => {
  it('rescales the health score weights to CRITICAL 100, HIGH 40, MEDIUM 15, LOW 5', () => {
    expect(severityScore('CRITICAL')).toBe(100);
    expect(severityScore('HIGH')).toBe(40);
    expect(severityScore('MEDIUM')).toBe(15);
    expect(severityScore('LOW')).toBe(5);
  });

  it('follows the health score weights rather than restating them', () => {
    // If someone retunes the health score, the queue has to move with it, or
    // the gauge and the queue disagree about how bad the same finding is.
    const ratio = SEVERITY_WEIGHTS.HIGH / SEVERITY_WEIGHTS.CRITICAL;
    expect(severityScore('HIGH')).toBeCloseTo(ratio * 100);
  });

  it('scores an unknown severity as zero rather than guessing', () => {
    expect(severityScore('SEVERE')).toBe(0);
  });
});

describe('confidenceScore', () => {
  it('is the health score multiplier on a 0-100 scale', () => {
    expect(confidenceScore('CONFIRMED')).toBe(100);
    expect(confidenceScore('LIKELY')).toBe(80);
    expect(confidenceScore('ADVISORY')).toBe(50);
  });
});
