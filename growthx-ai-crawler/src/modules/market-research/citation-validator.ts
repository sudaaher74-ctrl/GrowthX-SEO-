/**
 * Independent enforcement of the citation rules.
 *
 * The model is instructed to cite only supplied sources, and this checks that
 * it did. Instructions are a request; this is the guarantee. A claim citing a
 * source that was never retrieved is dropped rather than shown with a broken
 * link or, worse, shown as verified.
 */

export interface RawClaim {
  claim: string;
  citationIds: string[];
}

export interface RawInference {
  statement: string;
  reasoning: string;
  citationIds: string[];
}

export interface RawAction {
  type: string;
  title: string;
  description: string;
  evidenceCitationIds: string[];
  expectedImpact: string;
  confidence: string;
  requiresApproval: boolean;
}

export interface ValidationReport {
  /** Claims whose citations all exist. */
  verifiedClaims: RawClaim[];
  inferences: RawInference[];
  recommendedActions: RawAction[];
  /** Human-readable notes about what was removed and why. */
  warnings: string[];
  /** Source keys the model referenced that were never retrieved. */
  invalidCitations: string[];
  /** How many items were dropped entirely. */
  droppedClaims: number;
  droppedActions: number;
}

export function validateCitations(
  answer: {
    verifiedClaims?: RawClaim[];
    inferences?: RawInference[];
    recommendedActions?: RawAction[];
  },
  validSourceKeys: Set<string>,
): ValidationReport {
  const warnings: string[] = [];
  const invalid = new Set<string>();

  const keep = (ids: string[] | undefined): string[] => {
    const valid: string[] = [];
    for (const id of ids ?? []) {
      if (validSourceKeys.has(id)) valid.push(id);
      else invalid.add(id);
    }
    return valid;
  };

  // A verified claim with no surviving citation is not verified. It is dropped
  // rather than demoted, because silently moving it to inferences would present
  // a fabricated citation as considered reasoning.
  const verifiedClaims: RawClaim[] = [];
  let droppedClaims = 0;
  for (const claim of answer.verifiedClaims ?? []) {
    const citationIds = keep(claim.citationIds);
    if (citationIds.length === 0) {
      droppedClaims++;
      continue;
    }
    verifiedClaims.push({ claim: claim.claim, citationIds });
  }
  if (droppedClaims > 0) {
    warnings.push(
      `${droppedClaims} claim(s) were removed because they cited sources that were not retrieved in this run.`,
    );
  }

  // Inferences are allowed to stand without citations — they are labelled as
  // reasoning, not fact — but a citation that does not exist is still stripped.
  const inferences = (answer.inferences ?? []).map((inference) => ({
    statement: inference.statement,
    reasoning: inference.reasoning,
    citationIds: keep(inference.citationIds),
  }));

  const recommendedActions: RawAction[] = [];
  let droppedActions = 0;
  for (const action of answer.recommendedActions ?? []) {
    const evidenceCitationIds = keep(action.evidenceCitationIds);
    if (evidenceCitationIds.length === 0) {
      droppedActions++;
      continue;
    }
    recommendedActions.push({
      ...action,
      evidenceCitationIds,
      // Approval is set by the product, not by the model. A model that returns
      // requiresApproval: false must not be able to bypass the human gate.
      requiresApproval: true,
    });
  }
  if (droppedActions > 0) {
    warnings.push(
      `${droppedActions} recommended action(s) were removed because their supporting evidence was not retrieved in this run.`,
    );
  }

  return {
    verifiedClaims,
    inferences,
    recommendedActions,
    warnings,
    invalidCitations: [...invalid],
    droppedClaims,
    droppedActions,
  };
}
