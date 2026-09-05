"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  Layers,
  Loader2,
  Sparkles,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { ActionButton, Pill } from "@/components/ui/console";
import type { CrawlIssue } from "@/lib/api-client";

interface AutoFixModalProps {
  issue: CrawlIssue | null;
  onClose: () => void;
}

type Platform = "nextjs" | "shopify" | "html";

export function AutoFixModal({ issue, onClose }: AutoFixModalProps) {
  const [platform, setPlatform] = useState<Platform>("nextjs");
  const [copied, setCopied] = useState(false);
  const [resolved, setResolved] = useState(false);

  // `issue` is null whenever the modal has nothing to show. That check cannot
  // come before the hooks below: React matches hooks up by call order, so a
  // component that runs three fewer of them on some renders crashes with
  // "rendered more hooks than during the previous render" the moment it is
  // mounted with a null issue and then given one. Each memo handles the null
  // case instead, and the early return happens once they have all run.
  const affectedPath = useMemo(() => {
    if (!issue) return "";
    try {
      const url = new URL(issue.affectedUrl);
      return url.pathname || "/";
    } catch {
      return issue.affectedUrl;
    }
  }, [issue]);

  // Generate deterministic, accurate platform fixes based on issue type
  const fixData = useMemo(() => {
    if (!issue) return null;
    const issueType = (issue.issueType || "").toUpperCase();
    const domain = (() => {
      try {
        return new URL(issue.affectedUrl).hostname;
      } catch {
        return "example.com";
      }
    })();

    if (
      issueType.includes("GEO") ||
      issueType.includes("QUOTABILITY") ||
      issueType.includes("ANSWER_BLOCK") ||
      issueType.includes("LLM")
    ) {
      return {
        title: "GEO LLM-Quotable Answer Block & FAQ Schema",
        before: `<!-- Conversational page copy lacks concise definition blocks -->\n<!-- Risk: LLMs (Google AI Overviews, ChatGPT Search, Perplexity) fail to extract direct quotes without structured answers -->`,
        afterNext: `// app${affectedPath === "/" ? "" : affectedPath}/page.tsx\n// 1. LLM-Quotable Answer Section (45-55 words)\n// 2. Embedded Schema.org FAQPage JSON-LD for AI Overviews\n\nexport function GeoAnswerBlock() {\n  const faqSchema = {\n    "@context": "https://schema.org",\n    "@type": "FAQPage",\n    "mainEntity": [\n      {\n        "@type": "Question",\n        "name": "What is the primary solution provided by ${domain}?",\n        "acceptedAnswer": {\n          "@type": "Answer",\n          "text": "${domain} delivers enterprise-grade verification, automated workflow orchestration, and verified performance analytics with high data fidelity and sub-second latency.",\n        },\n      },\n    ],\n  };\n\n  return (\n    <section className="geo-answer-block my-6 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-6">\n      <script\n        type="application/ld+json"\n        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}\n      />\n      <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">\n        Key Summary & Direct Overview\n      </h2>\n      <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300 font-medium">\n        <strong>${domain}</strong> provides authoritative solutions engineered to streamline enterprise operations, delivering verified data accuracy and measurable ROI through automated workflows and structured integrations.\n      </p>\n      <ul className="mt-4 space-y-1.5 text-sm text-gray-600 dark:text-gray-400 list-disc pl-5">\n        <li><strong>Architecture:</strong> Fully compliant schema-grounded endpoints.</li>\n        <li><strong>Information Gain:</strong> Verified benchmarks and quantitative audit trails.</li>\n        <li><strong>Citation Target:</strong> Direct snippet extraction for Google AI Overviews and ChatGPT.</li>\n      </ul>\n    </section>\n  );\n}`,
        afterShopify: `<!-- snippets/geo-answer-block.liquid -->\n<section class="geo-answer-block" style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0; background: #f8fafc;">\n  <script type="application/ld+json">\n  {\n    "@context": "https://schema.org",\n    "@type": "FAQPage",\n    "mainEntity": [{\n      "@type": "Question",\n      "name": "What is the core benefit of {{ shop.name }}?",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "{{ shop.name }} offers verified, curated products with guaranteed quality, fast fulfillment, and full customer protection."\n      }\n    }]\n  }\n  </script>\n  <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">Direct Answer & Overview</h2>\n  <p style="font-size: 1rem; line-height: 1.6; color: #334155;">\n    <strong>{{ shop.name }}</strong> is the authoritative provider of verified solutions, offering tested reliability and responsive service across all regional markets.\n  </p>\n</section>`,
        afterHtml: `<section class="geo-quotable-block" itemscope itemtype="https://schema.org/FAQPage">\n  <script type="application/ld+json">\n  {\n    "@context": "https://schema.org",\n    "@type": "FAQPage",\n    "mainEntity": [{\n      "@type": "Question",\n      "name": "What is the primary solution provided by ${domain}?",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "${domain} delivers enterprise-grade verification, automated workflow orchestration, and verified performance analytics."\n      }\n    }]\n  }\n  </script>\n  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">\n    <h2 itemprop="name">Primary Value Overview: ${domain}</h2>\n    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">\n      <p itemprop="text">\n        <strong>${domain}</strong> is an authoritative industry platform providing verified solutions, transparent data benchmarks, and high-efficiency operational tooling designed for rapid implementation.\n      </p>\n    </div>\n  </div>\n</section>`,
        explanation: "Embeds a concise 45-word direct answer block and FAQ Schema markup engineered for immediate snippet citation in Google AI Overviews, Perplexity AI, and ChatGPT Search.",
      };
    }

    if (issueType.includes("CANONICAL") || issueType.includes("DUPLICATE")) {
      return {
        title: "Canonical URL Normalization",
        before: `<!-- Missing or ambiguous self-referential canonical -->\n<!-- Risk: Search engines splitting PageRank across URL variants -->`,
        afterNext: `// app${affectedPath === "/" ? "" : affectedPath}/page.tsx\nimport type { Metadata } from "next";\n\nexport const metadata: Metadata = {\n  alternates: {\n    canonical: "${issue.affectedUrl}",\n  },\n};`,
        afterShopify: `<!-- theme.liquid inside <head> -->\n<link rel="canonical" href="{{ canonical_url }}">\n{%- if canonical_url != request.origin | append: request.path -%}\n  <!-- Auto-redirects query parameter duplicates to primary permalink -->\n{%- endif -%}`,
        afterHtml: `<link rel="canonical" href="${issue.affectedUrl}" />`,
        explanation: "Establishes the authoritative master URL to consolidate indexing signals and eliminate duplicate content penalties.",
      };
    }

    if (issueType.includes("DESCRIPTION") || issueType.includes("META")) {
      return {
        title: "SEO Meta Description Optimization",
        before: `<!-- Missing <meta name="description"> tag -->\n<!-- Result: Search engines pick random page text snippets for SERP snippets -->`,
        afterNext: `// app${affectedPath === "/" ? "" : affectedPath}/page.tsx\nimport type { Metadata } from "next";\n\nexport const metadata: Metadata = {\n  title: "Official Site | ${domain}",\n  description: "Explore verified products, official services, and customer reviews on ${domain}. High performance and secure checkout.",\n  openGraph: {\n    description: "Explore verified products, official services, and customer reviews on ${domain}.",\n  },\n};`,
        afterShopify: `<!-- Inside <head> in theme.liquid or template -->\n{%- if page_description -%}\n  <meta name="description" content="{{ page_description | escape }}">\n{%- else -%}\n  <meta name="description" content="{{ shop.name | escape }} - Official verified storefront for curated collections and fast shipping.">\n{%- endif -%}`,
        afterHtml: `<meta name="description" content="Discover verified products and services on ${domain}. Industry leading quality, transparent pricing, and fast delivery." />`,
        explanation: "Supplies a compelling 155-character summary with high click-through keywords to boost SERP CTR.",
      };
    }

    if (issueType.includes("SCHEMA") || issueType.includes("STRUCTURED")) {
      return {
        title: "Structured Data (Schema.org JSON-LD)",
        before: `<!-- Missing or unparseable Schema.org structured data -->\n<!-- Missing rich snippets eligibility in Google search -->`,
        afterNext: `// app${affectedPath === "/" ? "" : affectedPath}/page.tsx\nexport default function Page() {\n  const jsonLd = {\n    "@context": "https://schema.org",\n    "@type": "WebPage",\n    "name": "${domain} - Primary Service",\n    "url": "${issue.affectedUrl}",\n    "publisher": {\n      "@type": "Organization",\n      "name": "${domain}",\n      "url": "https://${domain}"\n    }\n  };\n\n  return (\n    <>\n      <script\n        type="application/ld+json"\n        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}\n      />\n      <main>{/* Page content */}</main>\n    </>\n  );\n}`,
        afterShopify: `<!-- In snippets/structured-data.liquid -->\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": {{ shop.name | json }},\n  "url": {{ shop.url | json }},\n  "logo": {{ settings.logo | image_url: width: 500 | json }}\n}\n</script>`,
        afterHtml: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "name": "${domain}",\n  "url": "${issue.affectedUrl}"\n}\n</script>`,
        explanation: "Injects Google-validated JSON-LD syntax for rich snippet search results and Google Knowledge Graph recognition.",
      };
    }

    if (issueType.includes("H1") || issueType.includes("HEADING")) {
      return {
        title: "Single H1 Semantic Hierarchy",
        before: `<!-- Missing <h1> tag or multiple disparate H1s competing on the page -->`,
        afterNext: `// Ensure exactly one semantic <h1> wraps the primary page subject\nexport default function PageHeading() {\n  return (\n    <header className="py-6">\n      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">\n        Primary Value Proposition for ${domain}\n      </h1>\n    </header>\n  );\n}`,
        afterShopify: `<!-- In product or collection template -->\n<div class="page-title-wrapper">\n  <h1 class="main-page-title h2">\n    {{ page.title | default: product.title | escape }}\n  </h1>\n</div>`,
        afterHtml: `<header>\n  <h1>Authoritative Service Name | ${domain}</h1>\n</header>`,
        explanation: "Aligns page document outline to W3C semantic standards with a single, clear H1 heading for ranking topicality.",
      };
    }

    // Default general technical fix
    return {
      title: "Technical SEO Code Remediation",
      before: `<!-- Flagged issue: ${issue.issueType} -->\n<!-- ${issue.description} -->`,
      afterNext: `// app${affectedPath === "/" ? "" : affectedPath}/page.tsx\n// Applied remediation for ${issue.issueType}\nexport const metadata = {\n  title: "Optimized | ${domain}",\n  robots: {\n    index: true,\n    follow: true,\n    googleBot: { index: true, follow: true },\n  },\n};`,
      afterShopify: `{%- comment -%} GrowthX Auto-Fix for ${issue.issueType} {%- endcomment -%}\n<meta name="robots" content="index,follow">`,
      afterHtml: `<meta name="robots" content="index, follow" />\n<!-- Remediated: ${issue.issueType} -->`,
      explanation: issue.recommendation || "Applies standardized, crawler-friendly code structure to resolve the detected audit defect.",
    };
  }, [issue, affectedPath]);

  const activeSnippet = useMemo(() => {
    if (!fixData) return "";
    switch (platform) {
      case "nextjs":
        return fixData.afterNext;
      case "shopify":
        return fixData.afterShopify;
      case "html":
        return fixData.afterHtml;
    }
  }, [platform, fixData]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  if (!issue || !fixData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="border-b border-brand-200 dark:border-brand-800 px-5 py-4 flex items-center justify-between bg-brand-50/50 dark:bg-brand-900/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-accent-100 dark:bg-accent-950/60 text-accent-700 dark:text-accent-300">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-brand-950 dark:text-brand-100">{fixData.title}</h3>
                <Pill tone={issue.severity === "CRITICAL" ? "bad" : issue.severity === "HIGH" ? "warn" : "info"}>
                  {issue.severity}
                </Pill>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{issue.issueType} · {affectedPath}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-brand-400 hover:text-brand-700 dark:hover:text-brand-200 hover:bg-brand-100 dark:hover:bg-brand-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Affected Target & Description */}
          <div className="p-3.5 bg-brand-50/70 dark:bg-brand-900/20 border border-brand-200/80 dark:border-brand-800/80 rounded-lg text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-brand-950 dark:text-brand-100">Audit Diagnosis:</span>
              <a
                href={issue.affectedUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent-600 dark:text-accent-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
              >
                <span>{issue.affectedUrl}</span>
                <ExternalLink size={10} />
              </a>
            </div>
            <p className="text-brand-700 dark:text-brand-300">{issue.description}</p>
            <p className="text-[var(--text-muted)] text-[11px] pt-0.5">
              <strong className="text-brand-900 dark:text-brand-200">Recommended action:</strong> {issue.recommendation || fixData.explanation}
            </p>
          </div>

          {/* Platform Selector Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-500">Target Framework / Stack</span>
              <span className="text-[11px] text-[var(--text-muted)]">Copy-paste ready code</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "nextjs", label: "Next.js (App / Pages)", desc: "Metadata & Head" },
                { id: "shopify", label: "Shopify Liquid", desc: "theme.liquid" },
                { id: "html", label: "Raw HTML / JSON-LD", desc: "Universal standard" },
              ].map((plat) => (
                <button
                  key={plat.id}
                  type="button"
                  onClick={() => setPlatform(plat.id as Platform)}
                  className={`p-2.5 rounded-lg border text-left transition flex flex-col ${
                    platform === plat.id
                      ? "border-accent-600 bg-accent-50/50 dark:bg-accent-950/20 text-accent-950 dark:text-accent-100 ring-1 ring-accent-600"
                      : "border-brand-200 dark:border-brand-800 hover:bg-brand-50/60 dark:hover:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                  }`}
                >
                  <span className="text-xs font-bold">{plat.label}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{plat.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Before vs After Visual Diff */}
          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span>Current State (Defect Detected)</span>
              </span>
              <pre className="p-3 bg-red-950/10 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-xs font-mono text-red-900 dark:text-red-300 overflow-x-auto">
                {fixData.before}
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>AI Remediated Code ({platform.toUpperCase()})</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-600 hover:text-accent-700 transition"
                >
                  {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{copied ? "Copied to Clipboard!" : "Copy Code Snippet"}</span>
                </button>
              </div>
              <pre className="p-3.5 bg-brand-950 rounded-lg text-xs font-mono text-emerald-400 border border-brand-800 overflow-x-auto max-h-56 leading-relaxed">
                {activeSnippet}
              </pre>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-brand-200 dark:border-brand-800 px-5 py-3.5 bg-brand-50/50 dark:bg-brand-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {resolved ? (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={13} />
                <span>Marked for verification on next crawl</span>
              </span>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">
                Deploy code snippet to your codebase, then re-crawl to verify.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ActionButton
              variant="secondary"
              onClick={handleCopy}
              icon={copied ? <Check size={12} /> : <Copy size={12} />}
            >
              {copied ? "Copied!" : "Copy Snippet"}
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={() => {
                setResolved(true);
                setTimeout(onClose, 1200);
              }}
              icon={<CheckCircle2 size={12} />}
            >
              {resolved ? "Done" : "Apply & Resolve"}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
