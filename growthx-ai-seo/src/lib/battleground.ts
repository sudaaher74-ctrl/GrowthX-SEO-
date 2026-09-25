/**
 * Battleground: you vs your tracked rivals, from data that is actually held.
 *
 * Every figure here names its source, and a figure nobody measured is null —
 * never 0. A rival with no crawl is "not measured", not "worse than you".
 */

export type MetricKey = "pages" | "health" | "ai" | "rating" | "reviews";

export type SourceLabel = "Crawled" | "AI sampled" | "Google Places";

export interface SideValue {
  id: string;
  name: string;
  value: number | null;
}

export interface Metric {
  key: MetricKey;
  label: string;
  source: SourceLabel;
  you: number | null;
  rivals: SideValue[];
  /** How many observations sit behind the AI figures, so a thin sample says so. */
  sample?: number | null;
  format: (n: number) => string;
  /** The bare figure, for a stat tile whose label already carries the unit. */
  short: (n: number) => string;
}

export interface RivalInput {
  id: string;
  name: string;
  domain: string;
  pagesCrawled: number | null;
  healthScore: number | null;
  aiNamed: number | null;
  aiAnswers: number | null;
  rating: number | null;
  reviewCount: number | null;
  lastAnalyzedAt: string | null;
}

export interface YouInput {
  domain: string;
  pagesCrawled: number | null;
  healthScore: number | null;
  aiSharePct: number | null;
  aiChecked: number | null;
  rating: number | null;
  reviewCount: number | null;
}

/** Below this many sampled answers, an AI share is shown with a warning. */
export const LOW_SAMPLE = 10;

const pct = (n: number) => `${Math.round(n)}%`;
const count = (n: number) => Math.round(n).toLocaleString("en-IN");

function aiPct(named: number | null, answers: number | null): number | null {
  if (named == null || answers == null || answers === 0) return null;
  return (named / answers) * 100;
}

export function buildMetrics(you: YouInput, rivals: RivalInput[]): Metric[] {
  const side = (pick: (r: RivalInput) => number | null): SideValue[] =>
    rivals.map((r) => ({ id: r.id, name: r.name, value: pick(r) }));

  return [
    { key: "pages", label: "Pages on the website", source: "Crawled", you: you.pagesCrawled, rivals: side((r) => r.pagesCrawled), format: (n) => `${count(n)} pages`, short: count },
    { key: "health", label: "Website health score", source: "Crawled", you: you.healthScore, rivals: side((r) => r.healthScore), format: (n) => `${Math.round(n)}/100`, short: (n) => String(Math.round(n)) },
    {
      key: "ai",
      label: "Named by AI assistants",
      source: "AI sampled",
      you: you.aiChecked ? you.aiSharePct : null,
      rivals: side((r) => aiPct(r.aiNamed, r.aiAnswers)),
      sample: you.aiChecked,
      format: pct,
      short: pct,
    },
    { key: "rating", label: "Google rating", source: "Google Places", you: you.rating, rivals: side((r) => r.rating), format: (n) => `${n.toFixed(1)}★`, short: (n) => n.toFixed(1) },
    { key: "reviews", label: "Google reviews", source: "Google Places", you: you.reviewCount, rivals: side((r) => r.reviewCount), format: count, short: count },
  ];
}

/** The strongest rival on a metric, among those actually measured. */
export function bestRival(metric: Metric): SideValue | null {
  let best: SideValue | null = null;
  for (const r of metric.rivals) {
    if (r.value == null) continue;
    if (!best || (best.value ?? -Infinity) < r.value) best = r;
  }
  return best;
}

/** Columns with no measured rival are hidden rather than drawn as a row of dashes. */
export function measuredColumns(metrics: Metric[]): Metric[] {
  return metrics.filter((m) => m.rivals.some((r) => r.value != null));
}

// ─── Moves ───────────────────────────────────────────────────────────────────

export type MoveKind = MetricKey | "content-gap" | "keyword-gap";

export interface Move {
  id: string;
  kind: MoveKind;
  rival: string;
  title: string;
  detail: string;
  source: SourceLabel;
  /** "Measured", or why the number should be read carefully. */
  confidence: string;
  /** 0–1: how far behind you are. Only used to order the list. */
  weight: number;
  context: Record<string, string | number>;
}

export interface GapCandidate {
  rival: string;
  rivalDomain: string;
  topic: string;
  url?: string;
}

/**
 * Words that say nothing about what a page is for, and pages that are not
 * content. A gap made of these is noise: "Login" is not a topic to write.
 */
const UTILITY_PATH = /\/(admin|wp-admin|login|signin|sign-in|register|account|my-account|cart|checkout|basket|search|tag|tags|author|category|feed|404|privacy|privacy-policy|terms|terms-of-service|refund|shipping-policy|cookie|sitemap)(\/|$)/i;
const UTILITY_TOPIC = /^(home|homepage|login|sign in|register|cart|checkout|my account|search|404|page not found|privacy policy|terms( (and|&) conditions)?|contact( us)?|about( us)?|blog|shop|products?)$/i;

/**
 * Brand names are the rival's, not a gap: nobody should target "Blinkit".
 * Whole names only — a rival called "Milk Delivery" must not hide every milk
 * topic from a dairy brand.
 */
export function brandTerms(rival: { name: string; domain: string }): string[] {
  const root = (rival.domain.replace(/^www\./, "").split(".")[0] ?? "").toLowerCase();
  const name = rival.name.toLowerCase().trim();
  return [...new Set([root, name].filter((t) => t.length > 2))];
}

export function isJunkGap(gap: GapCandidate, rivalName: string): boolean {
  const topic = gap.topic.trim();
  if (topic.length < 4 || !/\s/.test(topic)) return true; // single generic words
  if (UTILITY_TOPIC.test(topic)) return true;
  if (gap.url && UTILITY_PATH.test(safePath(gap.url))) return true;
  const lower = topic.toLowerCase();
  return brandTerms({ name: rivalName, domain: gap.rivalDomain }).some((b) => lower.includes(b));
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

const METRIC_COPY: Record<MetricKey, (rival: string, them: string, you: string) => { title: string; detail: string }> = {
  pages: (r, t, y) => ({
    title: `${r} has more pages than you`,
    detail: `${r} has ${t}; you have ${y}. Every useful page is another way for customers to find them. The Gaps tab shows which topics they cover.`,
  }),
  health: (r, t, y) => ({
    title: `${r}'s website has fewer technical problems`,
    detail: `Their website health score is ${t}; yours is ${y}. Fixing the problems on your own website (listed in Website Audit) makes it easier for Google to show your pages.`,
  }),
  ai: (r, t, y) => ({
    title: `AI assistants mention ${r} more often`,
    detail: `When we asked AI assistants like ChatGPT the questions your customers ask, they named ${r} in ${t} of answers and you in ${y}.`,
  }),
  rating: (r, t, y) => ({
    title: `${r} has a better Google rating`,
    detail: `${t} on Google against your ${y}. People often choose the business with better stars.`,
  }),
  reviews: (r, t, y) => ({
    title: `${r} has more Google reviews`,
    detail: `${t} reviews against your ${y}. More reviews make people trust a business and help it show up on Google Maps.`,
  }),
};

/**
 * The few things most worth doing this week: where a rival is measurably
 * ahead, and pages or topics they have that you do not.
 */
export function buildMoves(
  metrics: Metric[],
  gaps: { content: GapCandidate[]; keyword: GapCandidate[] },
  ignored: ReadonlySet<string>,
  limit = 3,
): Move[] {
  const moves: Move[] = [];

  for (const m of metrics) {
    const best = bestRival(m);
    if (!best || best.value == null || m.you == null) continue;
    if (best.value <= m.you) continue;
    const copy = METRIC_COPY[m.key](best.name, m.format(best.value), m.format(m.you));
    const lowSample = m.key === "ai" && (m.sample ?? 0) < LOW_SAMPLE;
    moves.push({
      id: `${m.key}:${best.id}`,
      kind: m.key,
      rival: best.name,
      ...copy,
      source: m.source,
      confidence: lowSample ? `Based on only ${m.sample ?? 0} AI answers` : "Measured",
      weight: (best.value - m.you) / Math.max(best.value, 1),
      context: { you: m.format(m.you), them: m.format(best.value), metric: m.label },
    });
  }

  const firstClean = (list: GapCandidate[]) => list.find((g) => !isJunkGap(g, g.rival));
  const content = firstClean(gaps.content);
  if (content) {
    moves.push({
      id: `content-gap:${content.topic.toLowerCase()}`,
      kind: "content-gap",
      rival: content.rival,
      title: `They have a page about "${content.topic}" and you don't`,
      detail: `${content.rival} has a page on this${content.url ? ` (${safePath(content.url)})` : ""}. We found nothing on your website about it, so people searching for it find them, not you.`,
      source: "Crawled",
      confidence: "Measured",
      weight: 0.5,
      context: { topic: content.topic, url: content.url ?? "", rivalDomain: content.rivalDomain },
    });
  }
  const keyword = firstClean(gaps.keyword);
  if (keyword) {
    moves.push({
      id: `keyword-gap:${keyword.topic.toLowerCase()}`,
      kind: "keyword-gap",
      rival: keyword.rival,
      title: `${keyword.rival} uses the words "${keyword.topic}" in their headlines, and you don't`,
      detail: `People searching for these words are more likely to find ${keyword.rival}. Using them on your matching page helps you show up too.`,
      source: "Crawled",
      confidence: "Measured",
      weight: 0.4,
      context: { topic: keyword.topic, rivalDomain: keyword.rivalDomain },
    });
  }

  // A gap is the most actionable card there is, so the best one always gets a
  // slot rather than being crowded out by metric deltas.
  const open = moves.filter((m) => !ignored.has(m.id)).sort((a, b) => b.weight - a.weight);
  const gap = open.find((m) => m.kind === "content-gap" || m.kind === "keyword-gap");
  const picked = open.slice(0, limit);
  if (gap && !picked.includes(gap)) picked[picked.length - 1] = gap;
  return picked.sort((a, b) => b.weight - a.weight);
}

// ─── Threat ──────────────────────────────────────────────────────────────────

export type ThreatLevel = "High" | "Medium" | "Low" | "Not measured";

export interface Threat {
  id: string;
  name: string;
  domain: string;
  level: ThreatLevel;
  /** Metrics where this rival is ahead of you, of those measured for both. */
  ahead: string[];
  measured: number;
  lastAnalyzedAt: string | null;
}

export function buildThreats(metrics: Metric[], rivals: RivalInput[]): Threat[] {
  const order: Record<ThreatLevel, number> = { High: 0, Medium: 1, Low: 2, "Not measured": 3 };
  return rivals
    .map((r) => {
      const ahead: string[] = [];
      let measured = 0;
      for (const m of metrics) {
        const theirs = m.rivals.find((x) => x.id === r.id)?.value ?? null;
        if (theirs == null || m.you == null) continue;
        measured += 1;
        if (theirs > m.you) ahead.push(m.label);
      }
      const level: ThreatLevel =
        measured === 0 ? "Not measured" : ahead.length >= 3 ? "High" : ahead.length >= 1 ? "Medium" : "Low";
      return { id: r.id, name: r.name, domain: r.domain, level, ahead, measured, lastAnalyzedAt: r.lastAnalyzedAt };
    })
    .sort((a, b) => order[a.level] - order[b.level] || b.ahead.length - a.ahead.length);
}

// ─── Plan ────────────────────────────────────────────────────────────────────

/** Why a move matters and what to do, in plain steps. */
export function movePlan(move: Move, you: { domain: string; brand: string }): { why: string; steps: string[] } {
  const topic = String(move.context.topic ?? "");
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  switch (move.kind) {
    case "content-gap":
      return {
        why: move.detail,
        steps: [
          `Create a new page about "${topic}", for example at https://${you.domain}/${slug}.`,
          `Give it a clear title, such as "${topic} | ${you.brand}", and use the same words as the main headline on the page.`,
          `Start with a short, direct answer: what ${topic} is and who it's for. Then add the details: options, prices, how it works, areas you serve.`,
          `Add 4-6 questions customers really ask about ${topic}, each with a short answer.`,
          "End with a clear next step: call, WhatsApp or order.",
          "Link to the new page from your homepage and from 2 related pages.",
          ...(move.context.url ? [`For reference, their page: ${move.context.url}`] : []),
        ],
      };
    case "keyword-gap":
      return {
        why: move.detail,
        steps: [
          `Pick the one page on your website that is closest to "${topic}", or create one.`,
          `Put "${topic}" in that page's title (the blue link people see in Google) and in its main headline.`,
          "Use the words once more in the first paragraph, naturally.",
          "Use them on one page only, so your own pages don't compete with each other.",
        ],
      };
    case "health":
      return {
        why: move.detail,
        steps: [
          "Open Website Audit. It lists your website's problems, most important first.",
          "Fix the top problems first, or send the list to whoever looks after your website.",
          "Run the audit again to check your score went up.",
        ],
      };
    case "pages":
      return {
        why: move.detail,
        steps: [
          "Open the Gaps tab to see the exact topics they have pages for and you don't.",
          "Pick the topics that match what you sell, and write one helpful page for each.",
          "Don't make lots of near-identical pages; each page should answer a real customer question.",
          "Publish 3-5 at a time, then run Website Audit again so they're picked up.",
        ],
      };
    case "ai":
      return {
        why: move.detail,
        steps: [
          "On your main pages, answer the questions customers ask in 2-3 plain sentences near the top.",
          "Add a short questions-and-answers section to those pages.",
          "Keep facts up to date: prices, delivery areas, timings.",
          "Get mentioned on trusted websites: local directories, review sites, news or blogs.",
          "Check the AI Answers tab in a week or two to see if you're named more often.",
        ],
      };
    case "rating":
    case "reviews":
      return {
        why: move.detail,
        steps: [
          "Ask every happy customer for a Google review, with a direct link, within a day of delivery.",
          "Reply to every review, good or bad, within 2 days.",
          "Never offer gifts or discounts for reviews; Google removes them.",
        ],
      };
  }
}

/**
 * The plan written out for a person to apply. Nothing here touches the
 * client's site: it is a plan to copy, hand over, or follow.
 */
export function buildCounterBrief(move: Move, you: { domain: string; brand: string }): string {
  const { why, steps } = movePlan(move, you);
  return (
    `# Plan: ${move.title}

Competitor: ${move.rival}
Your website: ${you.domain}

` +
    `## Why this matters
${why}

## What to do
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
`
  );
}
