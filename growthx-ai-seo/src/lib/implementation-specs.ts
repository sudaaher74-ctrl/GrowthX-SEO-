import type {
  BacklinkOutreachItem,
  CompetitorIntelReport,
  QuestionAnalysisReport,
  VisibilityInsights,
  VisibilityReport,
  WebsiteAuditReport,
} from "@/lib/api-types";
import type { BacklinkReport } from "@/lib/backlinks";

/**
 * Universal, stack-agnostic implementation specification model shared across
 * every Reigel report (Website Audit, AI Visibility, Competitor Intelligence,
 * Backlinks, and Traffic). Every spec uses standard web primitives (HTML,
 * JSON-LD, HTTP 301 maps, robots.txt, llms.txt, plain copy briefs) so any
 * website owner, CMS editor, or web developer on any platform can implement
 * and verify it without needing Fix Engine.
 */

export type SpecPriority = "high" | "medium" | "low";
export type SpecOwner = "Web Developer" | "Website Owner / CMS" | "Content & SEO" | "Outreach / PR";

export interface ImplementationSpec {
  id: string;
  title: string;
  priority: SpecPriority;
  owner: SpecOwner;
  effort: string;
  affectedUrls: string[];
  observedState: string;
  expectedOutcome: string;
  codeLabel?: string;
  codeLanguage?: string;
  codeSnippet?: string;
  steps: string[];
  verificationChecklist: string[];
  contentStudioQuery?: string;
  contentStudioTopic?: string;
}

function cleanOrigin(domain: string | null | undefined): string {
  const host = (domain || "yourdomain.com").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return `https://${host}`;
}

function slugifyTopic(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

/* ─────────────────────────── 1. WEBSITE AUDIT SPECS ─────────────────────────── */

function snippetForAuditIssue(
  issueType: string,
  title: string,
  domain: string,
  exampleUrls: string[],
): {
  owner: SpecOwner;
  effort: string;
  codeLabel?: string;
  codeLanguage?: string;
  codeSnippet?: string;
  steps: string[];
  verify: string[];
} {
  const origin = cleanOrigin(domain);
  const firstUrl = exampleUrls[0] || `${origin}/`;
  const key = `${issueType} ${title}`.toUpperCase();

  if (key.includes("CANONICAL")) {
    return {
      owner: "Web Developer",
      effort: "Low (15–30 min)",
      codeLabel: "Standard HTML Canonical Tag (place inside <head>)",
      codeLanguage: "html",
      codeSnippet: `<link rel="canonical" href="${firstUrl}" />`,
      steps: [
        "Ensure every indexable page outputs exactly one self-referencing absolute HTTPS canonical URL inside <head>.",
        "Strip tracking query parameters (?utm_*, ?fbclid, ?ref) from canonical URLs so duplicate copies consolidate.",
        "Confirm canonical URLs return HTTP 200 OK and are not blocked by robots.txt or noindex.",
      ],
      verify: [
        `Open ${firstUrl} → View Page Source → verify exactly one <link rel="canonical" href="${firstUrl}"> tag exists.`,
        "Inspect the URL in Google Search Console → confirm 'Google-selected canonical' matches your declared canonical.",
      ],
    };
  }

  if (key.includes("TITLE")) {
    return {
      owner: "Website Owner / CMS",
      effort: "Low (15–30 min)",
      codeLabel: "Standard HTML Title Tag (50–60 characters, unique per page)",
      codeLanguage: "html",
      codeSnippet: `<title>[Primary Topic / Offering] | [Brand Name]</title>`,
      steps: [
        "Write a unique 50–60 character <title> for each listed URL naming the page's core offering and target market.",
        "Avoid duplicate boilerplate titles across category, product, or blog pages.",
        "Keep the primary keyword near the start of the title for stronger Google CTR.",
      ],
      verify: [
        "View Page Source on each updated URL and verify <title> is unique and 50–60 characters long.",
        "Re-run Website Audit in Reigel to confirm the title issue count drops to 0.",
      ],
    };
  }

  if (key.includes("META_DESCRIPTION") || key.includes("DESCRIPTION")) {
    return {
      owner: "Website Owner / CMS",
      effort: "Low (20–45 min)",
      codeLabel: "Standard HTML Meta Description (135–155 characters, unique per page)",
      codeLanguage: "html",
      codeSnippet: `<meta name="description" content="[Clear value proposition for this page] — [key proof or service area]. [Clear next step]." />`,
      steps: [
        "Write a unique 135–155 character meta description summarizing the exact offer on each affected URL.",
        "Include one verifiable differentiator (delivery speed, pricing transparency, coverage area) and a clear call to action.",
        "Avoid copying the same global site description onto product or landing pages.",
      ],
      verify: [
        "Inspect <meta name=\"description\"> in View Page Source on each updated URL.",
        "Confirm Search Console snippet updates and monitor CTR over the next 14–28 days.",
      ],
    };
  }

  if (key.includes("NOINDEX") || key.includes("ROBOTS") || key.includes("HIDDEN")) {
    return {
      owner: "Web Developer",
      effort: "Low (15 min)",
      codeLabel: "Standard Indexable Robots Tag (replace accidental noindex on public pages)",
      codeLanguage: "html",
      codeSnippet: `<meta name="robots" content="index, follow" />`,
      steps: [
        "Review every listed URL and confirm whether it should appear in Google Search.",
        "Remove any stray <meta name=\"robots\" content=\"noindex\"> tag or X-Robots-Tag: noindex HTTP response header on commercial pages.",
        "Check /robots.txt to make sure no Disallow rule blocks these paths.",
      ],
      verify: [
        `Check HTTP headers (e.g. curl -I "${firstUrl}") and confirm no X-Robots-Tag: noindex header is sent.`,
        "Run URL Inspection in Google Search Console and verify 'Indexing allowed: Yes'.",
      ],
    };
  }

  if (key.includes("SCHEMA") || key.includes("STRUCTURED") || key.includes("JSON_LD") || key.includes("JSON-LD")) {
    return {
      owner: "Web Developer",
      effort: "Medium (30–60 min)",
      codeLabel: "Standard Organization + WebSite JSON-LD (place inside <head> or before </body>)",
      codeLanguage: "html",
      codeSnippet: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "[Your Official Brand Name]",
  "url": "${origin}",
  "logo": "${origin}/logo.png",
  "description": "[One-sentence factual description of what your business offers]"
}
</script>`,
      steps: [
        "Add Organization / LocalBusiness JSON-LD to the homepage and Product / Service / FAQPage JSON-LD to core commercial pages.",
        "Fill every field strictly with verifiable facts shown visibly on the page (never add fake ratings or unverified claims).",
        "Validate the live page output with Google's Rich Results Test before finishing.",
      ],
      verify: [
        `Test ${firstUrl} in Google Rich Results Test (search.google.com/test/rich-results) and confirm 0 critical errors.`,
        "Re-crawl in Reigel Website Audit to verify structured data coverage increases.",
      ],
    };
  }

  if (key.includes("404") || key.includes("BROKEN") || key.includes("5XX") || key.includes("SERVER_ERROR") || key.includes("REDIRECT")) {
    const mapLines = exampleUrls
      .slice(0, 6)
      .map((u) => `${u}  -->  301  -->  ${origin}/[closest-live-equivalent-page]`)
      .join("\n");
    return {
      owner: "Web Developer",
      effort: "Medium (30–60 min)",
      codeLabel: "Universal 301 Redirect & Broken-Link Fix Map (apply in CMS, server, or CDN)",
      codeLanguage: "text",
      codeSnippet: mapLines || `${firstUrl}  -->  301  -->  ${origin}/`,
      steps: [
        "For broken internal links (404), update the source anchor href to point directly to the live destination URL.",
        "For retired URLs that still receive external links or bookmarks, configure a permanent HTTP 301 redirect to the closest relevant live page (avoid redirect chains).",
        "For 5xx server errors, inspect server logs and fix the failing route or upstream timeout.",
      ],
      verify: [
        `Run curl -I "${firstUrl}" and confirm either HTTP 200 OK (if restored) or a single-hop HTTP 301 → 200 OK.`,
        "Confirm no internal links across your navigation or body content still point to broken or redirected URLs.",
      ],
    };
  }

  if (key.includes("H1") || key.includes("HEADING")) {
    return {
      owner: "Website Owner / CMS",
      effort: "Low (15–30 min)",
      codeLabel: "Standard Semantic Heading Structure",
      codeLanguage: "html",
      codeSnippet: `<h1>[Single Clear Page Headline Matching Search Intent]</h1>
<h2>[Key Benefit / Service Breakdown]</h2>
<h2>[Frequently Asked Questions]</h2>`,
      steps: [
        "Ensure every public page has exactly one visible <h1> describing the core topic of that specific page.",
        "Never use <h1> for site logos or navigation items — use <span> or <a> in the header and reserve <h1> for main content.",
        "Use sequential <h2> and <h3> headings to organize sub-sections cleanly.",
      ],
      verify: [
        "Inspect each affected URL in browser DevTools → confirm document.querySelectorAll('h1').length === 1.",
        "Confirm the <h1> aligns naturally with the page's <title> tag.",
      ],
    };
  }

  if (key.includes("ALT") || key.includes("IMAGE")) {
    return {
      owner: "Website Owner / CMS",
      effort: "Low (20–40 min)",
      codeLabel: "Accessible & SEO-Friendly Image Tag",
      codeLanguage: "html",
      codeSnippet: `<img src="/images/product.webp" alt="[Factual description of what the image shows]" width="800" height="600" loading="lazy" />`,
      steps: [
        "Add concise, factual alt text describing each meaningful product, service, or hero image.",
        "Use empty alt=\"\" only for purely decorative icons or dividers.",
        "Include explicit width/height attributes and serve modern WebP/AVIF formats to prevent layout shift (CLS).",
      ],
      verify: [
        "Inspect images on affected pages and confirm no meaningful <img> is missing an alt attribute.",
        "Check Lighthouse / PageSpeed Accessibility and CLS scores after deployment.",
      ],
    };
  }

  if (key.includes("OPEN_GRAPH") || key.includes("OG_") || key.includes("TWITTER") || key.includes("SOCIAL")) {
    return {
      owner: "Web Developer",
      effort: "Low (20 min)",
      codeLabel: "Standard OpenGraph & Social Preview Tags (place inside <head>)",
      codeLanguage: "html",
      codeSnippet: `<meta property="og:type" content="website" />
<meta property="og:title" content="[Page Title]" />
<meta property="og:description" content="[Page Description]" />
<meta property="og:url" content="${firstUrl}" />
<meta property="og:image" content="${origin}/og-image.png" />`,
      steps: [
        "Output og:title, og:description, og:url, and an absolute 1200x630 og:image URL on all shareable pages.",
        "Ensure og:image returns HTTP 200 OK publicly without login restrictions.",
      ],
      verify: [
        "Share or inspect the URL in LinkedIn Post Inspector / WhatsApp preview and verify the title, description, and image render cleanly.",
      ],
    };
  }

  if (key.includes("SLOW") || key.includes("SPEED") || key.includes("TTFB") || key.includes("LCP") || key.includes("PERFORMANCE")) {
    return {
      owner: "Web Developer",
      effort: "Medium (1–2 hrs)",
      codeLabel: "Standard Performance & Core Web Vitals Checklist",
      codeLanguage: "html",
      codeSnippet: `<!-- Preload the primary hero image & defer non-critical scripts -->
<link rel="preload" as="image" href="/images/hero.webp" fetchpriority="high" />
<script src="/analytics-or-widget.js" defer></script>`,
      steps: [
        "Enable full-page caching / CDN caching so HTML TTFB stays under 500ms.",
        "Compress hero images to WebP/AVIF (<150 KB), add fetchpriority=\"high\" to the LCP image, and lazy-load below-the-fold media.",
        "Defer non-critical third-party scripts (chat widgets, trackers) so they never block first paint.",
      ],
      verify: [
        `Test ${firstUrl} in PageSpeed Insights (pagespeed.web.dev) and confirm TTFB < 800ms and LCP < 2.5s on mobile.`,
      ],
    };
  }

  if (key.includes("THIN") || key.includes("WORD")) {
    return {
      owner: "Content & SEO",
      effort: "Medium (45–90 min)",
      codeLabel: "Universal Commercial Page Structure Blueprint",
      codeLanguage: "markdown",
      codeSnippet: `# [Clear H1 Naming the Offer + Target Audience]
[45–60 word direct summary answering what this is, who it serves, and key proof]

## What Is Included / Key Specifications
- [Concrete factual detail 1]
- [Concrete factual detail 2]

## Pricing, Delivery, or Process
[Transparent, verifiable details customers ask before buying]

## Frequently Asked Questions
### [Real buyer question 1]
[Concise factual answer]`,
      steps: [
        "Expand each thin commercial page with verifiable product specs, process details, pricing/delivery transparency, and buyer FAQs (target 450–800+ useful words).",
        "If a thin URL is an empty utility or obsolete page with no search intent, either consolidate it via 301 redirect or mark it noindex.",
      ],
      verify: [
        "Confirm the updated page answers a buyer's top 3 pre-purchase questions clearly above and below the fold.",
        "Re-crawl in Reigel Website Audit to confirm the thin-content flag clears.",
      ],
    };
  }

  return {
    owner: "Web Developer",
    effort: "Medium (30–60 min)",
    steps: [
      `Review all affected URLs listed above and apply the recommended fix: ${title}.`,
      "Test changes on staging or a single URL first before rolling out site-wide.",
    ],
    verify: [
      "Verify the live HTML/HTTP output on every listed URL after deployment.",
      "Re-run Website Audit in Reigel to confirm the issue count drops to 0.",
    ],
  };
}

export function buildAuditImplementationSpecs(report: WebsiteAuditReport): ImplementationSpec[] {
  const domain = report.facts.site?.domain || "yourdomain.com";
  const severityToPriority = (sev: string): SpecPriority => {
    const s = sev.toUpperCase();
    if (s === "CRITICAL" || s === "HIGH") return "high";
    if (s === "MEDIUM") return "medium";
    return "low";
  };

  return report.facts.problems.slice(0, 12).map((p, idx) => {
    const detail = snippetForAuditIssue(p.issueType, p.title, domain, p.exampleUrls);
    const isThin = `${p.issueType} ${p.title}`.toUpperCase().includes("THIN");
    return {
      id: `AUD-${String(idx + 1).padStart(2, "0")}`,
      title: p.title,
      priority: severityToPriority(p.severity),
      owner: detail.owner,
      effort: detail.effort,
      affectedUrls: p.exampleUrls,
      observedState: `${p.pages} page${p.pages === 1 ? "" : "s"} affected (${p.severity.toLowerCase()} severity). ${p.why}`,
      expectedOutcome: p.action,
      codeLabel: detail.codeLabel,
      codeLanguage: detail.codeLanguage,
      codeSnippet: detail.codeSnippet,
      steps: detail.steps,
      verificationChecklist: detail.verify,
      contentStudioQuery: isThin ? p.title : undefined,
      contentStudioTopic: isThin ? `Expand Commercial Page Content: ${p.title}` : undefined,
    };
  });
}

/* ─────────────────────────── 2. AI VISIBILITY SPECS ─────────────────────────── */

export function buildAiVisibilityImplementationSpecs(params: {
  visibility: VisibilityReport | undefined;
  insights: VisibilityInsights | undefined;
  questionAnalysis: QuestionAnalysisReport | undefined;
  domain: string | null;
  clientName: string;
}): ImplementationSpec[] {
  const { visibility, insights, questionAnalysis, domain, clientName } = params;
  const origin = cleanOrigin(domain);
  const specs: ImplementationSpec[] = [];

  const questions = questionAnalysis?.questions ?? [];
  const missedQuestions = questions.filter((q) => q.outcome === "NOT_CITED");
  const knownPages = Array.from(
    new Map(
      questions
        .filter((q) => q.ownPage?.url)
        .map((q) => [q.ownPage!.url, q.ownPage!.title || q.ownPage!.url]),
    ).entries(),
  ).slice(0, 8);

  // Spec 1: Universal /llms.txt Machine-Readable Brand Guide
  const llmsLines = [
    `# ${clientName}`,
    `> Official website: ${origin}`,
    "",
    "## Core Pages",
    ...(knownPages.length > 0
      ? knownPages.map(([url, title]) => `- [${title}](${url})`)
      : [`- [Homepage](${origin}/)`]),
    "",
    "## Key Questions Answered",
    ...(questions.slice(0, 6).map((q) => `- ${q.text}`) || []),
  ].join("\n");

  specs.push({
    id: "AIV-01",
    title: "Publish a clean /llms.txt machine-readable brand directory at site root",
    priority: "high",
    owner: "Web Developer",
    effort: "Low (15 min)",
    affectedUrls: [`${origin}/llms.txt`],
    observedState:
      visibility && visibility.summary.checked > 0
        ? `Current AI citation share is ${visibility.summary.citationSharePct.toFixed(1)}% (${visibility.summary.cited} of ${visibility.summary.checked} checked answers). Publishing /llms.txt gives AI assistants a clean, authoritative index of your official pages.`
        : "Providing a root /llms.txt file helps AI search crawlers discover your authoritative commercial pages cleanly.",
    expectedOutcome:
      "AI retrieval crawlers can read a concise, fact-grounded map of your brand, offerings, and canonical URLs without guessing from navigation boilerplate.",
    codeLabel: "Standard /llms.txt file (host at root URL /llms.txt as text/plain)",
    codeLanguage: "markdown",
    codeSnippet: llmsLines,
    steps: [
      `Save the plain-text file above at ${origin}/llms.txt (accessible publicly with HTTP 200 and Content-Type: text/plain; charset=utf-8).`,
      "Update the Core Pages list to include your primary product, service, pricing, and location URLs with factual 1-line summaries.",
      "Keep all statements strictly factual and aligned with your visible HTML pages.",
    ],
    verificationChecklist: [
      `Open ${origin}/llms.txt in a browser and confirm HTTP 200 OK with clean plain text.`,
      "Confirm every URL listed inside /llms.txt returns HTTP 200 OK (zero 404s).",
    ],
  });

  // Spec 2: Universal robots.txt AI Crawler Access Check
  specs.push({
    id: "AIV-02",
    title: "Verify /robots.txt allows official AI search retrieval crawlers",
    priority: "high",
    owner: "Web Developer",
    effort: "Low (10 min)",
    affectedUrls: [`${origin}/robots.txt`],
    observedState:
      "Many WAFs, CDNs, or default robots.txt files silently block AI search retrieval bots, preventing ChatGPT Search, Perplexity, and Claude from reading your live pages.",
    expectedOutcome:
      "Public commercial and FAQ pages are explicitly accessible to search and AI citation crawlers while keeping private/admin routes blocked.",
    codeLabel: "Standard /robots.txt AI Search Allowlist Rules",
    codeLanguage: "text",
    codeSnippet: `User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

Sitemap: ${origin}/sitemap.xml`,
    steps: [
      `Open ${origin}/robots.txt and confirm none of OAI-SearchBot, ChatGPT-User, PerplexityBot, or Claude-SearchBot are disallowed.`,
      "Check your CDN/WAF firewall settings (Cloudflare, AWS WAF, Sucuri) to ensure verified search bots are not challenged with CAPTCHAs.",
      `Keep your XML sitemap URL declared at the bottom of robots.txt.`,
    ],
    verificationChecklist: [
      `Open ${origin}/robots.txt and verify the Sitemap directive and AI search allow rules are live.`,
      "Test your homepage with curl -A 'OAI-SearchBot' -I and verify HTTP 200 OK (not 403/429).",
    ],
  });

  // Spec 3+: Concrete Direct-Answer + FAQPage JSON-LD specs for top missed buyer questions
  if (missedQuestions.length > 0) {
    const topMissed = missedQuestions.slice(0, 4);
    const faqJsonLd = JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: topMissed.map((q) => ({
          "@type": "Question",
          name: q.text,
          acceptedAnswer: {
            "@type": "Answer",
            text: `[Write a clear, verifiable 45–60 word factual answer about ${clientName}'s exact offering, coverage area, and proof — matching visible copy on the page.]`,
          },
        })),
      },
      null,
      2,
    );

    const affected = Array.from(
      new Set(topMissed.map((q) => q.ownPage?.url).filter((u): u is string => Boolean(u))),
    );

    specs.push({
      id: "AIV-03",
      title: `Add visible Direct-Answer blocks & FAQPage JSON-LD for ${topMissed.length} missed buyer questions`,
      priority: "high",
      owner: "Content & SEO",
      effort: "Medium (45–90 min)",
      affectedUrls: affected.length > 0 ? affected : [`${origin}/`],
      observedState: `You were not cited in ${missedQuestions.length} tracked buyer question${missedQuestions.length === 1 ? "" : "s"} (e.g. "${topMissed[0].text}"${
        topMissed[0].answer?.competitorsCited?.length
          ? ` — rivals cited instead: ${topMissed[0].answer.competitorsCited.slice(0, 3).join(", ")}`
          : ""
      }).`,
      expectedOutcome:
        "Clear question-and-answer blocks paired with matching FAQPage JSON-LD give AI assistants clean, verifiable passages they can directly quote and cite.",
      codeLabel: "Standard FAQPage JSON-LD Template (pair with identical visible Q&A HTML on the page)",
      codeLanguage: "html",
      codeSnippet: `<script type="application/ld+json">\n${faqJsonLd}\n</script>`,
      steps: [
        "Place each question above as a visible <h2> or <h3> heading followed immediately by a concise 45–60 word factual answer paragraph.",
        "Include concrete verifiable facts (exact cities served, product specs, pricing model, delivery schedule) rather than vague slogans.",
        "Embed the matching FAQPage JSON-LD block above on the same page and ensure every answer matches the visible text word-for-word.",
      ],
      verificationChecklist: [
        "Validate the page in Google Rich Results Test and confirm FAQPage schema parses with 0 errors.",
        "Re-run an AI Visibility cycle in Reigel after Google/crawlers index the updated page to measure citation lift.",
      ],
      contentStudioQuery: topMissed[0].text,
      contentStudioTopic: `AI Citation Answer Page: ${topMissed[0].text}`,
    });

    // Individual high-priority missing-signal cards for top 3 missed questions with specific gaps
    topMissed.slice(0, 3).forEach((q, i) => {
      const missingSignals = q.comparison.filter((c) => c.rivalAhead).map((c) => `${c.label} (you: ${c.you} vs ${c.rivalDomain}: ${c.rival})`);
      const missingTerms = q.ownPage?.signals.missingTerms?.slice(0, 6) ?? [];
      specs.push({
        id: `AIV-0${i + 4}`,
        title: `Win AI citation for: "${q.text}"`,
        priority: "high",
        owner: q.verdict === "CONTENT_GAP" ? "Content & SEO" : "Website Owner / CMS",
        effort: q.verdict === "CONTENT_GAP" ? "Medium (60 min)" : "Low (30 min)",
        affectedUrls: q.ownPage?.url ? [q.ownPage.url] : [`${origin}/${slugifyTopic(q.text)}`],
        observedState:
          q.verdict === "CONTENT_GAP"
            ? `No dedicated page on your site cleanly answers this question.${q.answer?.competitorsCited?.length ? ` AI engines cited: ${q.answer.competitorsCited.join(", ")}.` : ""}`
            : `Matched page (${q.ownPage?.url}) is missing citation signals: ${missingSignals.join("; ") || "direct answer & structured proof"}.`,
        expectedOutcome:
          "Dedicated, fact-dense page section that directly answers the buyer query with verifiable proof and structured schema.",
        steps: [
          q.ownPage?.url
            ? `Open ${q.ownPage.url} and add a 45–60 word direct answer right under the main heading answering "${q.text}".`
            : `Create a dedicated page targeting "${q.text}" with a clear H1, factual summary, comparison/spec details, and FAQ section.`,
          ...(missingTerms.length > 0
            ? [`Cover these missing factual sub-topics where relevant to your real offering: ${missingTerms.join(", ")}.`]
            : []),
          "Link to this page from your homepage and related commercial pages using descriptive anchor text.",
        ],
        verificationChecklist: [
          "Verify the direct answer appears in initial HTML (not hidden behind click-only tabs or client-side loaders).",
          "Submit the URL for indexing in Search Console and re-test in AI Visibility.",
        ],
        contentStudioQuery: q.text,
        contentStudioTopic: `AI Visibility Answer Guide: ${q.text}`,
      });
    });
  } else if (insights?.recommendations?.length) {
    insights.recommendations.slice(0, 4).forEach((rec, i) => {
      specs.push({
        id: `AIV-0${i + 3}`,
        title: rec.title,
        priority: rec.priority === "HIGH" ? "high" : rec.priority === "MEDIUM" ? "medium" : "low",
        owner: rec.category === "TECHNICAL" ? "Web Developer" : "Content & SEO",
        effort: rec.effort === "LOW" ? "Low (30 min)" : rec.effort === "MEDIUM" ? "Medium (1 hr)" : "High (2+ hrs)",
        affectedUrls: [`${origin}/`],
        observedState: rec.evidence || rec.rationale,
        expectedOutcome: rec.rationale,
        steps: [
          `Implement: ${rec.title}.`,
          "Keep every statement grounded in verifiable facts visible on your site.",
        ],
        verificationChecklist: [
          "Verify live HTML changes and re-run an AI Visibility check to confirm citation impact.",
        ],
        contentStudioQuery: rec.category === "CONTENT" ? rec.title : undefined,
        contentStudioTopic: rec.category === "CONTENT" ? rec.title : undefined,
      });
    });
  }

  return specs;
}

/* ─────────────────────────── 3. COMPETITOR INTELLIGENCE SPECS ─────────────────────────── */

function schemaTemplate(schemaType: string, origin: string, brand: string): string {
  const t = schemaType.toLowerCase();
  if (t.includes("faq")) {
    return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "[Top Buyer Question]",
      "acceptedAnswer": { "@type": "Answer", "text": "[Concise factual answer matching visible page copy]" }
    }
  ]
}
</script>`;
  }
  if (t.includes("product")) {
    return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "[Exact Product Name]",
  "brand": { "@type": "Brand", "name": "${brand}" },
  "description": "[Factual product summary]",
  "offers": {
    "@type": "Offer",
    "url": "${origin}/[product-path]",
    "priceCurrency": "INR",
    "price": "[Exact Listed Price]",
    "availability": "https://schema.org/InStock"
  }
}
</script>`;
  }
  if (t.includes("localbusiness")) {
    return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "${brand}",
  "url": "${origin}",
  "areaServed": ["[Primary City]", "[Secondary City]"],
  "telephone": "[Official Phone Number]"
}
</script>`;
  }
  if (t.includes("breadcrumb")) {
    return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "${origin}/" },
    { "@type": "ListItem", "position": 2, "name": "[Category]", "item": "${origin}/[category]" }
  ]
}
</script>`;
  }
  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "${schemaType}",
  "name": "${brand}",
  "url": "${origin}"
}
</script>`;
}

export function buildCompetitorImplementationSpecs(report: CompetitorIntelReport): ImplementationSpec[] {
  const domain = report.facts.you?.domain || "yourdomain.com";
  const brand = report.facts.you?.name || domain;
  const origin = cleanOrigin(domain);
  const specs: ImplementationSpec[] = [];

  // 1. Missing Schema Types rivals deploy that you do not
  const missingSchemaMap = new Map<string, { rivals: string[]; maxPages: number }>();
  for (const rival of report.facts.rivals) {
    for (const s of rival.advantages?.schema ?? []) {
      if (s.them > 0 && s.you === 0) {
        const prev = missingSchemaMap.get(s.type) ?? { rivals: [], maxPages: 0 };
        prev.rivals.push(`${rival.name} (${s.them} pages)`);
        prev.maxPages = Math.max(prev.maxPages, s.them);
        missingSchemaMap.set(s.type, prev);
      }
    }
  }

  let seq = 1;
  for (const [schemaType, info] of Array.from(missingSchemaMap.entries()).slice(0, 3)) {
    specs.push({
      id: `CMP-${String(seq++).padStart(2, "0")}`,
      title: `Deploy missing ${schemaType} JSON-LD structured data`,
      priority: "high",
      owner: "Web Developer",
      effort: "Low (30 min)",
      affectedUrls: [`${origin}/`],
      observedState: `You currently have 0 pages with ${schemaType} structured data, while competitors use it: ${info.rivals.join(", ")}.`,
      expectedOutcome: `Closes the structured-data eligibility gap with rivals for Google Rich Results and AI entity understanding.`,
      codeLabel: `Standard ${schemaType} JSON-LD Template (fill only with real visible page values)`,
      codeLanguage: "html",
      codeSnippet: schemaTemplate(schemaType, origin, brand),
      steps: [
        `Embed valid ${schemaType} JSON-LD inside <head> (or before </body>) on every matching page template.`,
        "Populate values dynamically from your real page content — never include ratings, prices, or FAQs not visible to visitors.",
        "Test one live URL in Google Rich Results Test before deploying across all templates.",
      ],
      verificationChecklist: [
        "Confirm Google Rich Results Test detects the new schema type with 0 critical errors.",
        "Re-crawl in Website Audit to confirm schema page count increases.",
      ],
    });
  }

  // 2. Concrete Page-Build Content Briefs for Missing Rival Topics
  const seenTopics = new Set<string>();
  const topicCards: Array<{
    title: string;
    rivalName: string;
    rivalUrl: string;
    wordCount: number;
    pageType: string;
    questions: string[];
  }> = [];

  for (const rival of report.facts.rivals) {
    const adv = rival.advantages;
    if (!adv) continue;
    for (const t of adv.missingTopics) {
      const key = t.title.trim().toLowerCase();
      if (!key || seenTopics.has(key)) continue;
      seenTopics.add(key);
      topicCards.push({
        title: t.title,
        rivalName: rival.name,
        rivalUrl: t.url,
        wordCount: t.wordCount,
        pageType: t.pageType,
        questions: adv.questions.theirs.slice(0, 3),
      });
    }
  }

  for (const topic of topicCards.slice(0, 5)) {
    const suggestedPath = `/${slugifyTopic(topic.title)}`;
    const targetWords = Math.max(600, Math.round(topic.wordCount * 1.15 / 50) * 50);
    const briefSnippet = [
      `Suggested URL: ${origin}${suggestedPath}`,
      `Page Type: ${topic.pageType}`,
      `Rival Benchmark: ${topic.rivalName} (${topic.wordCount.toLocaleString("en-US")} words) — ${topic.rivalUrl}`,
      `Target Length: ~${targetWords.toLocaleString("en-US")} useful, fact-grounded words`,
      "",
      `H1: ${topic.title}`,
      "H2: Direct Summary & Who This Is For (45–60 words)",
      "H2: Specifications, Process, or Comparison Table",
      ...(topic.questions.length > 0
        ? ["H2: Buyer Questions to Answer", ...topic.questions.map((q) => `  - ${q}`)]
        : ["H2: Frequently Asked Questions"]),
    ].join("\n");

    specs.push({
      id: `CMP-${String(seq++).padStart(2, "0")}`,
      title: `Build missing commercial/topic page: "${topic.title}"`,
      priority: "high",
      owner: "Content & SEO",
      effort: "Medium (60–90 min)",
      affectedUrls: [`${origin}${suggestedPath}`],
      observedState: `${topic.rivalName} covers "${topic.title}" (${topic.wordCount.toLocaleString("en-US")} words at ${topic.rivalUrl}), while your site has no matching page.`,
      expectedOutcome: `Captures buyer search demand and AI citations currently going uncontested to ${topic.rivalName}.`,
      codeLabel: "Universal Page-Build Brief (hand to any writer, CMS editor, or developer)",
      codeLanguage: "markdown",
      codeSnippet: briefSnippet,
      steps: [
        `Create ${suggestedPath} with a unique <title>, meta description, and single <h1> targeting "${topic.title}".`,
        `Outperform ${topic.rivalName}'s ${topic.wordCount}-word benchmark with sharper, fact-grounded details, clear buyer proof, and an FAQ section.`,
        "Add internal links from your homepage/category pages and submit the new URL in Search Console.",
      ],
      verificationChecklist: [
        `Confirm ${origin}${suggestedPath} returns HTTP 200 OK, has a self-referencing canonical, and is included in /sitemap.xml.`,
        "Verify the page is indexed in Search Console within 7–14 days.",
      ],
      contentStudioQuery: topic.title,
      contentStudioTopic: `Competitor Gap Counter-Page: ${topic.title}`,
    });
  }

  return specs;
}

/* ─────────────────────────── 4. BACKLINK INTELLIGENCE SPECS ─────────────────────────── */

export function buildBacklinkImplementationSpecs(params: {
  report: BacklinkReport | undefined;
  outreachItems: BacklinkOutreachItem[];
  domain: string | null;
  clientName: string;
}): ImplementationSpec[] {
  const { report, outreachItems, domain, clientName } = params;
  if (!report) return [];
  const origin = cleanOrigin(domain);
  const specs: ImplementationSpec[] = [];
  let seq = 1;

  // 1. Broken / Needs-Fix Target URLs receiving real backlinks -> Universal 301 Redirect Spec
  const brokenTargets = new Map<string, { sources: string[]; reason: string }>();
  for (const src of report.sources) {
    for (const link of src.links) {
      if (link.targetKind === "OWN" && link.readiness?.state === "NEEDS_FIX") {
        const prev = brokenTargets.get(link.targetUrl) ?? {
          sources: [],
          reason: link.readiness.reason || "Target URL returned non-200 or redirect error",
        };
        prev.sources.push(hostOf(src.sourceUrl));
        brokenTargets.set(link.targetUrl, prev);
      }
    }
  }

  if (brokenTargets.size > 0) {
    const entries = Array.from(brokenTargets.entries()).slice(0, 10);
    const redirectMap = entries
      .map(([target]) => `${target}  -->  301  -->  ${origin}/[closest-live-page]`)
      .join("\n");

    specs.push({
      id: `BLK-${String(seq++).padStart(2, "0")}`,
      title: `Restore link equity on ${entries.length} broken target URL${entries.length === 1 ? "" : "s"} receiving external backlinks`,
      priority: "high",
      owner: "Web Developer",
      effort: "Low (15–30 min)",
      affectedUrls: entries.map(([target]) => target),
      observedState: `${entries.length} URL${entries.length === 1 ? "" : "s"} on your site have external referring domains pointing to them but failed target readiness checks (${entries[0][1].reason}).`,
      expectedOutcome:
        "301 redirects immediately reclaim lost domain authority and stop external visitors from hitting 404 dead ends.",
      codeLabel: "Universal 301 Redirect Map (apply in CMS redirect manager, CDN, or web server)",
      codeLanguage: "text",
      codeSnippet: redirectMap,
      steps: [
        "For each broken target URL above, either restore the live page (HTTP 200) or configure a permanent HTTP 301 redirect to the closest relevant live page.",
        "Avoid redirecting all broken URLs blindly to the homepage if a specific product/category replacement exists.",
        "Re-verify links in Reigel Backlink Intelligence after deploying redirects.",
      ],
      verificationChecklist: [
        `Run curl -I "${entries[0][0]}" and verify HTTP 301 → final destination HTTP 200 OK in a single hop.`,
      ],
    });
  }

  // 2. Confirmed Lost Backlinks -> Ready-to-Send Universal Recovery Outreach Briefs
  const lostSources = report.sources.filter(
    (s) => s.status.toUpperCase() === "LOST" || s.links.some((l) => l.status.toUpperCase() === "LOST"),
  );

  for (const src of lostSources.slice(0, 4)) {
    const refDomain = hostOf(src.sourceUrl);
    const lostLink = src.links.find((l) => l.status.toUpperCase() === "LOST") ?? src.links[0];
    const targetUrl = lostLink?.targetUrl || `${origin}/`;
    const savedOutreach = outreachItems.find(
      (item) => item.sourceUrl === src.sourceUrl || hostOf(item.sourceUrl) === refDomain,
    );

    const emailDraft =
      (savedOutreach?.emailDraft
        ? `${savedOutreach.subject ? `Subject: ${savedOutreach.subject}\n\n` : ""}${savedOutreach.emailDraft}`
        : null) ||
      `Subject: Quick link update for ${refDomain}\n\nHi ${refDomain} team,\n\nWe noticed your page at ${src.sourceUrl} previously referenced ${clientName} (${targetUrl}), and the link appears to have dropped during a recent update.\n\nOur updated resource is live at ${targetUrl} if you'd like to restore the reference for your readers.\n\nThanks so much,\n${clientName} Team`;

    specs.push({
      id: `BLK-${String(seq++).padStart(2, "0")}`,
      title: `Recover lost backlink from ${refDomain}`,
      priority: "high",
      owner: "Outreach / PR",
      effort: "Low (10 min)",
      affectedUrls: [src.sourceUrl, targetUrl],
      observedState: `Link from ${src.sourceUrl} to ${targetUrl} is confirmed LOST${savedOutreach ? ` (Outreach tracker status: ${savedOutreach.status})` : ""}.`,
      expectedOutcome: `Restores an already-earned referring domain backlink from ${refDomain} with minimal outreach friction.`,
      codeLabel: "Ready-to-Send Recovery Outreach Email",
      codeLanguage: "text",
      codeSnippet: emailDraft,
      steps: [
        `Confirm ${targetUrl} loads cleanly (HTTP 200 OK) before contacting the editor.`,
        `Send the brief recovery email above to the site editor or contact address on ${refDomain}.`,
        "Update the outreach status in Backlinks → Lost-Link Recovery once replied or restored so it logs to your Fix Impact Ledger.",
      ],
      verificationChecklist: [
        `Re-run Backlink Verification on ${refDomain} in Reigel to confirm the link returns to LIVE status.`,
      ],
    });
  }

  // 3. Open Actionable Opportunities from BacklinkReport
  for (const opp of report.opportunities.slice(0, 4)) {
    specs.push({
      id: `BLK-${String(seq++).padStart(2, "0")}`,
      title: opp.title,
      priority: "medium",
      owner: "Outreach / PR",
      effort: "Low–Medium (20–45 min)",
      affectedUrls: opp.evidence
        .map((e) => e.value)
        .filter((v) => /^https?:\/\//i.test(v))
        .slice(0, 4),
      observedState: opp.summary || `Lifecycle: ${opp.lifecycle}`,
      expectedOutcome: opp.recommendedAction,
      steps: [
        opp.recommendedAction,
        "Track publisher outreach and link verification in Reigel Backlinks.",
      ],
      verificationChecklist: [
        "Verify the new or restored backlink appears as LIVE in Backlinks → Verified Sources.",
      ],
    });
  }

  return specs;
}

/* ─────────────────────────── Markdown Formatters ─────────────────────────── */

export function formatSpecAsMarkdown(spec: ImplementationSpec): string {
  const lines: string[] = [
    `### [${spec.id}] ${spec.title}`,
    `**Priority:** ${spec.priority.toUpperCase()} · **Owner:** ${spec.owner} · **Effort:** ${spec.effort}`,
    "",
    `**Observed State:** ${spec.observedState}`,
    "",
    `**Expected Outcome:** ${spec.expectedOutcome}`,
  ];
  if (spec.affectedUrls.length > 0) {
    lines.push("", "**Affected URLs:**", ...spec.affectedUrls.map((u) => `- ${u}`));
  }
  if (spec.codeSnippet) {
    lines.push(
      "",
      `**${spec.codeLabel || "Implementation Reference"}:**`,
      `\`\`\`${spec.codeLanguage || "text"}`,
      spec.codeSnippet,
      "```",
    );
  }
  if (spec.steps.length > 0) {
    lines.push("", "**Implementation Steps:**", ...spec.steps.map((s, i) => `${i + 1}. ${s}`));
  }
  if (spec.verificationChecklist.length > 0) {
    lines.push("", "**How to Verify (QA Checklist):**", ...spec.verificationChecklist.map((v) => `- [ ] ${v}`));
  }
  return lines.join("\n");
}

export function formatSpecsDocument(
  reportTitle: string,
  domain: string | null | undefined,
  specs: ImplementationSpec[],
): string {
  const header = [
    `# ${reportTitle} — Universal Implementation & Handoff Guide`,
    "",
    `Website: ${domain || "your website"} · Generated: ${new Date().toISOString().slice(0, 10)} · ${specs.length} action brief(s)`,
    "",
    "> **Platform-agnostic handoff document:** Every snippet below uses standard HTML, JSON-LD, HTTP 301 redirect mappings, robots.txt, and plain copy briefs so any website owner, CMS editor, or web developer on any tech stack can implement and verify each item independently.",
    "",
    "---",
    "",
  ];
  return header.join("\n") + specs.map(formatSpecAsMarkdown).join("\n\n---\n\n") + "\n";
}
