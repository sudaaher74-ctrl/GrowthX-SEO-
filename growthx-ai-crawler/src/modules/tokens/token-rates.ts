/**
 * What things cost in tokens, and the environment that tunes it.
 *
 * Everything a deployment would want to change about pricing is in this file
 * and reads from the environment: no number here is a fact about the world, so
 * none is baked into a code path. The defaults are starting points chosen to be
 * safe rather than tight — see each one.
 */

/**
 * Everything that can spend tokens. Stored as text in the ledger, so adding one
 * needs no migration; it needs a price in `TokenConfig.unitCosts` and one call
 * to `TokensService.withCharge`.
 */
export enum TokenAction {
  /** Model calls, charged from the tokens the model actually used. */
  AI_USAGE = 'AI_USAGE',
  /** One Google Places lookup: a single point of a geo-grid scan. */
  GEO_GRID_POINT = 'GEO_GRID_POINT',
}

/** Actions with a fixed price per unit (everything except metered AI usage). */
export type FixedPriceAction = Exclude<TokenAction, TokenAction.AI_USAGE>;

/**
 * `enforce`  refuse work the wallet cannot pay for.
 * `shadow`   do everything except refuse: balances move and the ledger fills,
 *            so the real burn rate can be watched before anyone is blocked.
 * `off`      the system is inert; no wallet is created or touched.
 */
export type TokenMode = 'enforce' | 'shadow' | 'off';

export interface TokenConfig {
  mode: TokenMode;
  /** Granted every UTC month to a wallet that has no figure of its own. */
  monthlyAllowance: number;
  /** Tokens charged per model input token. */
  aiInputWeight: number;
  /** Tokens charged per model output token. */
  aiOutputWeight: number;
  /** Tokens a wallet must hold before an AI call may start. */
  minimumToStartAi: number;
  /** Tokens per unit of each fixed-price action. */
  unitCosts: Record<FixedPriceAction, number>;
}

/**
 * Deliberately generous, and a starting point rather than a measurement. The
 * right allowance is a business decision this code cannot calibrate: too tight
 * blocks paying customers the day this ships, while too loose only delays the
 * ceiling. Set TOKENS_ENFORCEMENT=shadow to watch real usage fill the ledger
 * before choosing a number, then tune it here.
 */
export const DEFAULT_MONTHLY_ALLOWANCE = 5_000_000;

/**
 * 1 token per model token in, 4 per model token out. Vendors price generation
 * at roughly four to five times reading, so a flat 1:1 would let a
 * generation-heavy call cost the platform several times what a reading-heavy
 * one does for the same tokens. Both raw counts are kept on every ledger row,
 * so the charge can always be checked against what the provider reported.
 */
export const DEFAULT_AI_INPUT_WEIGHT = 1;
export const DEFAULT_AI_OUTPUT_WEIGHT = 4;

/**
 * A grid point is one Places Text Search request. At Google's list price when
 * this was written that is a few cents — thousands of times what a model token
 * costs — so a point is priced in the thousands: a 3x3 scan costs 45,000 and a
 * 9x9 scan 405,000. A scan had no ceiling of any kind before, and is the most
 * expensive single click in the product. Re-check against current pricing.
 */
export const DEFAULT_GEO_GRID_POINT_COST = 5_000;

/**
 * The largest single amount any operation moves, and the largest balance a
 * bucket may hold. Columns are 32-bit; staying well inside them means a typo in
 * a grant is refused with a message instead of failing in the database.
 */
export const MAX_TOKENS_PER_OPERATION = 1_000_000_000;
export const MAX_BUCKET_BALANCE = 2_000_000_000;

function readNumber(raw: string | undefined, fallback: number, options: { min: number; max: number; integer: boolean }): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < options.min || n > options.max) return fallback;
  return options.integer ? Math.floor(n) : n;
}

export function readTokenConfig(env: NodeJS.ProcessEnv = process.env): TokenConfig {
  const rawMode = (env.TOKENS_ENFORCEMENT ?? '').trim().toLowerCase();
  const mode: TokenMode = rawMode === 'shadow' || rawMode === 'off' ? rawMode : 'enforce';

  return {
    mode,
    monthlyAllowance: readNumber(env.TOKENS_MONTHLY_ALLOWANCE, DEFAULT_MONTHLY_ALLOWANCE, {
      min: 0,
      max: MAX_TOKENS_PER_OPERATION,
      integer: true,
    }),
    aiInputWeight: readNumber(env.TOKENS_AI_INPUT_WEIGHT, DEFAULT_AI_INPUT_WEIGHT, { min: 0, max: 1_000, integer: false }),
    aiOutputWeight: readNumber(env.TOKENS_AI_OUTPUT_WEIGHT, DEFAULT_AI_OUTPUT_WEIGHT, { min: 0, max: 1_000, integer: false }),
    minimumToStartAi: readNumber(env.TOKENS_MIN_TO_START_AI, 1, { min: 1, max: MAX_TOKENS_PER_OPERATION, integer: true }),
    unitCosts: {
      [TokenAction.GEO_GRID_POINT]: readNumber(env.TOKENS_COST_GEO_GRID_POINT, DEFAULT_GEO_GRID_POINT_COST, {
        min: 0,
        max: MAX_TOKENS_PER_OPERATION,
        integer: true,
      }),
    },
  };
}

/**
 * What a model call costs in tokens, from the counts the provider reported.
 * Rounded up: a call that used anything is never free, and never a fraction.
 */
export function aiUsageTokens(inputTokens: number, outputTokens: number, config: TokenConfig): number {
  const input = Number.isFinite(inputTokens) ? Math.max(0, inputTokens) : 0;
  const output = Number.isFinite(outputTokens) ? Math.max(0, outputTokens) : 0;
  return Math.ceil(input * config.aiInputWeight + output * config.aiOutputWeight);
}

/**
 * A stand-in for token counts a provider did not report.
 *
 * Some responses carry no usage block, and treating "unreported" as "zero"
 * would make exactly those calls free. About four characters to a token is the
 * usual rule of thumb for English text; it is an estimate, and callers that use
 * it say so on the ledger row.
 */
export function estimateTokensFromChars(characters: number): number {
  return Number.isFinite(characters) && characters > 0 ? Math.ceil(characters / 4) : 0;
}

/** The price of `quantity` units of a fixed-price action. */
export function fixedPriceTokens(action: FixedPriceAction, quantity: number, config: TokenConfig): number {
  const units = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  return units * config.unitCosts[action];
}

export interface DebitSplit {
  fromAllowance: number;
  fromBonus: number;
  /** What could not be covered by either bucket. */
  shortfall: number;
}

/**
 * Takes `amount` from the allowance first, then from bonus tokens.
 *
 * Allowance first because it lapses at the end of the month and bonus tokens do
 * not: spending the perishable ones first is what makes keeping them apart
 * worth doing.
 */
export function splitDebit(allowance: number, bonus: number, amount: number): DebitSplit {
  const fromAllowance = Math.min(Math.max(0, allowance), amount);
  const fromBonus = Math.min(Math.max(0, bonus), amount - fromAllowance);
  return { fromAllowance, fromBonus, shortfall: amount - fromAllowance - fromBonus };
}

/** The UTC calendar month containing `now`: the period an allowance covers. */
export function periodContaining(now: Date): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}
