import { ActionOwner, ActionPriority, FindingCategory, FindingConfidence } from '@prisma/client';

/**
 * The business outcome the customer is actually chasing.
 *
 * Set by the operator rather than detected. The same website can be run for
 * leads or for brand awareness and only its owner knows which — but it changes
 * which competitor gap is worth a week of someone's time, so it cannot be
 * guessed.
 */
export type BusinessGoal =
  | 'LEADS'
  | 'LOCAL_VISITS'
  | 'ECOMMERCE_SALES'
  | 'BRAND_AWARENESS'
  | 'CONTENT_GROWTH';

export interface ScoreInput {
  category: FindingCategory;
  /** What closing this gap is worth, before anything else is considered. */
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Rough hours of work. Coarse on purpose; false precision reads as a promise. */
  effortHours: number;
  /** How many distinct competitors were observed doing this. */
  competitorsWithEvidence: number;
  /** The weakest confidence among the findings behind the action. */
  confidence: FindingConfidence;
  /** Null when the operator has not told us what they are optimising for. */
  businessGoal?: BusinessGoal | null;
}

export interface ScoreResult {
  score: number;
  priority: ActionPriority;
  /** The score in words. Nobody should have to trust a number they cannot unpack. */
  explanation: string;
}

/** Impact is the largest single term: nothing rescues a low-value action. */
const IMPACT_POINTS: Record<ScoreInput['impact'], number> = {
  HIGH: 40,
  MEDIUM: 25,
  LOW: 10,
};

/**
 * How much the evidence is worth.
 *
 * Confidence multiplies rather than adds, because weak evidence about many
 * competitors is still weak evidence — three guesses do not make a fact.
 */
const CONFIDENCE_WEIGHT: Record<FindingConfidence, number> = {
  HIGH: 1,
  MEDIUM: 0.65,
  LOW: 0.3,
};

/**
 * Which surfaces move which goal.
 *
 * A city landing page is close to everything for a business chasing local
 * visits and nearly irrelevant to one chasing ecommerce volume. Absent a
 * stated goal every category scores the same middling alignment, so an
 * unanswered setup question cannot silently distort the plan.
 */
const GOAL_ALIGNMENT: Record<BusinessGoal, Partial<Record<FindingCategory, number>>> = {
  LEADS: {
    TECHNICAL_SEO: 14,
    CONTENT_GAP: 18,
    LOCAL_SEO: 16,
    GOOGLE_BUSINESS_PROFILE: 16,
    AI_SEARCH: 12,
    YOUTUBE: 8,
    INSTAGRAM: 8,
  },
  LOCAL_VISITS: {
    LOCAL_SEO: 20,
    GOOGLE_BUSINESS_PROFILE: 20,
    TECHNICAL_SEO: 10,
    CONTENT_GAP: 12,
    AI_SEARCH: 8,
    YOUTUBE: 6,
    INSTAGRAM: 10,
  },
  ECOMMERCE_SALES: {
    TECHNICAL_SEO: 18,
    CONTENT_GAP: 16,
    AI_SEARCH: 12,
    INSTAGRAM: 12,
    YOUTUBE: 10,
    LOCAL_SEO: 6,
    GOOGLE_BUSINESS_PROFILE: 6,
  },
  BRAND_AWARENESS: {
    YOUTUBE: 18,
    INSTAGRAM: 18,
    CONTENT_GAP: 14,
    AI_SEARCH: 12,
    TECHNICAL_SEO: 6,
    LOCAL_SEO: 8,
    GOOGLE_BUSINESS_PROFILE: 8,
  },
  CONTENT_GROWTH: {
    CONTENT_GAP: 20,
    YOUTUBE: 16,
    AI_SEARCH: 14,
    INSTAGRAM: 12,
    TECHNICAL_SEO: 8,
    LOCAL_SEO: 6,
    GOOGLE_BUSINESS_PROFILE: 6,
  },
};

/** Applied when no goal has been set, so every category is treated alike. */
const NEUTRAL_ALIGNMENT = 10;

/**
 * Ranks one recommended action against the others.
 *
 * Four things decide it, and the order matters: what the action is worth, how
 * good the evidence behind it is, whether it serves the goal this business
 * actually has, and how much work it is. Effort is a penalty rather than a
 * divisor deliberately — dividing by effort buries a transformative change
 * under a week of small ones, which is how a plan ends up full of busywork.
 *
 * The whole thing is pure and returns its own explanation, because a score an
 * operator cannot argue with is a score they will not act on.
 */
export function scoreOpportunity(input: ScoreInput): ScoreResult {
  const impact = IMPACT_POINTS[input.impact];
  const weight = CONFIDENCE_WEIGHT[input.confidence];

  // Corroboration saturates: the second competitor doing something is strong
  // news, the fifth adds almost nothing to a decision already made.
  const corroboration = Math.min(input.competitorsWithEvidence, 3);
  const evidence = Math.round(corroboration * 8 * weight);

  const alignment = input.businessGoal
    ? (GOAL_ALIGNMENT[input.businessGoal][input.category] ?? NEUTRAL_ALIGNMENT)
    : NEUTRAL_ALIGNMENT;

  // Half a day is free; beyond that the penalty grows but caps, so a large
  // project is ranked lower rather than ranked out.
  const effortPenalty = Math.min(15, Math.max(0, Math.round((input.effortHours - 4) / 2)));

  const score = clamp(impact + evidence + alignment - effortPenalty, 0, 100);

  return {
    score,
    priority: priorityFor(score, input.confidence),
    explanation: explain({ input, impact, evidence, alignment, effortPenalty, score }),
  };
}

/**
 * Urgency, gated by evidence quality.
 *
 * A LOW-confidence finding can never produce a Critical or High action however
 * well it scores. Telling someone to drop everything on the strength of a
 * signal we are not sure of is how a tool loses their trust permanently, and
 * it is worth more than the occasional missed opportunity.
 */
export function priorityFor(score: number, confidence: FindingConfidence): ActionPriority {
  if (confidence === 'LOW') return score >= 60 ? 'MEDIUM' : 'LOW';
  if (score >= 80) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 45) return 'MEDIUM';
  return 'LOW';
}

/**
 * Who should do this.
 *
 * Category is the honest signal here — a redirect chain is a developer's job
 * whatever it scores. Kept as a suggestion in the UI wording, because a
 * three-person business has one person for all five roles.
 */
export function suggestedOwner(category: FindingCategory): ActionOwner {
  switch (category) {
    case 'TECHNICAL_SEO':
      return 'DEVELOPER';
    case 'AI_SEARCH':
      return 'SEO_SPECIALIST';
    case 'CONTENT_GAP':
      return 'SEO_SPECIALIST';
    case 'LOCAL_SEO':
    case 'GOOGLE_BUSINESS_PROFILE':
      return 'MARKETER';
    case 'YOUTUBE':
    case 'INSTAGRAM':
      return 'MARKETER';
    default:
      return 'FOUNDER';
  }
}

function explain(parts: {
  input: ScoreInput;
  impact: number;
  evidence: number;
  alignment: number;
  effortPenalty: number;
  score: number;
}): string {
  const { input, impact, evidence, alignment, effortPenalty, score } = parts;

  const evidencePhrase =
    input.competitorsWithEvidence === 0
      ? 'no competitor was observed doing this'
      : `${input.competitorsWithEvidence} competitor${input.competitorsWithEvidence === 1 ? ' was' : 's were'} observed doing this`;

  const confidencePhrase =
    input.confidence === 'HIGH'
      ? 'read directly from the source'
      : input.confidence === 'MEDIUM'
        ? 'inferred from what was read'
        : 'a weak signal, so this cannot rank as urgent however well it scores';

  const goalPhrase = input.businessGoal
    ? `it ${alignment >= 14 ? 'serves' : 'only partly serves'} the stated goal of ${goalWords(input.businessGoal)}`
    : 'no business goal is set, so every category was weighted equally';

  const effortPhrase =
    effortPenalty === 0
      ? `about ${input.effortHours}h of work, which is small enough not to count against it`
      : `about ${input.effortHours}h of work, which costs it ${effortPenalty} points`;

  return (
    `Scores ${score}/100. Impact ${input.impact.toLowerCase()} (${impact} points); ` +
    `${evidencePhrase}, ${confidencePhrase} (${evidence} points); ` +
    `${goalPhrase} (${alignment} points); ` +
    `${effortPhrase}.`
  );
}

function goalWords(goal: BusinessGoal): string {
  switch (goal) {
    case 'LEADS':
      return 'more leads';
    case 'LOCAL_VISITS':
      return 'more local visits';
    case 'ECOMMERCE_SALES':
      return 'more online sales';
    case 'BRAND_AWARENESS':
      return 'brand awareness';
    case 'CONTENT_GROWTH':
      return 'content growth';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
