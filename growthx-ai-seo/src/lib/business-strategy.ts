import type { BusinessStrategyReport, MarketingStrategy, RivalPush, StrategyAction, StrategyPriceBand } from "@/lib/api-client";

const SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED " };

/** A price in minor units as the page would show it. Mirrors the API's formatPrice. */
export function formatMinor(minor: number, currency: string): string {
  const amount = (minor / 100).toLocaleString("en-IN", {
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const code = currency.toUpperCase();
  return `${SYMBOLS[code] ?? `${code} `}${amount}`;
}

/** "₹34–₹198" or "₹70" for a single price. */
export function bandText(band: StrategyPriceBand): string {
  return band.min === band.max
    ? formatMinor(band.min, band.currency)
    : `${formatMinor(band.min, band.currency)} – ${formatMinor(band.max, band.currency)}`;
}

export interface RivalProductView {
  competitor: string;
  push: RivalPush;
  /** Sarvam's reading of it, when it chose to write about this product. */
  play: MarketingStrategy["rivalProducts"][number] | null;
}

/**
 * Every product a competitor pushes, with the strategy's advice on the ones
 * it wrote about — those first, in the order it ranked them, then the rest in
 * the order the evidence ranked them. The evidence is shown for every one;
 * the advice only where there is some.
 */
export function rivalProductViews(report: BusinessStrategyReport): RivalProductView[] {
  const plays = new Map((report.strategy?.rivalProducts ?? []).map((p, i) => [p.url, { play: p, order: i }]));
  const views: Array<RivalProductView & { order: number }> = [];
  report.facts.competitors.forEach((c, ci) => {
    c.pushed.forEach((push, pi) => {
      const hit = plays.get(push.url);
      views.push({ competitor: c.name, push, play: hit?.play ?? null, order: hit ? hit.order : 1000 + ci * 50 + pi });
    });
  });
  return views.sort((a, b) => a.order - b.order).map((v) => ({ competitor: v.competitor, push: v.push, play: v.play }));
}

/** Plain-words evidence for one pushed product, as short phrases. */
export function evidenceLines(push: RivalPush): string[] {
  return [
    push.linkedFrom > 0 ? `Linked from ${push.linkedFrom} of their own page${push.linkedFrom === 1 ? "" : "s"}` : "",
    push.onHomepage ? "Linked from their homepage" : "",
    push.fromArticles.length
      ? `${push.fromArticles.length} of their article${push.fromArticles.length === 1 ? "" : "s"} point${push.fromArticles.length === 1 ? "s" : ""} to it`
      : "",
  ].filter(Boolean);
}

/** A saved plan for one action of the strategy. */
export function actionPlan(action: StrategyAction): string {
  return [`# ${action.title}`, "", action.why, "", "## Steps", ...action.steps.map((s, i) => `${i + 1}. ${s}`)].join("\n");
}

/** A saved plan for competing with one product a competitor pushes. */
export function counterPlan(view: RivalProductView): string {
  const { push, play, competitor } = view;
  return [
    `# Compete with ${competitor}'s ${push.name}`,
    "",
    play?.whyItWorks ?? "",
    "",
    "## What we saw on their website",
    ...evidenceLines(push).map((l) => `- ${l}`),
    ...(push.linkWords.length ? [`- They link to it as: ${push.linkWords.join(", ")}`] : []),
    ...(push.price ? [`- Their price: ${push.price}`] : []),
    `- Their page: ${push.url}`,
    "",
    "## What to do",
    ...(play?.counter ?? []).map((s, i) => `${i + 1}. ${s}`),
    ...(play?.keywords.length ? ["", "## Words to use", ...play.keywords.map((k) => `- ${k}`)] : []),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}
