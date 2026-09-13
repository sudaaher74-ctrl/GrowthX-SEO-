/**
 * Design Fit scoring and the visual safety checks that gate publishing.
 *
 * Pure and deterministic on purpose: the score decides whether a customer's
 * live page can be changed, so it has to be reproducible, explainable and
 * testable without a browser. Every factor returns its own 0-1 score and a
 * sentence saying why, and the final number is their weighted mean — a "74"
 * a customer disagrees with can be traced to the factor that caused it.
 *
 * Nothing here estimates a figure it cannot measure. When the page snapshot
 * carries no limit for a factor (no measured line height, say), that factor is
 * dropped from the weighting rather than scored against a guessed default: a
 * made-up limit would produce a confident score with nothing behind it.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** Limits measured off the real page. Any of them may be unknown. */
export interface SlotLimits {
  maxWords?: number | null;
  maxChars?: number | null;
  maxDesktopLines?: number | null;
  maxMobileLines?: number | null;
  allowedHtml?: string[];
  /** Text currently occupying the slot, for duplicate detection. */
  currentText?: string | null;
  /** Average characters per rendered line, measured at capture time. */
  desktopCharsPerLine?: number | null;
  mobileCharsPerLine?: number | null;
}

export interface CandidateContent {
  heading?: string | null;
  body: string;
  /** Heading level the new block would introduce, e.g. 2 for an <h2>. */
  headingLevel?: number | null;
  /** Heading level of the section immediately above the insertion point. */
  precedingHeadingLevel?: number | null;
  /** Raw HTML tags the content uses, lowercase, e.g. ["p", "h2", "ul"]. */
  htmlTags?: string[];
}

export interface DesignFitFactor {
  id: string;
  label: string;
  /** 0-1. */
  score: number;
  weight: number;
  detail: string;
}

export interface SafetyCheck {
  id: string;
  label: string;
  passed: boolean;
  /** True when a failure must stop publishing rather than warn. */
  blocking: boolean;
  message: string;
}

export interface DesignFitResult {
  /** 0-100, or null when nothing could be measured. */
  score: number | null;
  label: 'Safe to Publish' | 'Needs Review' | 'High Design Risk' | 'Not scored';
  factors: DesignFitFactor[];
  checks: SafetyCheck[];
  blockingIssues: string[];
  mobileRisk: RiskLevel | null;
  /** Estimated vertical shift, in lines, of everything below the insert. */
  ctaMovementLines: number | null;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Lines the text occupies at a given measured width.
 *
 * Returns null when the page snapshot never measured a characters-per-line
 * figure — an unmeasured width cannot be turned into a line count, and a
 * default would make the overflow checks fire on invented numbers.
 */
export function estimateLines(text: string, charsPerLine?: number | null): number | null {
  if (!charsPerLine || charsPerLine <= 0) return null;
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) return 0;
  return paragraphs.reduce((total, p) => total + Math.ceil(p.trim().length / charsPerLine), 0);
}

/** A ratio of actual-to-limit turned into a 0-1 score. 1 while within limit. */
function headroomScore(actual: number, limit: number): number {
  if (limit <= 0) return 0;
  if (actual <= limit) return 1;
  // Past the limit the score falls off with the size of the overshoot, hitting
  // 0 at double. A 5% overrun is a warning; a 2x overrun is a broken layout.
  const overshoot = (actual - limit) / limit;
  return Math.max(0, 1 - overshoot);
}

const LABEL_FOR = (score: number): DesignFitResult['label'] =>
  score >= 90 ? 'Safe to Publish' : score >= 75 ? 'Needs Review' : 'High Design Risk';

/**
 * Score one candidate against one slot.
 *
 * `seoValue` is an input rather than something computed here: it comes from the
 * SEO issue the suggestion answers, which this module has no view of.
 */
export function scoreDesignFit(
  content: CandidateContent,
  limits: SlotLimits,
  seoValue?: RiskLevel | null,
): DesignFitResult {
  const factors: DesignFitFactor[] = [];
  const checks: SafetyCheck[] = [];

  const words = countWords(content.body);
  const chars = content.body.trim().length;

  // ── Content length ──────────────────────────────────────────────────────
  if (limits.maxWords && limits.maxWords > 0) {
    const score = headroomScore(words, limits.maxWords);
    factors.push({
      id: 'content-length',
      label: 'Content length',
      score,
      weight: 3,
      detail:
        score === 1
          ? `${words} words fits the ${limits.maxWords}-word slot.`
          : `${words} words exceeds the ${limits.maxWords}-word slot.`,
    });
    checks.push({
      id: 'content-length',
      label: 'Content length',
      passed: words <= limits.maxWords,
      blocking: false,
      message:
        words <= limits.maxWords
          ? `${words} of ${limits.maxWords} words.`
          : `${words} words is ${words - limits.maxWords} over what this section holds. Shorten the content.`,
    });
  }

  if (limits.maxChars && limits.maxChars > 0) {
    checks.push({
      id: 'text-overflow',
      label: 'Text overflow',
      passed: chars <= limits.maxChars,
      blocking: chars > limits.maxChars * 1.25,
      message:
        chars <= limits.maxChars
          ? `${chars} of ${limits.maxChars} characters.`
          : `${chars} characters overflows this section's ${limits.maxChars}-character box.`,
    });
  }

  // ── Desktop and mobile layout ───────────────────────────────────────────
  const desktopLines = estimateLines(content.body, limits.desktopCharsPerLine);
  if (desktopLines !== null && limits.maxDesktopLines) {
    const score = headroomScore(desktopLines, limits.maxDesktopLines);
    factors.push({
      id: 'desktop-layout',
      label: 'Desktop layout',
      score,
      weight: 2,
      detail: `${desktopLines} of ${limits.maxDesktopLines} lines on desktop.`,
    });
  }

  const mobileLines = estimateLines(content.body, limits.mobileCharsPerLine);
  let mobileRisk: RiskLevel | null = null;
  if (mobileLines !== null && limits.maxMobileLines) {
    const score = headroomScore(mobileLines, limits.maxMobileLines);
    factors.push({
      id: 'mobile-layout',
      label: 'Mobile layout',
      score,
      weight: 3,
      detail: `${mobileLines} of ${limits.maxMobileLines} lines on mobile.`,
    });
    mobileRisk = score === 1 ? 'LOW' : score >= 0.75 ? 'MEDIUM' : 'HIGH';
    checks.push({
      id: 'mobile-overflow',
      label: 'Mobile layout',
      passed: mobileLines <= limits.maxMobileLines,
      // A broken mobile layout is the failure this whole feature exists to
      // prevent, so it stops publishing rather than warning.
      blocking: mobileLines > limits.maxMobileLines,
      message:
        mobileLines <= limits.maxMobileLines
          ? `${mobileLines} of ${limits.maxMobileLines} lines on mobile.`
          : 'This content causes mobile overflow. Shorten the content or move it to a new section.',
    });
  }

  // ── Heading hierarchy ───────────────────────────────────────────────────
  if (content.headingLevel != null && content.precedingHeadingLevel != null) {
    // Jumping more than one level (h2 straight to h4) breaks the outline that
    // both assistive tech and answer engines read.
    const jump = content.headingLevel - content.precedingHeadingLevel;
    const ok = jump <= 1;
    factors.push({
      id: 'heading-hierarchy',
      label: 'Heading hierarchy',
      score: ok ? 1 : 0,
      weight: 2,
      detail: ok
        ? `h${content.headingLevel} follows h${content.precedingHeadingLevel} correctly.`
        : `h${content.headingLevel} after h${content.precedingHeadingLevel} skips a level.`,
    });
    checks.push({
      id: 'heading-hierarchy',
      label: 'Heading hierarchy',
      passed: ok,
      blocking: false,
      message: ok
        ? 'Heading order is correct.'
        : `Heading jumps from h${content.precedingHeadingLevel} to h${content.headingLevel}. Use h${content.precedingHeadingLevel + 1}.`,
    });
  }

  // ── Allowed markup ──────────────────────────────────────────────────────
  if (limits.allowedHtml?.length && content.htmlTags?.length) {
    const allowed = new Set(limits.allowedHtml.map((t) => t.toLowerCase()));
    const disallowed = content.htmlTags.map((t) => t.toLowerCase()).filter((t) => !allowed.has(t));
    factors.push({
      id: 'markup',
      label: 'Markup compatibility',
      score: disallowed.length === 0 ? 1 : 0,
      weight: 2,
      detail:
        disallowed.length === 0
          ? 'Uses only markup this section already contains.'
          : `Introduces ${disallowed.join(', ')}, which this section does not use.`,
    });
    checks.push({
      id: 'markup',
      label: 'Markup compatibility',
      passed: disallowed.length === 0,
      // New tags can pull in unstyled elements, which is a visible break.
      blocking: disallowed.length > 0,
      message:
        disallowed.length === 0
          ? 'Markup matches the existing section.'
          : `<${disallowed[0]}> is not used anywhere in this section and has no styling.`,
    });
  }

  // ── Duplicate content ───────────────────────────────────────────────────
  const current = (limits.currentText ?? '').trim();
  if (current) {
    const duplicate = normalise(current) === normalise(content.body);
    checks.push({
      id: 'duplicate',
      label: 'Duplicate content',
      passed: !duplicate,
      blocking: duplicate,
      message: duplicate
        ? 'This is identical to the content already on the page.'
        : 'Differs from the content already on the page.',
    });
  }

  // ── Horizontal scrolling ────────────────────────────────────────────────
  // A single unbroken token wider than a mobile line is the usual cause of a
  // page that scrolls sideways on a phone.
  if (limits.mobileCharsPerLine) {
    const longest = content.body
      .split(/\s+/)
      .reduce((max, token) => Math.max(max, token.length), 0);
    const ok = longest <= limits.mobileCharsPerLine;
    checks.push({
      id: 'horizontal-scroll',
      label: 'Horizontal scrolling',
      passed: ok,
      blocking: !ok,
      message: ok
        ? 'No unbreakable text wider than the mobile viewport.'
        : `A ${longest}-character unbroken word is wider than a mobile line and will scroll sideways.`,
    });
  }

  // ── SEO value ───────────────────────────────────────────────────────────
  if (seoValue) {
    factors.push({
      id: 'seo-value',
      label: 'SEO value',
      score: seoValue === 'HIGH' ? 1 : seoValue === 'MEDIUM' ? 0.6 : 0.3,
      weight: 1,
      detail: `SEO value of this change is ${seoValue.toLowerCase()}.`,
    });
  }

  // ── CTA movement ────────────────────────────────────────────────────────
  // Everything below the insertion point moves down by the height of the new
  // block. Null when no line height was measured — not zero, which would read
  // as "nothing moves".
  const ctaMovementLines = desktopLines;

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const score =
    totalWeight === 0
      ? null
      : Math.round(
          (factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight) * 100,
        );

  const blockingIssues = checks.filter((c) => c.blocking && !c.passed).map((c) => c.message);

  return {
    score,
    label: score === null ? 'Not scored' : LABEL_FOR(score),
    factors,
    checks,
    blockingIssues,
    mobileRisk,
    ctaMovementLines,
  };
}

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
