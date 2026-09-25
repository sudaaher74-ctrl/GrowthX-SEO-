import type { RivalMove } from "@/lib/api-client";
import { googleExtra } from "@/lib/gaps-plain";

/**
 * Rival Radar in plain words: what a competitor changed, why they probably
 * did it, and what to do about it.
 */

export interface RadarItem {
  id: string;
  kind: RivalMove["kind"];
  rival: string;
  rivalDomain: string;
  at: string;
  headline: string;
  why: string;
  steps: string[];
  example?: { label: string; url: string };
  /** Where the change was seen, in words. */
  seenBy: string;
}

export const KIND_LABEL: Record<RivalMove["kind"], string> = {
  NEW_PAGE: "New pages",
  EXPANDED: "Bigger pages",
  RETITLED: "New headlines",
  SCHEMA_ADDED: "New Google details",
  PAGE_GONE: "Removed pages",
  AI_NAMED: "AI recommendations",
};

/** JSON-LD @type values, as the daily check records them, to the names used in Gaps. */
const LD_TO_TYPE: Record<string, string> = {
  FAQPage: "FAQ",
  LocalBusiness: "LOCAL_BUSINESS",
  Store: "LOCAL_BUSINESS",
  Review: "REVIEW",
  AggregateRating: "REVIEW",
  Product: "PRODUCT",
  Offer: "PRODUCT",
  Article: "ARTICLE",
  BlogPosting: "ARTICLE",
  NewsArticle: "ARTICLE",
  BreadcrumbList: "BREADCRUMB",
  Organization: "ORGANIZATION",
  VideoObject: "VIDEO",
  Recipe: "RECIPE",
  Event: "EVENT",
};

export function extraName(ldType: string): string {
  const mapped = LD_TO_TYPE[ldType];
  return mapped ? googleExtra(mapped).name : ldType.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Where the change was seen, with the dates, so it can be checked. */
function seenBy(m: RivalMove): string {
  switch (m.source) {
    case "daily-check":
      return `Seen in our daily check of their website on ${day(m.at)}`;
    case "crawl":
      return m.comparedWith
        ? `Seen by comparing our reads of their website on ${day(m.comparedWith)} and ${day(m.at)}`
        : `Seen when we read their website on ${day(m.at)}`;
    case "ai-answers":
      return `Seen in the AI answer checks, latest on ${day(m.at)}`;
  }
}

const quote = (s: string | null | undefined) => (s ? `"${s.split(/\s[|–-]\s/)[0].trim()}"` : "a page");

export function toRadarItem(m: RivalMove): RadarItem {
  const example = m.url && /^https?:\/\//.test(m.url) ? { label: `See ${m.rival}'s page`, url: m.url } : undefined;
  const common = { id: m.id, kind: m.kind, rival: m.rival, rivalDomain: m.rivalDomain, at: m.at, seenBy: seenBy(m), example };

  switch (m.kind) {
    case "NEW_PAGE":
      return {
        ...common,
        headline: `${m.rival} published a new page: ${quote(m.title)}`,
        why: "A new page usually means they want to be found for a new search. If it matters to your customers, you should have a page on it too.",
        steps: [
          `Open their new page and see what it offers${m.url ? `: ${m.url}` : "."}`,
          "Decide if this topic matters to your customers. If not, ignore it.",
          "If it does, write your own page on it with your prices, areas and real photos, and make it more helpful than theirs.",
          "Link to it from your menu or a related page so visitors and Google find it.",
        ],
      };
    case "EXPANDED":
      return {
        ...common,
        headline: `${m.rival} made their ${quote(m.title)} page much more detailed`,
        why: `It grew from about ${m.words?.from.toLocaleString("en-IN")} to ${m.words?.to.toLocaleString("en-IN")} words. Businesses add detail to pages they want to rank higher; a more complete page tends to beat a thinner one.`,
        steps: [
          "Open their page and note what they added.",
          "Find your page on the same topic (or create one).",
          "Add the details customers need that yours is missing: prices, what's included, areas, timings, questions and answers.",
        ],
      };
    case "RETITLED":
      return {
        ...common,
        headline: `${m.rival} changed a page headline to "${m.to}"`,
        why: `It used to say "${m.from}". A new headline usually means they're going after different searches, often the exact words customers type.`,
        steps: [
          `Look at the words in their new headline: "${m.to}".`,
          "If those words describe what you offer, use them in the headline of your matching page.",
          "Keep each of your pages focused on one topic, so they don't compete with each other.",
        ],
      };
    case "SCHEMA_ADDED": {
      const names = (m.added ?? []).map(extraName);
      return {
        ...common,
        headline: `${m.rival} started giving Google "${names.join(", ")}" on ${quote(m.title)}`,
        why: "These hidden details help Google show extra information like stars, prices or answers next to their page in search results, which gets them more clicks.",
        steps: [
          `Ask whoever built your website to add "${names.join(", ")}" details (structured data) to your matching pages.`,
          "Most website builders and plugins (for example Yoast or Rank Math on WordPress) can do this without coding.",
          "Check it afterwards with Google's free Rich Results Test.",
        ],
      };
    }
    case "PAGE_GONE":
      return {
        ...common,
        headline: `${m.rival}'s page ${quote(m.title)} has disappeared`,
        why: "People may still search for this, and other websites may still link to it. If you have a good page on the same topic, you can pick up those visitors.",
        steps: [
          "Check whether your website has a page on this topic.",
          "If not, write one. If yes, make sure it is up to date and easy to find.",
          "Optional: find websites that linked to their old page and ask them to link to yours instead.",
        ],
      };
    case "AI_NAMED":
      return {
        ...common,
        headline: `AI assistants recommended ${m.rival} instead of you in ${m.count} answer${m.count === 1 ? "" : "s"}`,
        why: "When people ask ChatGPT, Gemini or other AI assistants for a recommendation, these answers named your competitor and not you.",
        steps: [
          ...(m.questions?.length ? [`Questions where this happened: ${m.questions.map((q) => `"${q}"`).join(", ")}.`] : []),
          "Make sure your website clearly answers these questions near the top of the page, in 2-3 plain sentences.",
          "Get mentioned on other trusted websites: local directories, review sites and news or blog posts.",
          "Open the AI Answers tab to follow how often you're named over time.",
        ],
      };
  }
}

export function buildRadarPlan(item: RadarItem, you: { domain: string }): string {
  return (
    `# Plan: ${item.headline}\n\n` +
    `Competitor: ${item.rival} (${item.rivalDomain})\nYour website: ${you.domain}\nNoticed: ${item.at.slice(0, 10)}\n\n` +
    `## Why this matters\n${item.why}\n\n` +
    `## What to do\n${item.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n` +
    (item.example ? `\n## Their page\n${item.example.url}\n` : "")
  );
}
