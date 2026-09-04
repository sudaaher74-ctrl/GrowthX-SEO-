import { scoreOpportunity, priorityFor, suggestedOwner, ScoreInput } from './opportunity-scoring';

function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    category: 'CONTENT_GAP',
    impact: 'HIGH',
    effortHours: 4,
    competitorsWithEvidence: 2,
    confidence: 'HIGH',
    businessGoal: 'LEADS',
    ...overrides,
  };
}

describe('scoreOpportunity', () => {
  it('ranks a well-evidenced, goal-aligned, cheap action highest', () => {
    const strong = scoreOpportunity(input());
    const weak = scoreOpportunity(
      input({ impact: 'LOW', competitorsWithEvidence: 0, confidence: 'LOW', effortHours: 40 }),
    );

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBeLessThanOrEqual(100);
    expect(weak.score).toBeGreaterThanOrEqual(0);
  });

  it('weights weak evidence down rather than merely counting competitors', () => {
    // Three guesses do not make a fact: confidence multiplies corroboration.
    const confident = scoreOpportunity(input({ competitorsWithEvidence: 3, confidence: 'HIGH' }));
    const unsure = scoreOpportunity(input({ competitorsWithEvidence: 3, confidence: 'LOW' }));

    expect(confident.score).toBeGreaterThan(unsure.score);
  });

  it('stops rewarding corroboration once the decision is already made', () => {
    // The second competitor is news; the fifth changes nothing.
    const three = scoreOpportunity(input({ competitorsWithEvidence: 3 }));
    const five = scoreOpportunity(input({ competitorsWithEvidence: 5 }));

    expect(five.score).toBe(three.score);
  });

  it('ranks the same action differently for different business goals', () => {
    const forLocalVisits = scoreOpportunity(input({ category: 'LOCAL_SEO', businessGoal: 'LOCAL_VISITS' }));
    const forEcommerce = scoreOpportunity(input({ category: 'LOCAL_SEO', businessGoal: 'ECOMMERCE_SALES' }));

    expect(forLocalVisits.score).toBeGreaterThan(forEcommerce.score);
  });

  it('treats every category alike when no goal has been set', () => {
    const local = scoreOpportunity(input({ category: 'LOCAL_SEO', businessGoal: null }));
    const youtube = scoreOpportunity(input({ category: 'YOUTUBE', businessGoal: null }));

    expect(local.score).toBe(youtube.score);
    expect(local.explanation).toContain('no business goal is set');
  });

  it('penalises effort without burying a transformative change', () => {
    // Dividing by effort is how a plan fills up with busywork, so the penalty
    // is bounded: a big job ranks lower, not out.
    const quick = scoreOpportunity(input({ effortHours: 2 }));
    const long = scoreOpportunity(input({ effortHours: 60 }));

    expect(quick.score).toBeGreaterThan(long.score);
    expect(quick.score - long.score).toBeLessThanOrEqual(15);
  });

  it('does not penalise anything under half a day', () => {
    expect(scoreOpportunity(input({ effortHours: 1 })).score).toBe(
      scoreOpportunity(input({ effortHours: 4 })).score,
    );
  });

  it('always explains the number it produced', () => {
    const result = scoreOpportunity(input({ competitorsWithEvidence: 2, effortHours: 12 }));

    expect(result.explanation).toContain(`${result.score}/100`);
    expect(result.explanation).toContain('2 competitors were observed');
    expect(result.explanation).toContain('12h of work');
  });

  it('says plainly when no competitor was observed doing this', () => {
    const result = scoreOpportunity(input({ competitorsWithEvidence: 0 }));

    expect(result.explanation).toContain('no competitor was observed doing this');
  });

  it('stays inside 0-100 at both extremes', () => {
    const best = scoreOpportunity(
      input({ impact: 'HIGH', competitorsWithEvidence: 3, confidence: 'HIGH', effortHours: 1, businessGoal: 'LOCAL_VISITS', category: 'LOCAL_SEO' }),
    );
    const worst = scoreOpportunity(
      input({ impact: 'LOW', competitorsWithEvidence: 0, confidence: 'LOW', effortHours: 200, businessGoal: 'ECOMMERCE_SALES', category: 'GOOGLE_BUSINESS_PROFILE' }),
    );

    expect(best.score).toBeLessThanOrEqual(100);
    expect(worst.score).toBeGreaterThanOrEqual(0);
  });
});

describe('priorityFor', () => {
  it('never lets a weak signal demand urgent action', () => {
    // Telling someone to drop everything on a signal we are unsure of costs
    // more trust than the occasional missed opportunity is worth.
    expect(priorityFor(95, 'LOW')).toBe('MEDIUM');
    expect(priorityFor(30, 'LOW')).toBe('LOW');
    expect(priorityFor(95, 'HIGH')).toBe('CRITICAL');
  });

  it('maps confident scores onto the four bands', () => {
    expect(priorityFor(85, 'HIGH')).toBe('CRITICAL');
    expect(priorityFor(70, 'HIGH')).toBe('HIGH');
    expect(priorityFor(50, 'HIGH')).toBe('MEDIUM');
    expect(priorityFor(20, 'HIGH')).toBe('LOW');
  });

  it('caps a medium-confidence finding no higher than the score allows', () => {
    expect(priorityFor(85, 'MEDIUM')).toBe('CRITICAL');
    expect(priorityFor(10, 'MEDIUM')).toBe('LOW');
  });
});

describe('suggestedOwner', () => {
  it('sends work to whoever can actually do it', () => {
    expect(suggestedOwner('TECHNICAL_SEO')).toBe('DEVELOPER');
    expect(suggestedOwner('CONTENT_GAP')).toBe('SEO_SPECIALIST');
    expect(suggestedOwner('LOCAL_SEO')).toBe('MARKETER');
    expect(suggestedOwner('YOUTUBE')).toBe('MARKETER');
  });
});
