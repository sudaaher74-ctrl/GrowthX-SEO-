import { readImpact, Window } from './change-impact';

function w(days: number, clicks: number, impressions: number, position: number | null): Window {
  return { from: '2026-08-01', to: '2026-08-28', days, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position };
}

describe('readImpact', () => {
  it('calls a page improved when it rose well beyond the rest of the site', () => {
    const reading = readImpact({ before: w(28, 56, 2800, 11.2), after: w(28, 140, 4200, 6.8) }, { before: w(28, 1000, 50000, 18), after: w(28, 1050, 51000, 18) });
    expect(reading.verdict).toBe('IMPROVED');
    expect(reading.perDay.clicks).toEqual({ before: 2, after: 5, changePct: 150 });
    expect(reading.positionGain).toBe(4.4);
    expect(reading.relative.clicks).toBe(145);
    expect(reading.readout[0]).toMatch(/from 2 to 5 a day \(\+150%\).*whole site changed \+5%/);
  });

  it('does not credit the change for a rise the whole site shared', () => {
    const reading = readImpact({ before: w(28, 56, 2800, 9), after: w(28, 84, 4200, 9) }, { before: w(28, 1000, 50000, 18), after: w(28, 1500, 75000, 18) });
    expect(reading.verdict).toBe('NO_CLEAR_CHANGE');
  });

  it('calls a page declined when it fell against the site', () => {
    expect(readImpact({ before: w(28, 140, 4200, 5), after: w(28, 40, 2000, 9) }, { before: w(28, 1000, 50000, 18), after: w(28, 1000, 50000, 18) }).verdict).toBe('DECLINED');
  });

  it('compares per day, so a shorter after-window is not read as a drop', () => {
    const reading = readImpact({ before: w(28, 56, 2800, 9), after: w(10, 20, 1000, 9) }, { before: w(28, 1000, 50000, 18), after: w(10, 357, 17857, 18) });
    expect(reading.perDay.clicks.changePct).toBe(0);
    expect(reading.verdict).toBe('NO_CLEAR_CHANGE');
  });

  it('says it is too early with under a week of data after the change', () => {
    const reading = readImpact({ before: w(28, 56, 2800, 9), after: w(4, 30, 900, 7) }, { before: w(28, 1000, 50000, 18), after: w(4, 150, 7000, 18) });
    expect(reading.verdict).toBe('TOO_EARLY');
    expect(reading.verdictText).toMatch(/4 day\(s\)/);
  });

  it('declines to judge a page Google barely showed', () => {
    expect(readImpact({ before: w(28, 0, 8, 40), after: w(28, 1, 12, 35) }, { before: w(28, 1000, 50000, 18), after: w(28, 1000, 50000, 18) }).verdict).toBe(
      'TOO_LITTLE_DATA',
    );
  });
});
