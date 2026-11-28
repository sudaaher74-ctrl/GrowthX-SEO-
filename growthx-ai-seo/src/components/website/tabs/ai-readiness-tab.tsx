"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  GitBranch,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api, type AiReadinessResponse, type CrawlPage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function safePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || "");
  } catch {
    return url;
  }
}

function buildClientLlmsTxt(domain: string, pages: CrawlPage[]): string {
  const indexable = pages.filter((p) => p.statusCode === 200 && p.indexability !== "NOT_INDEXABLE");
  const home = indexable.find((p) => {
    const path = safePath(p.url);
    return path === "/" || path === "";
  });
  const cleanTitle = (p: CrawlPage) => (p.title || p.url).replace(/[\r\n]+/g, " ").trim().slice(0, 90);
  const cleanDesc = (d: string | null) => (d ? `: ${d.replace(/[\r\n]+/g, " ").trim().slice(0, 140)}` : "");
  const moneyTypes = new Set(["HOME", "PRODUCT", "SERVICE", "PRICING", "LOCATION", "CATEGORY"]);
  const contentTypes = new Set(["BLOG", "ARTICLE", "FAQ", "CASE_STUDY", "GUIDE"]);
  const corePages = indexable.filter((p) => moneyTypes.has((p.pageType || "").toUpperCase())).slice(0, 20);
  const guides = indexable.filter((p) => contentTypes.has((p.pageType || "").toUpperCase())).slice(0, 20);
  const others = indexable
    .filter((p) => !moneyTypes.has((p.pageType || "").toUpperCase()) && !contentTypes.has((p.pageType || "").toUpperCase()))
    .slice(0, 10);

  const lines: string[] = [
    `# ${home?.title?.split(/[|–-]/)[0]?.trim() || domain}`,
    "",
    `> ${home?.metaDescription?.trim() || `Official website and offerings for ${domain}.`}`,
    "",
  ];
  if (corePages.length > 0) {
    lines.push("## Core Pages & Offerings", "");
    corePages.forEach((p) => lines.push(`- [${cleanTitle(p)}](${p.url})${cleanDesc(p.metaDescription)}`));
    lines.push("");
  }
  if (guides.length > 0) {
    lines.push("## Guides, Articles & FAQs", "");
    guides.forEach((p) => lines.push(`- [${cleanTitle(p)}](${p.url})${cleanDesc(p.metaDescription)}`));
    lines.push("");
  }
  if (others.length > 0) {
    lines.push("## Additional Resources", "");
    others.forEach((p) => lines.push(`- [${cleanTitle(p)}](${p.url})${cleanDesc(p.metaDescription)}`));
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

function buildFallbackFromPages(
  domain: string,
  pages: CrawlPage[],
  edgeData: {
    robotsTxtFound: boolean;
    aiBots: AiReadinessResponse["aiBots"];
    llmsTxt: { exists: boolean; status: number; preview: string | null };
  },
): AiReadinessResponse {
  const indexable = pages.filter((p) => p.statusCode === 200 && p.indexability !== "NOT_INDEXABLE");
  const jsDependent = indexable.filter((p) => p.jsRequired);
  const blindnessPct = indexable.length > 0 ? Math.round((jsDependent.length / indexable.length) * 100) : 0;

  const depthBuckets = { depth0: 0, depth1: 0, depth2: 0, depth3: 0, depth4Plus: 0, unreached: 0 };
  const moneyTypes = new Set(["HOME", "PRODUCT", "SERVICE", "PRICING", "LOCATION", "CATEGORY"]);
  const archPages = indexable.map((p) => {
    const segs = safePath(p.url).split("?")[0].split("/").filter(Boolean).length;
    const depth = segs;
    if (depth === 0) depthBuckets.depth0++;
    else if (depth === 1) depthBuckets.depth1++;
    else if (depth === 2) depthBuckets.depth2++;
    else if (depth === 3) depthBuckets.depth3++;
    else depthBuckets.depth4Plus++;
    return {
      url: p.url,
      title: p.title,
      pageType: p.pageType || "OTHER",
      depth,
      equity: Number((Math.max(0.2, 2.0 - depth * 0.4)).toFixed(2)),
      isMoney: moneyTypes.has((p.pageType || "").toUpperCase()),
    };
  });

  return {
    domain,
    robotsTxtFound: edgeData.robotsTxtFound,
    aiBots: edgeData.aiBots,
    llmsTxt: {
      ...edgeData.llmsTxt,
      generatedTemplate: buildClientLlmsTxt(domain, pages),
    },
    jsBlindness: {
      totalIndexable: indexable.length,
      jsDependentCount: jsDependent.length,
      blindnessPct,
    },
    schemaCoverage: [],
    architecture: {
      depthBuckets,
      topAuthorityPages: [...archPages].sort((a, b) => b.equity - a.equity).slice(0, 8),
      starvedMoneyPages: archPages.filter((p) => p.isMoney && p.depth >= 3).slice(0, 8),
    },
  };
}

export function AiReadinessTab({
  jobId,
  domain,
  pages,
  onInspectPage,
}: {
  jobId: string | null;
  domain?: string | null;
  pages: CrawlPage[];
  onInspectPage?: (page: CrawlPage) => void;
}) {
  const [copiedLlms, setCopiedLlms] = useState(false);

  const query = useQuery({
    queryKey: ["crawl-ai-readiness", jobId, domain],
    queryFn: async (): Promise<AiReadinessResponse> => {
      try {
        return await api.getCrawlAiReadiness(jobId!);
      } catch {
        // Fallback when backend container hasn't deployed /ai-readiness yet:
        // fetch live robots.txt + /llms.txt via Vercel route and derive page metrics from crawled pages.
        const fallbackDomain =
          domain ||
          (() => {
            try {
              return pages[0]?.url ? new URL(pages[0].url).hostname : "";
            } catch {
              return "";
            }
          })();
        if (!fallbackDomain) {
          throw new Error("Could not resolve domain for AI readiness check.");
        }
        const res = await fetch(`/api/ai-readiness?domain=${encodeURIComponent(fallbackDomain)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Could not fetch live robots.txt and llms.txt.");
        }
        const edgeData = (await res.json()) as {
          robotsTxtFound: boolean;
          aiBots: AiReadinessResponse["aiBots"];
          llmsTxt: { exists: boolean; status: number; preview: string | null };
        };
        return buildFallbackFromPages(fallbackDomain, pages, edgeData);
      }
    },
    enabled: Boolean(jobId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const handleCopyLlms = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedLlms(true);
      setTimeout(() => setCopiedLlms(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadLlms = (content: string, domain: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llms-${domain.replace(/[^a-z0-9.-]/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inspectByUrl = (url: string) => {
    const found = pages.find((p) => p.url === url);
    if (found && onInspectPage) onInspectPage(found);
  };

  if (!jobId) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-surface-1 p-8 text-center text-xs text-brand-500">
        Run a website audit first to measure AI crawler access, llms.txt readiness, and internal link equity.
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-brand-200 bg-surface-1 p-12 shadow-card">
        <Loader2 size={24} className="animate-spin text-signal-400" />
        <p className="text-xs font-semibold text-brand-700">
          Testing AI crawler permissions, checking /llms.txt, and computing link equity…
        </p>
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50/40 p-6 text-center text-xs font-semibold text-error-700">
        Could not load AI readiness diagnostics: {query.error instanceof Error ? query.error.message : "Unknown error"}
      </div>
    );
  }

  const data = query.data;
  const blockedBots = data.aiBots.filter((b) => b.status === "BLOCKED").length;
  const allowedBots = data.aiBots.filter((b) => b.status === "ALLOWED").length;
  const buckets = data.architecture.depthBuckets;
  const depthRows = [
    { label: "Depth 0 (Homepage)", count: buckets.depth0, tone: "bg-success-500" },
    { label: "Depth 1 (Direct Nav)", count: buckets.depth1, tone: "bg-series-1" },
    { label: "Depth 2 (Category / Hub)", count: buckets.depth2, tone: "bg-series-2" },
    { label: "Depth 3 (Acceptable)", count: buckets.depth3, tone: "bg-warning-500" },
    { label: "Depth 4+ (Buried)", count: buckets.depth4Plus, tone: "bg-error-500" },
    { label: "Unreached / Orphan", count: buckets.unreached, tone: "bg-brand-400" },
  ];
  const maxDepthCount = Math.max(...depthRows.map((d) => d.count), 1);

  return (
    <div className="space-y-5">
      {/* ── TOP 4 AI READINESS KPIS ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">AI Search Bots</p>
            <Bot size={15} className="text-signal-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-brand-950">
            {allowedBots}/{data.aiBots.length}
          </p>
          <p className="mt-1 text-[11px] text-brand-500">
            {blockedBots > 0 ? `${blockedBots} blocked in robots.txt` : "All major AI bots allowed"}
          </p>
        </div>

        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">/llms.txt Standard</p>
            <FileCode2 size={15} className="text-brand-600" />
          </div>
          <p className="mt-2 font-mono text-xl font-black text-brand-950">
            {data.llmsTxt.exists ? "Detected ✓" : "Missing"}
          </p>
          <p className="mt-1 text-[11px] text-brand-500">
            {data.llmsTxt.exists ? `HTTP ${data.llmsTxt.status} live at /llms.txt` : "Auto-generated template ready below"}
          </p>
        </div>

        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">LLM JS-Blindness</p>
            <AlertTriangle size={15} className={data.jsBlindness.blindnessPct > 25 ? "text-warning-600" : "text-success-600"} />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-brand-950">
            {data.jsBlindness.blindnessPct}%
          </p>
          <p className="mt-1 text-[11px] text-brand-500">
            {data.jsBlindness.jsDependentCount} of {data.jsBlindness.totalIndexable} pages require JS
          </p>
        </div>

        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Entity Schema Types</p>
            <Code2 size={15} className="text-brand-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-brand-950">
            {data.schemaCoverage.length}
          </p>
          <p className="mt-1 text-[11px] text-brand-500">
            {data.schemaCoverage.length > 0
              ? data.schemaCoverage.slice(0, 3).map((s) => s.type).join(", ")
              : "No JSON-LD entities persisted"}
          </p>
        </div>
      </div>

      {/* ── AI BOT ACCESS MATRIX (robots.txt) ── */}
      <div className="overflow-hidden rounded-2xl border border-brand-200 bg-surface-1 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-200 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal-400 text-signal-ink">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-brand-950">AI Crawler &amp; LLM Access Matrix</h2>
              <p className="text-[11.5px] text-brand-500">
                Live audit of <span className="font-mono">https://{data.domain}/robots.txt</span> across ChatGPT, Perplexity, Claude, and Gemini crawlers.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold text-brand-700">
            {data.robotsTxtFound ? "robots.txt found" : "No robots.txt (defaults to allow)"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 p-4 md:grid-cols-2 lg:grid-cols-3">
          {data.aiBots.map((bot) => (
            <div
              key={bot.bot}
              className="flex flex-col justify-between rounded-xl border border-brand-200/70 bg-surface-2/40 p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-bold text-brand-950">{bot.bot}</p>
                  <p className="text-[10.5px] text-brand-500">{bot.vendor} · {bot.purpose}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold shrink-0",
                    bot.status === "ALLOWED"
                      ? "bg-success-50 text-success-700 border border-success-200/70"
                      : bot.status === "BLOCKED"
                        ? "bg-error-50 text-error-700 border border-error-200/70"
                        : "bg-brand-100 text-brand-600",
                  )}
                >
                  {bot.status === "ALLOWED" ? (
                    <CheckCircle2 size={10} />
                  ) : bot.status === "BLOCKED" ? (
                    <ShieldAlert size={10} />
                  ) : null}
                  {bot.status}
                </span>
              </div>
              {bot.matchedRule && (
                <p className="mt-2 truncate rounded bg-surface-1 px-2 py-1 font-mono text-[10px] text-brand-600 border border-brand-200/50">
                  {bot.matchedRule}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 1-CLICK /llms.txt GENERATOR ── */}
      <div className="overflow-hidden rounded-2xl border border-brand-200 bg-surface-1 shadow-card">
        <div className="flex flex-col gap-3 border-b border-brand-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 border border-brand-200 text-brand-800">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-brand-950">
                1-Click <span className="font-mono">/llms.txt</span> Generator
              </h2>
              <p className="text-[11.5px] text-brand-500">
                {data.llmsTxt.exists
                  ? "Your site already publishes /llms.txt. Compare or refresh it with this crawl-generated version."
                  : "Publish this file at your domain root (/llms.txt) so ChatGPT, Claude, and Perplexity index your core pages cleanly."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopyLlms(data.llmsTxt.generatedTemplate)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 cursor-pointer"
            >
              {copiedLlms ? <Check size={12} className="text-success-600" /> : <Copy size={12} />}
              <span>{copiedLlms ? "Copied!" : "Copy llms.txt"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadLlms(data.llmsTxt.generatedTemplate, data.domain)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 cursor-pointer"
            >
              <Download size={12} />
              <span>Download .txt</span>
            </button>
          </div>
        </div>
        <div className="p-4">
          <pre className="max-h-64 overflow-auto rounded-xl bg-brand-950 p-4 font-mono text-[11.5px] leading-relaxed text-brand-100">
            {data.llmsTxt.generatedTemplate}
          </pre>
        </div>
      </div>

      {/* ── PHASE 3: VISUAL CLICK-DEPTH FUNNEL & LINK EQUITY EXPLORER ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Click-Depth Funnel */}
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 border border-brand-200 text-brand-800">
              <GitBranch size={15} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-950">Click-Depth Architecture Funnel</h3>
              <p className="text-[11px] text-brand-500">
                Keep revenue pages within ≤3 clicks of the homepage for maximum crawl budget &amp; PageRank.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {depthRows.map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-brand-800">{row.label}</span>
                  <span className="font-mono font-bold text-brand-950">{row.count} pages</span>
                </div>
                <div className="h-2 w-full rounded-full bg-brand-100 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", row.tone)}
                    style={{ width: `${row.count > 0 ? Math.max(4, Math.round((row.count / maxDepthCount) * 100)) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Link Equity: Authority Hubs vs Starved Money Pages */}
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-card space-y-4">
          <div>
            <h3 className="text-sm font-bold text-brand-950">Internal Link Equity &amp; Linking Opportunities</h3>
            <p className="text-[11px] text-brand-500">
              Pass authority from your strongest hubs to buried or low-equity money pages.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-success-700 mb-1.5">
                Top Authority Hubs (Link From Here)
              </p>
              <ul className="space-y-1.5">
                {data.architecture.topAuthorityPages.slice(0, 4).map((p) => (
                  <li
                    key={p.url}
                    className="flex items-center justify-between gap-2 rounded-lg border border-brand-100 bg-surface-2/50 px-3 py-1.5 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => inspectByUrl(p.url)}
                      className="truncate font-mono text-[11px] font-semibold text-brand-900 hover:underline text-left cursor-pointer"
                    >
                      {safePath(p.url)}
                    </button>
                    <span className="shrink-0 rounded bg-success-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-success-700">
                      Equity {p.equity.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {data.architecture.starvedMoneyPages.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-warning-700 mb-1.5">
                  Starved / Deep Money Pages (Link To Here)
                </p>
                <ul className="space-y-1.5">
                  {data.architecture.starvedMoneyPages.slice(0, 4).map((p) => (
                    <li
                      key={p.url}
                      className="flex items-center justify-between gap-2 rounded-lg border border-warning-200/60 bg-warning-50/30 px-3 py-1.5 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => inspectByUrl(p.url)}
                        className="truncate font-mono text-[11px] font-semibold text-brand-900 hover:underline text-left cursor-pointer"
                      >
                        {safePath(p.url)}
                      </button>
                      <span className="shrink-0 inline-flex items-center gap-1 font-mono text-[10px] font-bold text-warning-700">
                        <span>{p.depth != null ? `Depth ${p.depth}` : "Orphan"}</span>
                        <ArrowRight size={10} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Entity Schema Coverage Table */}
      {data.schemaCoverage.length > 0 && (
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-brand-950">Persisted Structured Data (Schema.org)</h3>
              <p className="text-[11px] text-brand-500">
                Verified JSON-LD entity types across your crawled pages.
              </p>
            </div>
            <a
              href={`https://${data.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-500 hover:text-brand-950"
            >
              <span>{data.domain}</span>
              <ExternalLink size={10} />
            </a>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {data.schemaCoverage.map((s) => (
              <div key={s.type} className="rounded-xl border border-brand-200/70 bg-surface-2/50 p-3">
                <p className="font-mono text-[11px] font-bold text-brand-950 truncate">{s.type}</p>
                <p className="mt-1 font-mono text-lg font-black text-brand-950">{s.pageCount}</p>
                <p className="text-[10px] text-brand-500">
                  {s.validCount} valid{s.invalidCount > 0 ? ` · ${s.invalidCount} errors` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
