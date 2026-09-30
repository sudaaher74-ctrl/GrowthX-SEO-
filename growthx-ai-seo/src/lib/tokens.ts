import type { TokenTransaction, TokensOverview } from "@/lib/api-client";

/** The tokens payload once we know the deployment has them switched on. */
export type ActiveTokens = Extract<TokensOverview, { enabled: true }>;

export function isActive(tokens: TokensOverview | undefined): tokens is ActiveTokens {
  return tokens?.enabled === true;
}

/**
 * A balance for tight spaces: 4,955,000 -> "4.96M", 12,300 -> "12.3K".
 *
 * Balances run to millions, so the exact figure does not fit a sidebar; every
 * place that shows this also has the exact figure a hover away
 * (`formatTokensExact`).
 */
export function formatTokens(value: number): string {
  const n = Math.round(value);
  const abs = Math.abs(n);
  if (abs < 1_000) return String(n);

  const steps = [
    { below: 1e6, divisor: 1e3, suffix: "K", digits: 1 },
    // Three decimals at this scale: a month's allowance is a few million and a
    // day's use is thousands, so two decimals rounds "4,995,208 left" up to a
    // "5M" that looks untouched.
    { below: 1e9, divisor: 1e6, suffix: "M", digits: 3 },
    { below: Infinity, divisor: 1e9, suffix: "B", digits: 3 },
  ];
  for (const step of steps) {
    if (abs >= step.below) continue;
    // Number() drops the trailing zero: 4.50 -> "4.5", 1.00 -> "1".
    const scaled = Number((n / step.divisor).toFixed(step.digits));
    // 999,999 rounds to "1000K"; let it roll into the next unit instead.
    if (Math.abs(scaled) >= 1_000 && step.suffix !== "B") continue;
    return `${scaled}${step.suffix}`;
  }
  return String(n);
}

export function formatTokensExact(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** "1 October": when the monthly tokens refill. The API works in UTC months, so this does too. */
export function refillDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

/**
 * Where a workspace stands, in one word, so the sidebar chip, the banner and
 * the page cannot disagree about it.
 *
 * `tracking` is shadow mode: usage is counted but nothing is ever refused, so
 * "out" and "low" would be warnings about a wall that is not there.
 */
export type Standing = "ok" | "low" | "out" | "tracking";

/** Below this share of a month's allowance, the workspace is running low. */
const LOW_SHARE = 0.1;

export function standingOf(tokens: ActiveTokens): Standing {
  if (tokens.mode === "shadow") return "tracking";
  if (tokens.available <= 0) return "out";
  // Measured against what this month was granted, not what next month will be:
  // an operator changing the figure mid-month has not changed how much of it is gone.
  const granted = tokens.allowance.granted;
  return granted > 0 && tokens.available < granted * LOW_SHARE ? "low" : "ok";
}

/** Share of this month's allowance still unspent, 0-100; null when there was no allowance to be a share of. */
export function allowanceLeftPct(tokens: ActiveTokens): number | null {
  const { remaining, granted } = tokens.allowance;
  if (granted <= 0) return null;
  return Math.max(0, Math.min(100, (remaining / granted) * 100));
}

/**
 * What a spend cost, as opposed to what was taken.
 *
 * In enforce mode the two differ only when a call finished after the balance
 * ran out, and "taken" is the honest figure with the shortfall shown beside it.
 * In shadow mode nothing is ever refused, so a call the empty wallet could not
 * cover still cost what it cost — and that demand is the whole reason to watch.
 */
export function costOf(entry: { tokens: number; shortfall: number }, mode: ActiveTokens["mode"], kind: "usage" | "row"): number {
  const covered = kind === "row" ? -entry.tokens : entry.tokens;
  return mode === "shadow" ? covered + entry.shortfall : covered;
}

// ─────────────────────────────────────────────────────────────────── ledger

/** Words that stay upper-case when a code like SEO_ANALYSIS is turned into prose. */
const ACRONYMS = new Set(["SEO", "AI", "GBP", "URL", "FAQ", "GEO", "API"]);

/** SEO_ANALYSIS -> "SEO analysis". */
function humanize(code: string): string {
  const words = code
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => (ACRONYMS.has(word.toUpperCase()) ? word.toUpperCase() : word.toLowerCase()));
  if (words.length === 0) return code;
  const [first, ...rest] = words;
  return [ACRONYMS.has(first.toUpperCase()) ? first : first[0].toUpperCase() + first.slice(1), ...rest].join(" ");
}

/** What each thing that moves tokens is called on a customer's screen. */
const ACTION_LABELS: Record<string, string> = {
  AI_USAGE: "AI analysis and writing",
  GEO_GRID_POINT: "Local ranking scan",
  MONTHLY_ALLOWANCE: "Monthly tokens",
  ALLOWANCE_EXPIRED: "Unused monthly tokens expired",
  ADMIN_GRANT: "Tokens added by GrowthX",
  ADMIN_ADJUSTMENT: "Adjustment by GrowthX",
  PURCHASE: "Tokens purchased",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? humanize(action);
}

/**
 * Customer wording for the AI's internal task codes.
 *
 * The routing profiles (REASONING, FAST, CODE_GEN) are what a call is filed
 * under when its caller named no task, so they say nothing worth showing — the
 * row falls back to the generic label. Where plain humanizing would read like
 * engineering ("Code generation"), the entry says what it is for.
 */
const AI_TASK_LABELS: Record<string, string | null> = {
  REASONING: null,
  FAST: null,
  CODE_GEN: null,
  CODE_GENERATION: "Fix suggestion",
  CODE_REVIEW: "Fix review",
  FIX_VALIDATION: "Fix check",
  SEO_OPPORTUNITY_GENERATION: "Opportunity ideas",
  REVIEW_RESPONSE_DRAFT: "Review reply draft",
  SUMMARY_GENERATION: "Summary",
};

/** The short name of what the AI did, or null when the row should just say "AI analysis and writing". */
function aiTaskLabel(task: string | null): string | null {
  if (!task) return null;
  return task in AI_TASK_LABELS ? AI_TASK_LABELS[task] : humanize(task);
}

const asText = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const asCount = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/**
 * A ledger row in words a business owner can read.
 *
 * Built only from what the row recorded: a missing fact is left out of the
 * note rather than filled in, in keeping with the rest of the product.
 */
export function describeTransaction(row: TokenTransaction): { title: string; note: string | null } {
  const detail = row.detail ?? {};

  if (row.kind === "REFUND") {
    return {
      title: `Refund: ${actionLabel(row.action)}`,
      note: "The work did not finish, so its tokens were returned.",
    };
  }

  if (row.kind === "SPEND" && row.action === "AI_USAGE") {
    const task = asText(detail.task);
    const read = asCount(detail.inputTokens);
    const written = asCount(detail.outputTokens);
    const model = asText(detail.model);
    const parts = [
      read !== null ? `${formatTokensExact(read)} read` : null,
      written !== null ? `${formatTokensExact(written)} written` : null,
      model,
      detail.estimated === true ? "estimated" : null,
    ].filter((part): part is string => part !== null);
    const label = aiTaskLabel(task);
    return {
      title: label ? `AI: ${label}` : actionLabel(row.action),
      note: parts.length > 0 ? parts.join(" · ") : null,
    };
  }

  if (row.kind === "SPEND" && row.action === "GEO_GRID_POINT") {
    const size = asCount(detail.gridSize);
    const keyword = asText(detail.keyword);
    const parts = [size !== null ? `${size}×${size} grid` : null, keyword ? `for “${keyword}”` : null].filter(
      (part): part is string => part !== null,
    );
    return { title: actionLabel(row.action), note: parts.length > 0 ? parts.join(" ") : null };
  }

  return { title: actionLabel(row.action), note: null };
}
