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
  /** Optional measured side-by-side comparison for visual bars. */
  compare?: { you: number; them: number; unit: string };
  /** Optional structured metadata for clean UI pills and grouping. */
  meta?: { pageTypeKey?: string; pageTypeLabel?: string; wordCount?: number };
  /** Bigger gaps first. */
  weight: number;
}

/** Page kinds as a customer would say them. */
const PAGE_KIND: Record<string, { one: string; many: string; why: string }> = {
  SERVICE: {
    one: "service page",
    many: "service pages",
    why: "A clear page for each distinct service can help customers understand what you offer. This crawl does not show whether those services get searches.",
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
    why: "Useful articles can explain your products or services. This crawl does not measure search demand, trust, or rankings.",
  },
  CASE_STUDY: {
    one: "customer story",
    many: "customer stories",
    why: "Customer stories show real results and help people decide to buy.",
  },
  FAQ: {
    one: "question-and-answer page",
    many: "question-and-answer pages",
    why: "Question-and-answer pages can help customers find clear information. This crawl does not confirm whether Google or AI assistants use them in answers.",
  },
  OTHER: { one: "page", many: "pages", why: "A page helps when it answers a real customer need; more pages alone do not guarantee more visitors." },
};

function pageKind(pageType: string) {
  return PAGE_KIND[pageType] ?? PAGE_KIND.OTHER;
}

/** Structured data types as the thing they show in Google. */
const GOOGLE_EXTRA: Record<string, { name: string; why: string }> = {
  FAQ: {
    name: "Questions and answers",
    why: "Tells Google the questions a page answers, so Google and AI assistants can show those answers directly.",
  },
  REVIEW: { name: "Star ratings", why: "Marks up review information; Google decides whether eligible details appear in search results." },
  LOCAL_BUSINESS: {
    name: "Business address and hours",
    why: "Provides machine-readable business location and hours. It does not guarantee visibility in local or map results.",
  },
  PRODUCT: { name: "Product price and stock", why: "Marks up product price and availability; search engines decide whether eligible details appear." },
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
    why: 'Comparison pages can help customers evaluate options. This crawl does not show how many people search for these comparisons.',
  },
  LOCATIONS: { name: "city or area pages", why: PAGE_KIND.LOCATION.why },
  INTEGRATIONS: { name: '"works with" pages', why: "Each page catches people searching for the tools they already use." },
  TEMPLATES: { name: "free template pages", why: "Free templates attract people searching for them and introduce them to the business." },
  GLOSSARY: { name: '"what is" explainer pages', why: "Each explainer answers a common question people type into Google." },
  TOOLS: { name: "free tool pages", why: "Free tools attract visitors and links from other websites." },
  CATEGORY_HUBS: { name: "category pages", why: "A page per category helps people browsing a whole range find the business." },
};

function seriesName(category: ProgrammaticCluster["category"]) {
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
        why: `Our crawl found a ${kind.one} on ${r.name}'s website about this topic, but did not find a matching page on yours. We have not checked search demand or Google rankings.`,
        example: { label: `See ${r.name}'s page`, url: t.url },
        steps: [
          `Open ${r.name}'s page and first check whether this topic is relevant to your customers: ${t.url}`,
          `If it is relevant, create a useful ${kind.one} about "${t.title.split(/[|–-]/)[0].trim()}" with accurate details that help your customers decide.`,
          t.wordCount >= 600
            ? `Use word count as context only. Add details only when they help your customers.`
            : "Keep it clear and useful; add the details a customer would ask about.",
          "Link to the new page from your menu or a related page so visitors and Google can find it.",
        ],
        meta: { pageTypeKey: t.pageType, pageTypeLabel: kind.one, wordCount: t.wordCount },
        weight: 60 - i + Math.min(20, t.wordCount / 100),
      });
    });

    a.pageTypes.forEach((t) => {
      // Skip unclassified "OTHER" buckets: saying "rival has 65 pages, you have 0" is misleading.
      if ((t.pageType || "").toUpperCase() === "OTHER") return;
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
        compare: { you: t.you, them: t.them, unit: kind.many },
        meta: { pageTypeKey: t.pageType, pageTypeLabel: kind.many },
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
        why: "This crawl found more question-related content on this competitor's site. It does not show whether those questions appear in Google or AI answers.",
        steps: [
          ...(a.questions.theirs.length
            ? [`Questions they answer include: ${a.questions.theirs.map((q) => `"${q}"`).join(", ")}.`]
            : []),
          "Write down the questions your customers ask you on the phone or WhatsApp.",
          "Add a short questions-and-answers section to your main pages, each question as a heading with a 2-3 sentence answer.",
          "Answer honestly and specifically: prices, areas you serve, timings.",
        ],
        compare: { you: a.questions.yourCount, them: a.questions.theirCount, unit: "questions" },
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
        compare: { you: s.you, them: s.them, unit: "pages" },
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
        why: "This is a word-count comparison only. It does not show which page is more useful or ranks better.",
        steps: [
          "Pick your 5 most important pages.",
          "Add what a customer wants to know before buying: prices, what's included, delivery areas and timings, photos and common questions.",
          d.theirLongPages > d.yourLongPages
            ? `They have ${plural(d.theirLongPages, "in-depth page", "in-depth pages")} of 1,000+ words; you have ${d.yourLongPages}. Write one in-depth guide on your main service.`
            : "Keep every addition genuinely useful; do not pad pages with filler.",
        ],
        compare: { you: d.yourMedianWords, them: d.theirMedianWords, unit: "median words" },
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
  const bp = buildGapBlueprint(item, you);
  return (
    `# Execution Blueprint: ${item.headline}\n\n` +
    `Competitor: ${item.rival} (${item.rivalDomain})\nYour website: ${you.domain}\n` +
    (bp.targetSlug ? `Recommended URL: https://${you.domain}${bp.targetSlug}\n` : "") +
    `\n## Why this matters\n${item.why}\n\n` +
    `## Ready-to-Use SEO Metadata\n` +
    `- **Title:** ${bp.seoTitle}\n` +
    `- **Meta Description:** ${bp.metaDescription}\n` +
    `- **Primary H1:** ${bp.h1}\n\n` +
    `## Recommended Page Outline (SEO + AI Citation Ready)\n` +
    bp.outlineSections.map((s, i) => `${i + 1}. **${s.heading}** — ${s.guidance}`).join("\n") +
    `\n\n## Step-by-Step Implementation\n${item.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n` +
    `## Ready-to-Paste Schema (JSON-LD)\n\`\`\`json\n${bp.jsonLdSnippet}\n\`\`\`\n\n` +
    (item.example ? `## Competitor Reference\n${item.example.url}\n\n` : "") +
    `## Verification\nRe-crawl ${you.domain} in Reigel (Website Audit → Run audit) to verify the page is live, indexable, and clears this gap.\n`
  );
}

export interface GapExecutionBlueprint {
  targetSlug: string | null;
  seoTitle: string;
  metaDescription: string;
  h1: string;
  outlineSections: Array<{ heading: string; guidance: string }>;
  jsonLdType: string;
  jsonLdSnippet: string;
  platformSteps: Record<"wordpress" | "shopify" | "webflow" | "nextjs", string[]>;
}

function toSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Generates an instant, gap-specific Execution Blueprint (URL slug, SEO metadata,
 * H1/H2 content structure, valid Schema.org JSON-LD, and platform-specific steps)
 * so Competitor Intelligence delivers ready-to-ship work, not just issue lists.
 */
export function buildGapBlueprint(item: GapItem, you: { domain: string }): GapExecutionBlueprint {
  const cleanBrand = you.domain.replace(/^www\./i, "").split(".")[0] || "Your Brand";
  const brandTitle = cleanBrand.charAt(0).toUpperCase() + cleanBrand.slice(1);
  const coreTopic = item.headline.split(/[|–-]/)[0].replace(/\.$/, "").trim();
  const slugBase = toSlug(coreTopic) || "new-page";
  const pageTypeKey = (item.meta?.pageTypeKey || "").toUpperCase();

  let targetSlug: string | null = `/${slugBase}`;
  let jsonLdType = "WebPage";
  let outlineSections: Array<{ heading: string; guidance: string }> = [];

  if (item.kind === "topic") {
    if (pageTypeKey === "PRODUCT") {
      targetSlug = `/products/${slugBase}`;
      jsonLdType = "Product";
      outlineSections = [
        { heading: "Key Overview & Direct Answer (45–55 words)", guidance: "State clearly what the product is, who it is for, pack sizes/pricing, and delivery availability so Google & AI engines can cite it." },
        { heading: "Product Specifications & Quality Proof", guidance: "Include ingredients/specs, sourcing details, shelf life, and certifications in a clean bullet list or table." },
        { heading: "Why Choose Us vs Standard Alternatives", guidance: "Add a crisp 3–4 row comparison table highlighting real differentiators (freshness, purity, turnaround, warranty)." },
        { heading: "Pricing, Delivery & Subscription Options", guidance: "Spell out transparent pricing, delivery timings, and service areas." },
        { heading: "Frequently Asked Questions (3–5 Q&As)", guidance: "Answer real customer questions using exact H3 headings + 2–3 sentence direct answers paired with FAQPage schema." },
      ];
    } else if (pageTypeKey === "LOCATION") {
      targetSlug = `/locations/${slugBase}`;
      jsonLdType = "LocalBusiness";
      outlineSections = [
        { heading: "Local Service Overview (Direct Answer)", guidance: "Confirm service availability in this exact city/neighborhood, delivery timings, and coverage pincodes." },
        { heading: "Popular Offerings in This Area", guidance: "Highlight top products/services with direct links to each offering page." },
        { heading: "How Delivery / Service Works Locally", guidance: "Step-by-step ordering, dispatch window, and local support contact details." },
        { heading: "Local FAQs", guidance: "Address area-specific timing, minimum order, and serviceability questions." },
      ];
    } else {
      targetSlug = `/blog/${slugBase}`;
      jsonLdType = "Article";
      outlineSections = [
        { heading: "Key Takeaway & Direct Answer (45–55 words)", guidance: "Answer the core user question immediately in plain language for Google AI Overviews, ChatGPT, and Perplexity." },
        { heading: "Detailed Breakdown & Practical Guide", guidance: "Cover the core steps, real examples, and buying criteria customers care about." },
        { heading: "Comparison / Benchmark Table", guidance: "Add a structured Markdown/HTML table comparing options, pros/cons, or specs for high information gain." },
        { heading: "Common Questions (FAQ Section)", guidance: "Add 3–5 real customer questions with concise answers." },
        { heading: "Next Step / Product CTA", guidance: "Link contextually to your relevant product or service page." },
      ];
    }
  } else if (item.kind === "question") {
    targetSlug = `/faq`;
    jsonLdType = "FAQPage";
    outlineSections = [
      { heading: "Top Customer Questions (Direct 2–3 Sentence Answers)", guidance: "Group questions by Pricing, Delivery/Timings, Quality/Specs, and Support." },
      { heading: "Contextual Links to Core Pages", guidance: "Link each answer to the relevant product, service, or policy page." },
    ];
  } else if (item.kind === "schema") {
    targetSlug = null;
    jsonLdType = "FAQPage";
    outlineSections = [
      { heading: "Identify Target Templates", guidance: "Apply this JSON-LD block to the matching page template (e.g., Product, Article, LocalBusiness, or FAQ pages)." },
      { heading: "Bind Dynamic Fields", guidance: "Populate name, description, URL, price/availability, or Q&A arrays from your live page data—never hardcode fake ratings." },
      { heading: "Validate Before Publishing", guidance: "Test with Google Rich Results Test and re-crawl in Reigel to confirm zero validation errors." },
    ];
  } else if (item.kind === "pageType" || item.kind === "series") {
    targetSlug = `/${toSlug(item.meta?.pageTypeLabel || "hub")}`;
    jsonLdType = "ItemList";
    outlineSections = [
      { heading: "Create a Clean Hub / Category Page", guidance: "Build one overview page that links out to every individual page in this family." },
      { heading: "Launch Top 5 Highest-Intent Pages First", guidance: "Prioritize the offerings or locations with highest commercial intent—each with unique titles, specs, and local/product details." },
      { heading: "Interlink Related Pages", guidance: "Add breadcrumb navigation and related-page links so crawlers reach every page within ≤3 clicks." },
    ];
  } else {
    targetSlug = null;
    jsonLdType = "Article";
    outlineSections = [
      { heading: "Expand Your Top 5 Revenue Pages", guidance: "Add decision-making details: transparent pricing, specifications, comparison tables, and real photos." },
      { heading: "Add a Direct-Answer Summary & FAQ Block", guidance: "Help both human shoppers and AI assistants extract exact facts quickly." },
    ];
  }

  const seoTitle =
    item.kind === "topic"
      ? `${coreTopic.slice(0, 44)} | ${brandTitle}`
      : `${brandTitle}: ${coreTopic.slice(0, 44)}`;
  const metaDescription = `Explore ${coreTopic.slice(0, 85)} on ${you.domain}. Clear details, transparent options, and direct answers to help you choose with confidence.`.slice(0, 158);
  const h1 = coreTopic;

  const pageUrl = `https://${you.domain}${targetSlug || "/"}`;
  const jsonLdObj =
    jsonLdType === "Product"
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: h1,
          description: metaDescription,
          brand: { "@type": "Brand", name: brandTitle },
          url: pageUrl,
        }
      : jsonLdType === "FAQPage"
        ? {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: `What should customers know about ${coreTopic.slice(0, 60)}?`,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Provide a concise, factual 2-3 sentence answer covering key details, availability, and how to get started.",
                },
              },
            ],
          }
        : jsonLdType === "LocalBusiness"
          ? {
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              name: brandTitle,
              url: pageUrl,
              description: metaDescription,
            }
          : {
              "@context": "https://schema.org",
              "@type": "Article",
              headline: h1,
              description: metaDescription,
              url: pageUrl,
              publisher: { "@type": "Organization", name: brandTitle },
            };

  return {
    targetSlug,
    seoTitle,
    metaDescription,
    h1,
    outlineSections,
    jsonLdType,
    jsonLdSnippet: JSON.stringify(jsonLdObj, null, 2),
    platformSteps: {
      wordpress: [
        `In WordPress Admin, open Pages / Posts → Add New and set the permalink slug to "${targetSlug || "/"}".`,
        `Paste the SEO Title and Meta Description into Yoast SEO or Rank Math.`,
        `Build the page using the H1 + H2 outline above, then add the JSON-LD block via a Custom HTML block or your SEO plugin's Schema tab.`,
        `Publish as Draft to preview, then Publish Live and click Re-crawl in Reigel.`,
      ],
      shopify: [
        `In Shopify Admin, go to Online Store → Pages (or Products → Add product) and set the URL handle to "${slugBase}".`,
        `Under "Search engine listing", paste the SEO Title and Meta Description.`,
        `Add the structured H2 sections and FAQ block to the description, and embed the JSON-LD script in your theme template or metafield.`,
        `Save, verify on the live storefront, and run Reigel Website Audit to confirm.`,
      ],
      webflow: [
        `In Webflow Designer/CMS, create a new page or CMS collection item with slug "${slugBase}".`,
        `Open Page Settings → SEO Settings and paste the Title Tag and Meta Description.`,
        `Paste the JSON-LD inside <script type="application/ld+json">...</script> in Custom Code → Inside <head> tag.`,
        `Publish to staging first, then production.`,
      ],
      nextjs: [
        `Create the route at app${targetSlug || `/${slugBase}`}/page.tsx and export Next.js metadata with the exact title, description, and alternates.canonical.`,
        `Render the semantic <h1> and <h2> sections with server-rendered HTML (SSR/SSG) so Googlebot & AI crawlers see all text without JS.`,
        `Inject the JSON-LD via <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />.`,
        `Open a PR, merge after preview check, and verify live in Reigel.`,
      ],
    },
  };
}
