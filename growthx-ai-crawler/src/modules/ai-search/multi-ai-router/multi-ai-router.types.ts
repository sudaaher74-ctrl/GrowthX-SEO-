export enum AiProvider {
  MAMMOUTH = 'MAMMOUTH',
  SARVAM = 'SARVAM',
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  GROQ = 'GROQ',
  OPENROUTER = 'OPENROUTER',
  /**
   * A search-grounded assistant we measure, not one we borrow for generation:
   * it is in no TASK_PREFERENCE chain, so it only ever answers when a caller pins it
   * (AI Visibility asking "what does Perplexity say").
   */
  PERPLEXITY = 'PERPLEXITY',
}

/**
 * How a task is routed, independent of which vendor ends up serving it.
 *
 * Three profiles rather than one per task on purpose: the vendor preference
 * order genuinely only has three shapes, and a table with one row per task
 * drifts out of agreement with itself the first time a vendor is added.
 */
export enum RoutingProfile {
  /** Deep SEO reasoning, strategy, competitive analysis. */
  REASONING = 'REASONING',
  /** Generating code patches for the autonomous engineer. */
  CODE_GEN = 'CODE_GEN',
  /** Cheap, high-volume extraction and classification. */
  FAST = 'FAST',
}

/**
 * What the caller wants done. Named for the product surface that asks, not the
 * model that answers, so the spend ledger reads as "what did the fix engine
 * cost us" rather than "what did REASONING cost us".
 *
 * The first three values are the original routing profiles, kept as task names
 * so existing callers keep working unchanged.
 */
export enum AiTask {
  REASONING = 'REASONING',
  CODE_GEN = 'CODE_GEN',
  FAST = 'FAST',

  SEO_RESEARCH = 'SEO_RESEARCH',
  SEO_ANALYSIS = 'SEO_ANALYSIS',
  COMPETITOR_ANALYSIS = 'COMPETITOR_ANALYSIS',
  AI_VISIBILITY_ANALYSIS = 'AI_VISIBILITY_ANALYSIS',
  PAGE_COMPARISON = 'PAGE_COMPARISON',
  CONTENT_STRUCTURE_ANALYSIS = 'CONTENT_STRUCTURE_ANALYSIS',
  ENTITY_ANALYSIS = 'ENTITY_ANALYSIS',
  SEO_OPPORTUNITY_GENERATION = 'SEO_OPPORTUNITY_GENERATION',
  CODE_GENERATION = 'CODE_GENERATION',
  CODE_REVIEW = 'CODE_REVIEW',
  FIX_VALIDATION = 'FIX_VALIDATION',
  LOCAL_SEO_ANALYSIS = 'LOCAL_SEO_ANALYSIS',
  REVIEW_RESPONSE_DRAFT = 'REVIEW_RESPONSE_DRAFT',
  SUMMARY_GENERATION = 'SUMMARY_GENERATION',
}

/**
 * Which routing profile each task uses.
 *
 * The judgement encoded here: anything that reads a page and decides what is
 * wrong with it reasons; anything that writes or checks code needs the code
 * profile; anything run hundreds of times per client per week is priced first
 * and reasoned second, because at 300 prompts x 5 engines x weekly the cheap
 * model is the difference between a viable gross margin and a services
 * business.
 */
export const TASK_PROFILE: Readonly<Record<AiTask, RoutingProfile>> = {
  [AiTask.REASONING]: RoutingProfile.REASONING,
  [AiTask.CODE_GEN]: RoutingProfile.CODE_GEN,
  [AiTask.FAST]: RoutingProfile.FAST,

  [AiTask.SEO_RESEARCH]: RoutingProfile.REASONING,
  [AiTask.SEO_ANALYSIS]: RoutingProfile.REASONING,
  [AiTask.COMPETITOR_ANALYSIS]: RoutingProfile.REASONING,
  [AiTask.AI_VISIBILITY_ANALYSIS]: RoutingProfile.REASONING,
  [AiTask.PAGE_COMPARISON]: RoutingProfile.REASONING,
  [AiTask.SEO_OPPORTUNITY_GENERATION]: RoutingProfile.REASONING,

  [AiTask.CODE_GENERATION]: RoutingProfile.CODE_GEN,
  [AiTask.CODE_REVIEW]: RoutingProfile.CODE_GEN,
  [AiTask.FIX_VALIDATION]: RoutingProfile.CODE_GEN,

  [AiTask.CONTENT_STRUCTURE_ANALYSIS]: RoutingProfile.FAST,
  [AiTask.ENTITY_ANALYSIS]: RoutingProfile.FAST,
  [AiTask.LOCAL_SEO_ANALYSIS]: RoutingProfile.FAST,
  [AiTask.REVIEW_RESPONSE_DRAFT]: RoutingProfile.FAST,
  [AiTask.SUMMARY_GENERATION]: RoutingProfile.FAST,
};

export interface AiRequest {
  prompt: string;
  systemInstruction?: string;
  task?: AiTask;
  /** Force a specific vendor. Denied with 403 if the plan does not include it. */
  provider?: AiProvider;
  /** When present, the organization's plan decides which vendors are reachable. */
  organizationId?: string;
  /** Attribution only — spend is reported per project as well as per org. */
  projectId?: string;
  /**
   * Set false when the caller's configuration forbids switching vendors. The
   * first provider is then the only one tried, and its failure is the answer:
   * a customer who pinned a vendor for a compliance reason must not be quietly
   * served by a different one.
   */
  allowFallback?: boolean;
  /** JSON Schema. When supplied, the response is constrained to match it. */
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  /** Null when we have no published rate for the model — never a guessed number. */
  estimatedCostUsd: number | null;
}

export interface AiCompletion {
  provider: AiProvider;
  model: string;
  text: string;
  usage: AiUsage;
  /** Set when the vendor's safety classifiers declined rather than answered. */
  refused: boolean;
}

/** USD per million tokens. */
export interface Rate {
  input: number;
  output: number;
}

/**
 * Published Anthropic rates. Other vendors are left out deliberately: we report
 * token counts for them but no cost, because a wrong margin number is worse
 * than an absent one. Set GEMINI_RATE_* / OPENAI_RATE_* to fill them in.
 */
export const ANTHROPIC_RATES: Readonly<Record<string, Rate>> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

/** Which vendor each routing profile prefers, best first. */
export const TASK_PREFERENCE: Readonly<Record<RoutingProfile, readonly AiProvider[]>> = {
  [RoutingProfile.REASONING]: [AiProvider.MAMMOUTH, AiProvider.ANTHROPIC, AiProvider.GEMINI, AiProvider.OPENAI, AiProvider.SARVAM, AiProvider.GROQ, AiProvider.OPENROUTER],
  [RoutingProfile.CODE_GEN]: [AiProvider.MAMMOUTH, AiProvider.ANTHROPIC, AiProvider.OPENAI, AiProvider.GEMINI, AiProvider.SARVAM, AiProvider.GROQ, AiProvider.OPENROUTER],
  [RoutingProfile.FAST]: [AiProvider.MAMMOUTH, AiProvider.SARVAM, AiProvider.GROQ, AiProvider.GEMINI, AiProvider.OPENAI, AiProvider.ANTHROPIC, AiProvider.OPENROUTER],
};

/** The routing profile a task uses. Unknown values reason rather than guess cheap. */
export function profileFor(task: AiTask): RoutingProfile {
  return TASK_PROFILE[task] ?? RoutingProfile.REASONING;
}
