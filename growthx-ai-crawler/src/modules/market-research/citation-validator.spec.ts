import { validateCitations } from './citation-validator';

const valid = new Set(['source_1', 'source_2']);

describe('validateCitations', () => {
  it('keeps claims whose citations were all retrieved', () => {
    const result = validateCitations(
      { verifiedClaims: [{ claim: 'Demand rose in Q3.', citationIds: ['source_1'] }] },
      valid,
    );

    expect(result.verifiedClaims).toHaveLength(1);
    expect(result.droppedClaims).toBe(0);
    expect(result.invalidCitations).toEqual([]);
  });

  // The model inventing a plausible-looking source id is the exact failure the
  // product cannot ship, so the claim goes rather than the citation.
  it('drops a claim whose only citation was never retrieved', () => {
    const result = validateCitations(
      { verifiedClaims: [{ claim: 'The market is worth $4bn.', citationIds: ['source_99'] }] },
      valid,
    );

    expect(result.verifiedClaims).toHaveLength(0);
    expect(result.droppedClaims).toBe(1);
    expect(result.invalidCitations).toEqual(['source_99']);
    expect(result.warnings[0]).toContain('not retrieved');
  });

  it('strips only the invented citation when a real one remains', () => {
    const result = validateCitations(
      { verifiedClaims: [{ claim: 'Prices fell.', citationIds: ['source_1', 'source_42'] }] },
      valid,
    );

    expect(result.verifiedClaims[0].citationIds).toEqual(['source_1']);
    expect(result.invalidCitations).toEqual(['source_42']);
  });

  // A dropped claim must not reappear as reasoning — that would present a
  // fabricated citation as considered inference.
  it('does not demote an unsupported claim into inferences', () => {
    const result = validateCitations(
      {
        verifiedClaims: [{ claim: 'Invented fact.', citationIds: ['nope'] }],
        inferences: [],
      },
      valid,
    );

    expect(result.verifiedClaims).toHaveLength(0);
    expect(result.inferences).toHaveLength(0);
  });

  it('keeps inferences without citations but strips invalid ones', () => {
    const result = validateCitations(
      {
        inferences: [
          { statement: 'They will likely expand.', reasoning: 'Hiring pattern.', citationIds: ['source_2', 'ghost'] },
          { statement: 'Pure reasoning.', reasoning: 'No source needed.', citationIds: [] },
        ],
      },
      valid,
    );

    expect(result.inferences).toHaveLength(2);
    expect(result.inferences[0].citationIds).toEqual(['source_2']);
    expect(result.inferences[1].citationIds).toEqual([]);
  });

  it('drops recommended actions with no surviving evidence', () => {
    const result = validateCitations(
      {
        recommendedActions: [
          {
            type: 'CONTENT_BRIEF',
            title: 'Write a comparison page',
            description: 'x',
            evidenceCitationIds: ['source_1'],
            expectedImpact: 'y',
            confidence: 'medium',
            requiresApproval: true,
          },
          {
            type: 'TECHNICAL_TASK',
            title: 'Unsupported',
            description: 'x',
            evidenceCitationIds: ['made_up'],
            expectedImpact: 'y',
            confidence: 'high',
            requiresApproval: true,
          },
        ],
      },
      valid,
    );

    expect(result.recommendedActions).toHaveLength(1);
    expect(result.recommendedActions[0].title).toBe('Write a comparison page');
    expect(result.droppedActions).toBe(1);
  });

  // The human gate is the product's promise; a model must not be able to
  // switch it off by returning requiresApproval: false.
  it('forces requiresApproval on regardless of what the model returned', () => {
    const result = validateCitations(
      {
        recommendedActions: [
          {
            type: 'OUTREACH_OPPORTUNITY',
            title: 'Email 200 journalists',
            description: 'x',
            evidenceCitationIds: ['source_1'],
            expectedImpact: 'y',
            confidence: 'high',
            requiresApproval: false,
          },
        ],
      },
      valid,
    );

    expect(result.recommendedActions[0].requiresApproval).toBe(true);
  });

  it('handles an empty answer without throwing', () => {
    const result = validateCitations({}, valid);

    expect(result.verifiedClaims).toEqual([]);
    expect(result.inferences).toEqual([]);
    expect(result.recommendedActions).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('drops everything when no sources were retrieved at all', () => {
    const result = validateCitations(
      { verifiedClaims: [{ claim: 'Anything.', citationIds: ['source_1'] }] },
      new Set<string>(),
    );

    expect(result.verifiedClaims).toHaveLength(0);
    expect(result.droppedClaims).toBe(1);
  });
});
