import { scoreDesignFit, estimateLines, countWords, SlotLimits } from './design-fit.util';

/** A slot with every limit measured, so factors are not silently dropped. */
const measuredSlot: SlotLimits = {
  maxWords: 60,
  maxChars: 400,
  maxDesktopLines: 6,
  maxMobileLines: 10,
  desktopCharsPerLine: 90,
  mobileCharsPerLine: 38,
  allowedHtml: ['p', 'h2'],
  currentText: 'The old overview text that is already on the page.',
};

const fittingBody =
  'At Aiva Enterprises, we source the finest fruits from trusted growing regions and ' +
  'process them into premium pulp for global food and beverage brands.';

describe('countWords', () => {
  it('counts words and treats empty text as zero', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('   ')).toBe(0);
  });
});

describe('estimateLines', () => {
  it('returns null when no characters-per-line was measured', () => {
    // The point of null: an unmeasured width must not become an invented one.
    expect(estimateLines('some text', null)).toBeNull();
    expect(estimateLines('some text', 0)).toBeNull();
  });

  it('counts each paragraph separately rather than the joined length', () => {
    // Two 10-char paragraphs at 10 chars/line is 2 lines, not 2 lines' worth
    // of a single 20-char run — paragraphs do not share a line.
    expect(estimateLines('aaaaaaaaaa\n\nbbbbbbbbbb', 10)).toBe(2);
  });
});

describe('scoreDesignFit', () => {
  it('scores content that fits every measured limit as Safe to Publish', () => {
    const result = scoreDesignFit({ body: fittingBody }, measuredSlot, 'HIGH');

    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThanOrEqual(90);
    expect(result.label).toBe('Safe to Publish');
    expect(result.blockingIssues).toEqual([]);
    expect(result.mobileRisk).toBe('LOW');
  });

  it('blocks publishing when the content overflows mobile', () => {
    const result = scoreDesignFit({ body: fittingBody.repeat(4) }, measuredSlot);

    expect(result.blockingIssues.length).toBeGreaterThan(0);
    expect(result.blockingIssues).toContain(
      'This content causes mobile overflow. Shorten the content or move it to a new section.',
    );
    expect(result.mobileRisk).toBe('HIGH');
    expect(result.label).toBe('High Design Risk');
  });

  it('blocks an unbreakable word wider than a mobile line', () => {
    const result = scoreDesignFit({ body: 'x'.repeat(60) }, measuredSlot);

    const scroll = result.checks.find((c) => c.id === 'horizontal-scroll');
    expect(scroll?.passed).toBe(false);
    expect(scroll?.blocking).toBe(true);
  });

  it('blocks content identical to what is already on the page', () => {
    const result = scoreDesignFit(
      { body: '  The OLD overview text that is already on the page.  ' },
      measuredSlot,
    );

    const duplicate = result.checks.find((c) => c.id === 'duplicate');
    // Whitespace and case must not be enough to count as a different change.
    expect(duplicate?.passed).toBe(false);
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });

  it('blocks markup the section does not already use', () => {
    const result = scoreDesignFit(
      { body: fittingBody, htmlTags: ['p', 'table'] },
      measuredSlot,
    );

    const markup = result.checks.find((c) => c.id === 'markup');
    expect(markup?.passed).toBe(false);
    expect(markup?.blocking).toBe(true);
    expect(markup?.message).toContain('table');
  });

  it('warns without blocking when a heading level is skipped', () => {
    const result = scoreDesignFit(
      { body: fittingBody, headingLevel: 4, precedingHeadingLevel: 2 },
      measuredSlot,
    );

    const hierarchy = result.checks.find((c) => c.id === 'heading-hierarchy');
    expect(hierarchy?.passed).toBe(false);
    expect(hierarchy?.blocking).toBe(false);
    expect(hierarchy?.message).toContain('Use h3');
  });

  it('returns a null score rather than a default when nothing was measured', () => {
    // An unscored suggestion has to render as "—". A zero would read as a
    // terrible fit, and a 100 would wave broken content through.
    const result = scoreDesignFit({ body: fittingBody }, {});

    expect(result.score).toBeNull();
    expect(result.label).toBe('Not scored');
    expect(result.ctaMovementLines).toBeNull();
  });

  it('drops unmeasured factors from the weighting instead of guessing them', () => {
    const partial = scoreDesignFit({ body: fittingBody }, { maxWords: 60 });

    expect(partial.factors.map((f) => f.id)).toEqual(['content-length']);
    expect(partial.score).toBe(100);
  });

  it('explains every factor it scored', () => {
    const result = scoreDesignFit({ body: fittingBody }, measuredSlot, 'HIGH');

    for (const factor of result.factors) {
      expect(factor.detail.length).toBeGreaterThan(0);
      expect(factor.score).toBeGreaterThanOrEqual(0);
      expect(factor.score).toBeLessThanOrEqual(1);
    }
  });

  it('degrades the score with the size of the overshoot, not to zero at once', () => {
    const slightly = scoreDesignFit({ body: 'word '.repeat(66) }, { maxWords: 60 });
    const badly = scoreDesignFit({ body: 'word '.repeat(120) }, { maxWords: 60 });

    expect(slightly.score!).toBeGreaterThan(badly.score!);
    expect(badly.score).toBe(0);
  });
});
