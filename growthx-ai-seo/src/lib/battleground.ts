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
    { key: "pages", label: "Content coverage", source: "Crawled", you: you.pagesCrawled, rivals: side((r) => r.pagesCrawled), format: (n) => `${count(n)} pages`, short: count },
    { key: "health", label: "Tech health", source: "Crawled", you: you.healthScore, rivals: side((r) => r.healthScore), format: (n) => `${Math.round(n)}/100`, short: (n) => String(Math.round(n)) },
    {
      key: "ai",
      label: "AI answer share",
      source: "AI sampled",
      you: you.aiChecked ? you.aiSharePct : null,
      rivals: side((r) => aiPct(r.aiNamed, r.aiAnswers)),
      sample: you.aiChecked,
      format: pct,
      short: pct,
    },
    { key: "rating", label: "Local rating", source: "Google Places", you: you.rating, rivals: side((r) => r.rating), format: (n) => `${n.toFixed(1)}★`, short: (n) => n.toFixed(1) },
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
  pages: (r, t, y) => ({ title: `${r} covers more ground`, detail: `${r} has ${t} crawled; you have ${y}. More pages means more questions they can answer.` }),
  health: (r, t, y) => ({ title: `${r}'s site is technically healthier`, detail: `Tech health ${t} vs your ${y}. Fixing your top issues closes this fastest.` }),
  ai: (r, t, y) => ({ title: `${r} is named more often by AI assistants`, detail: `Named in ${t} of sampled AI answers vs your ${y} citation share.` }),
  rating: (r, t, y) => ({ title: `${r} is rated higher on Google`, detail: `${t} on Google vs your ${y}.` }),
  reviews: (r, t, y) => ({ title: `${r} has more Google reviews`, detail: `${t} reviews vs your ${y}.` }),
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
      confidence: lowSample ? `Low sample (n=${m.sample ?? 0})` : "Measured",
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
      title: `No page of yours covers "${content.topic}"`,
      detail: `${content.rival} has a dedicated page for it${content.url ? ` (${safePath(content.url)})` : ""}. Your crawl found nothing matching.`,
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
      title: `"${keyword.topic}" appears on ${keyword.rival}'s pages, not yours`,
      detail: `Found in their titles and headings. This is what their pages say, not a ranking: rankings need a search data source.`,
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

// ─── Counter brief ───────────────────────────────────────────────────────────

/**
 * The fix, written out for a person to apply. Nothing here touches the
 * client's site: the Fix Engine is not enabled on this deployment, so a
 * counter-move is a brief to copy, hand over, or paste into the CMS.
 */
export function buildCounterBrief(move: Move, you: { domain: string; brand: string }): string {
  const header = `# Counter-move: ${move.title}\n\nRival: ${move.rival}\nSource: ${move.source} · ${move.confidence}\n\n`;
  const topic = String(move.context.topic ?? "");
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  switch (move.kind) {
    case "content-gap":
      return (
        header +
        `## Page to create\n- URL: https://${you.domain}/${slug}\n- Title (50–60 chars): ${topic} | ${you.brand}\n- H1: ${topic}\n\n` +
        `## Outline\n1. Direct answer in the first 60 words: what ${topic} is and who it is for.\n2. Details: specifications, process or options.\n3. Why ${you.brand}: proof, certifications, delivery areas.\n4. FAQ: 4–6 questions buyers actually ask.\n5. Call to action: enquiry or order.\n\n` +
        `## FAQ schema (fill in the answers)\n\`\`\`html\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n    { "@type": "Question", "name": "What is ${topic}?", "acceptedAnswer": { "@type": "Answer", "text": "…" } }\n  ]\n}\n</script>\n\`\`\`\n\n` +
        `## Internal links\n- Link to the new page from your homepage and from 2 related product or service pages.\n\n` +
        `## Rival reference\n${move.context.url || move.context.rivalDomain}\n`
      );
    case "keyword-gap":
      return (
        header +
        `## Where to use "${topic}"\n- Pick the one existing page closest to this term, or create one.\n- Title: ${topic} | ${you.brand}\n- Meta description (150–160 chars): start with ${topic}, say who it is for, end with a reason to click.\n- Use the exact phrase once in the H1 or an H2, and once in the first paragraph.\n\n` +
        `## Check before publishing\n- One page per term: do not add it to several pages that then compete with each other.\n`
      );
    case "health":
      return (
        header +
        `## Close the gap: ${move.context.them} vs your ${move.context.you}\n1. Open Website Audit → Issues and sort by impact.\n2. Fix high-severity issues first: duplicate titles, missing canonicals, broken links.\n3. Re-crawl from Website Audit to confirm the score moved.\n`
      );
    case "pages":
      return (
        header +
        `## Close the gap: ${move.context.them} vs your ${move.context.you}\n1. Open Gaps to see the topics they cover that you do not.\n2. Plan one page per real buyer question, not thin copies of each other.\n3. Publish in batches of 3–5 and re-crawl to confirm they are found.\n`
      );
    case "ai":
      return (
        header +
        `## Earn AI citations\n1. On the pages behind your tracked questions, add a 45–60 word direct answer at the top.\n2. Add FAQPage JSON-LD for the questions on the page.\n3. Keep facts current: dates, prices, delivery areas.\n4. Re-run the AI Visibility sweep to measure the change.\n`
      );
    case "rating":
    case "reviews":
      return (
        header +
        `## Grow reviews: ${move.context.them} vs your ${move.context.you}\n1. Ask every happy customer for a review, with a direct link, within 24 hours of delivery.\n2. Reply to every review, good or bad, within 2 days.\n3. Never offer incentives for reviews; Google removes them.\n`
      );
  }
}
