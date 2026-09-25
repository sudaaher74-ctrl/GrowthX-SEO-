import type { IntelReportRival, ProgrammaticCluster } from "@/lib/api-client";

/**
 * The Gaps tab in words a business owner reads without knowing SEO.
 *
 * Every item says what the competitor has, what you have, why it wins them
 * customers, and what to do, and each one turns into a plan that can be
 * handed to whoever edits the website.
 */

export type GapKind = "topic" | "pageType" | "question" | "schema" | "depth" | "series";

export interface GapItem {
  id: string;
  kind: GapKind;
  rival: string;
  rivalDomain: string;
  /** One sentence: what they have and you don't. */
  headline: string;
  /** Why this brings them customers, in plain words. */
  why: string;
  /** Their page to look at, when there is one. */
  example?: { label: string; url: string };
  /** What to build, step by step. */
  steps: string[];
  /** Bigger gaps first. */
  weight: number;
}

/** Page kinds as a customer would say them. */
const PAGE_KIND: Record<string, { one: string; many: string; why: string }> = {
  SERVICE: {
    one: "service page",
    many: "service pages",
    why: "Each service page can show up when someone searches for that exact service. One page per service beats one page listing them all.",
  },
  PRODUCT: {
    one: "product page",
    many: "product pages",
    why: "Each product page can be found on its own when someone searches for that product by name.",
  },
  LOCATION: {
    one: "city or area page",
    many: "city or area pages",
    why: 'People search with a place in mind, like "milk delivery in Pune". A page for each city or area is how a business shows up for those searches.',
  },
  BLOG: {
    one: "guide or article",
    many: "guides and articles",
    why: "Helpful articles answer the questions people type into Google before they buy, so the business is found early and trusted.",
  },
  CASE_STUDY: {
    one: "customer story",
    many: "customer stories",
    why: "Customer stories show real results and help people decide to buy.",
  },
  FAQ: {
    one: "question-and-answer page",
    many: "question-and-answer pages",
    why: "Question pages match the way people search and are often used by Google and AI assistants to answer directly.",
  },
  OTHER: { one: "page", many: "pages", why: "Every extra useful page is another way for customers to find the business." },
};

export function pageKind(pageType: string) {
  return PAGE_KIND[pageType] ?? PAGE_KIND.OTHER;
}

/** Structured data types as the thing they show in Google. */
const GOOGLE_EXTRA: Record<string, { name: string; why: string }> = {
  FAQ: {
    name: "Questions and answers",
    why: "Tells Google the questions a page answers, so Google and AI assistants can show those answers directly.",
  },
  REVIEW: { name: "Star ratings", why: "Lets Google show star ratings next to the page in search results, which gets more clicks." },
  LOCAL_BUSINESS: {
    name: "Business address and hours",
    why: "Tells Google exactly where the business is and when it is open, which helps in local and map searches.",
  },
  PRODUCT: { name: "Product price and stock", why: "Lets Google show the price and whether it is in stock right in the search results." },
  ARTICLE: { name: "Article details", why: "Tells Google who wrote an article and when, which helps it be trusted and shown." },
  BREADCRUMB: { name: "Page path", why: "Shows a neat path like Home › Milk › Cow milk in search results instead of a long web address." },
  ORGANIZATION: { name: "Company details", why: "Tells Google the business name, logo and contact details, so it recognises the brand." },
  VIDEO: { name: "Video details", why: "Lets Google show a video preview in search results." },
  RECIPE: { name: "Recipe details", why: "Lets Google show recipes with pictures, time and ratings." },
  EVENT: { name: "Event details", why: "Lets Google list events with dates and places." },
};

export function googleExtra(type: string) {
  return GOOGLE_EXTRA[type] ?? { name: type.replace(/_/g, " ").toLowerCase(), why: "Gives Google extra details about the page." };
}

/** Bulk page families found by the pattern reader, named in plain words. */
const SERIES: Record<ProgrammaticCluster["category"], { name: string; why: string }> = {
  COMPARISONS: {
    name: 'comparison pages ("A vs B")',
    why: 'People about to buy search "X vs Y". A comparison page catches them at the moment they are choosing.',
  },
  LOCATIONS: { name: "city or area pages", why: PAGE_KIND.LOCATION.why },
  INTEGRATIONS: { name: '"works with" pages', why: "Each page catches people searching for the tools they already use." },
  TEMPLATES: { name: "free template pages", why: "Free templates attract people searching for them and introduce them to the business." },
  GLOSSARY: { name: '"what is" explainer pages', why: "Each explainer answers a common question people type into Google." },
  TOOLS: { name: "free tool pages", why: "Free tools attract visitors and links from other websites." },
  CATEGORY_HUBS: { name: "category pages", why: "A page per category helps people browsing a whole range find the business." },
};

export function seriesName(category: ProgrammaticCluster["category"]) {
  return SERIES[category] ?? { name: "similar pages", why: "A family of similar pages each catches its own searches." };
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

export function buildGapItems(rivals: IntelReportRival[], clusters: ProgrammaticCluster[] = []): GapItem[] {
  const items: GapItem[] = [];
  for (const r of rivals) {
    const a = r.advantages;
    if (!a) continue;

    a.missingTopics.forEach((t, i) => {
      const kind = pageKind(t.pageType);
      items.push({
        id: `topic:${r.domain}:${t.url}`,
        kind: "topic",
        rival: r.name,
        rivalDomain: r.domain,
        headline: t.title,
        why: `${r.name} has a ${kind.one} about this and your website has nothing on it. People searching for it find them, not you.`,
        example: { label: `See ${r.name}'s page`, url: t.url },
        steps: [
          `Read ${r.name}'s page to see what it covers: ${t.url}`,
          `Write your own ${kind.one} on "${t.title.split(/[|–-]/)[0].trim()}". Make it more useful than theirs: your prices, your areas, real photos and customer questions.`,
          t.wordCount >= 600
            ? `Their page is about ${t.wordCount.toLocaleString("en-IN")} words long, so aim for at least as much useful detail.`
            : "Keep it clear and useful; add the details a customer would ask about.",
          "Link to the new page from your menu or a related page so visitors and Google can find it.",
        ],
        weight: 60 - i + Math.min(20, t.wordCount / 100),
      });
    });

    a.pageTypes.forEach((t) => {
      const kind = pageKind(t.pageType);
      items.push({
        id: `type:${r.domain}:${t.pageType}`,
        kind: "pageType",
        rival: r.name,
        rivalDomain: r.domain,
        headline: `${r.name} has ${plural(t.them, kind.one, kind.many)}. You have ${t.you}.`,
        why: kind.why,
        steps: [
          `List the ${kind.many} ${r.name} has and pick the ones that match what you offer.`,
          `Create one ${kind.one} for each, starting with the ones that bring you the most customers.`,
          "Give each page its own clear title and helpful details, not the same text copied with a name changed.",
          "Link them together from one overview page.",
        ],
        weight: 70 + (t.them - t.you),
      });
    });

    if (a.questions.theirCount > a.questions.yourCount) {
      items.push({
        id: `questions:${r.domain}`,
        kind: "question",
        rival: r.name,
        rivalDomain: r.domain,
        headline: `${r.name} answers ${plural(a.questions.theirCount, "customer question", "customer questions")} on their website. You answer ${a.questions.yourCount}.`,
        why: "People type questions into Google and AI assistants. Websites that answer those questions clearly are the ones shown in the answer.",
        steps: [
          ...(a.questions.theirs.length
            ? [`Questions they answer include: ${a.questions.theirs.map((q) => `"${q}"`).join(", ")}.`]
            : []),
          "Write down the questions your customers ask you on the phone or WhatsApp.",
          "Add a short questions-and-answers section to your main pages, each question as a heading with a 2-3 sentence answer.",
          "Answer honestly and specifically: prices, areas you serve, timings.",
        ],
        weight: 50 + (a.questions.theirCount - a.questions.yourCount),
      });
    }

    a.schema.forEach((s) => {
      const extra = googleExtra(s.type);
      items.push({
        id: `schema:${r.domain}:${s.type}`,
        kind: "schema",
        rival: r.name,
        rivalDomain: r.domain,
        headline: `${r.name} gives Google "${extra.name}" on ${plural(s.them, "page", "pages")}. You do on ${s.you}.`,
        why: extra.why,
        example: s.exampleUrl ? { label: `See one of ${r.name}'s pages`, url: s.exampleUrl } : undefined,
        steps: [
          `Ask whoever built your website to add "${extra.name}" details (called ${s.type.replace(/_/g, " ").toLowerCase()} structured data) to the right pages.`,
          "Most website builders and plugins (for example Yoast or Rank Math on WordPress) can add this without coding.",
          "Check it afterwards with Google's free Rich Results Test.",
        ],
        weight: 40 + s.them - s.you,
      });
    });

    const d = a.depth;
    if (d.theirMedianWords != null && d.yourMedianWords != null && d.theirMedianWords > d.yourMedianWords * 1.3) {
      items.push({
        id: `depth:${r.domain}`,
        kind: "depth",
        rival: r.name,
        rivalDomain: r.domain,
        headline: `${r.name}'s pages are more detailed: about ${d.theirMedianWords.toLocaleString("en-IN")} words each, yours about ${d.yourMedianWords.toLocaleString("en-IN")}.`,
        why: "Google prefers the page that answers a visitor's questions most completely. Thin pages lose to detailed ones.",
        steps: [
          "Pick your 5 most important pages.",
          "Add what a customer wants to know before buying: prices, what's included, delivery areas and timings, photos and common questions.",
          d.theirLongPages > d.yourLongPages
            ? `They have ${plural(d.theirLongPages, "in-depth page", "in-depth pages")} of 1,000+ words; you have ${d.yourLongPages}. Write one in-depth guide on your main service.`
            : "Keep every addition genuinely useful; do not pad pages with filler.",
        ],
        weight: 45,
      });
    }
  }

  for (const c of clusters) {
    const series = seriesName(c.category);
    items.push({
      id: `series:${c.id}`,
      kind: "series",
      rival: c.competitorDomain,
      rivalDomain: c.competitorDomain,
      headline: `${c.competitorDomain} has a set of ${plural(c.pageCount, "page", "pages")} of ${series.name}.`,
      why: series.why,
      example: c.sampleUrls[0] ? { label: "See an example", url: c.sampleUrls[0] } : undefined,
      steps: [
        `Look at their examples: ${c.sampleUrls.slice(0, 3).join(", ")}`,
        `Make your own ${series.name}, one per option your customers compare or ask about.`,
        "Use real facts you can back up and be honest about trade-offs; that is what makes people trust the page.",
      ],
      weight: 55 + c.pageCount,
    });
  }

  return items.sort((x, y) => y.weight - x.weight);
}

/** The plan handed to whoever edits the website. */
export function buildGapPlan(item: GapItem, you: { domain: string }): string {
  return (
    `# Plan: ${item.headline}\n\n` +
    `Competitor: ${item.rival} (${item.rivalDomain})\nYour website: ${you.domain}\n\n` +
    `## Why this matters\n${item.why}\n\n` +
    `## What to do\n${item.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n` +
    (item.example ? `## Their example\n${item.example.url}\n\n` : "") +
    `## When it's done\nRe-check your website in GrowthX (Website Audit → Run audit) and this item will drop off the Gaps list.\n`
  );
}
