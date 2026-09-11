"use client";

import React, { useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Sparkles,
  ExternalLink,
  Bot,
  Lightbulb,
  ArrowRight,
  TrendingUp,
  FileText,
  Layers,
  Search,
  Check,
} from "lucide-react";
import { AiCouncilRoundtable } from "./ai-council-roundtable";
import { SpecializedEnginesPanel } from "./specialized-engines-panel";
import type { TrackedPromptRow, VisibilityReport } from "@/lib/api-client";

// ── 1. AI Insights Tab ──────────────────────────────────────────────────────────
export function AiInsightsTabContent({
  projectId,
  domain,
  businessName,
}: {
  projectId: string;
  domain?: string;
  businessName?: string;
}) {
  return (
    <div className="space-y-6">
      <AiCouncilRoundtable
        projectId={projectId}
        domain={domain}
        businessName={businessName}
      />
      <SpecializedEnginesPanel
        projectId={projectId}
        domain={domain}
        businessName={businessName}
      />
    </div>
  );
}

// ── 2. Citations Tab ───────────────────────────────────────────────────────────
export function CitationsTabContent({
  promptList,
  report,
  onAddQuery,
}: {
  promptList: TrackedPromptRow[];
  report?: VisibilityReport | null;
  onAddQuery: () => void;
}) {
  const citedSources = useMemo(() => {
    const domainMap = new Map<string, { count: number; models: Set<string> }>();

    promptList.forEach((p) => {
      p.latestChecks?.forEach((check) => {
        const assistant = check.assistant || "AI";
        if (check.citedUrl) {
          try {
            const host = new URL(check.citedUrl).hostname.replace(/^www\./, "");
            if (!domainMap.has(host)) domainMap.set(host, { count: 0, models: new Set() });
            const item = domainMap.get(host)!;
            item.count += 1;
            item.models.add(assistant);
          } catch {
            // raw
          }
        }
        check.competitorsCited?.forEach((c) => {
          const clean = c.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
          if (!domainMap.has(clean)) domainMap.set(clean, { count: 0, models: new Set() });
          const item = domainMap.get(clean)!;
          item.count += 1;
          item.models.add(assistant);
        });
      });
    });

    report?.shareOfVoice?.forEach((s) => {
      const d = s.domain || s.label;
      if (d && !domainMap.has(d)) {
        domainMap.set(d, { count: s.mentions || 1, models: new Set(["AI Engine"]) });
      }
    });

    return Array.from(domainMap.entries())
      .map(([domain, data]) => ({
        domain,
        citations: data.count,
        category: domain.endsWith(".org") || domain.endsWith(".edu") ? "Authority / Knowledge" : "Industry Publication",
        trust: data.count > 5 ? "High" : "Standard",
        models: Array.from(data.models),
      }))
      .sort((a, b) => b.citations - a.citations);
  }, [promptList, report?.shareOfVoice]);

  return (
    <div className="space-y-6">
      {/* Top Source Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Mentioned Sources</span>
          <p className="mt-2 text-[26px] font-bold text-slate-900">{citedSources.length} Domains</p>
          <p className="mt-1 text-[11.5px] text-slate-500">Across {promptList.length} tracked high-intent search queries</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Primary Citation Format</span>
          <p className="mt-2 text-[26px] font-bold text-indigo-600">
            {promptList.length > 0 ? "Direct Answer & Comparison" : "Pending Sweep"}
          </p>
          <p className="mt-1 text-[11.5px] text-slate-500">Synthesized by ChatGPT, Claude, and Gemini</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Brand Citation Status</span>
          <p className="mt-2 text-[26px] font-bold text-emerald-600">
            {report?.summary?.cited && report.summary.cited > 0 ? `${report.summary.cited} Citations` : "Pending Sweep"}
          </p>
          <p className="mt-1 text-[11.5px] text-slate-500">Verified citations across multi-model checks</p>
        </div>
      </div>

      {/* Authoritative Cited Sources Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-[14.5px] font-bold text-slate-900">Top Sources Cited by AI Models</h3>
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              Domains cited by ChatGPT, Claude, and Gemini when answering questions in your niche.
            </p>
          </div>
        </div>

        {citedSources.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No citation sources detected yet. Run an AI visibility sweep to collect live source domains.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
                  <th className="py-2.5 pl-2 font-medium">Source Domain</th>
                  <th className="py-2.5 font-medium">Category</th>
                  <th className="py-2.5 font-medium">Citations</th>
                  <th className="py-2.5 font-medium">Authority Level</th>
                  <th className="py-2.5 pr-2 font-medium">Active In Engines</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70">
                {citedSources.map((source) => (
                  <tr key={source.domain} className="hover:bg-slate-50/70">
                    <td className="py-3 pl-2 font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{source.domain}</span>
                      <ExternalLink size={11} className="text-slate-400" />
                    </td>
                    <td className="py-3 text-slate-600">{source.category}</td>
                    <td className="py-3 font-bold text-slate-900">{source.citations}</td>
                    <td className="py-3">
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 border border-emerald-200/60">
                        {source.trust} Trust
                      </span>
                    </td>
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-1.5">
                        {source.models.map((m) => (
                          <span key={m} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tracked Brand Queries Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-[14.5px] font-bold text-slate-900">Tracked Brand Queries &amp; Engine Citations</h3>
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              Specific buyer intent queries evaluated against each generative engine.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddQuery}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            + Add Query
          </button>
        </div>

        {promptList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No queries configured yet. Click &quot;+ Add Query&quot; above to begin monitoring.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
                  <th className="py-2.5 pl-2 font-medium">Tracked Buyer Query</th>
                  <th className="py-2.5 font-medium">Cluster / Intent</th>
                  <th className="py-2.5 font-medium">Est. Volume</th>
                  <th className="py-2.5 font-medium">ChatGPT</th>
                  <th className="py-2.5 font-medium">Claude</th>
                  <th className="py-2.5 pr-2 font-medium">Gemini</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70">
                {promptList.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pl-2 font-semibold text-slate-900">{row.text}</td>
                    <td className="py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-700">
                        {row.cluster || "buyer intent"}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-500">
                      {row.estimatedVolume ? row.estimatedVolume.toLocaleString() : "—"}
                    </td>
                    {(["CHATGPT", "CLAUDE", "GEMINI"] as const).map((assistant) => {
                      const check = row.latestChecks?.find((c) => c.assistant === assistant);
                      return (
                        <td key={assistant} className="py-3">
                          {check ? (
                            check.cited ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                                <CheckCircle2 size={12} className="text-emerald-500" />
                                <span>Cited</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-700 font-semibold text-[11px] bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/50">
                                <XCircle size={12} className="text-rose-500" />
                                <span>Miss</span>
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                              <MinusCircle size={12} />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 3. Content Gaps Tab ────────────────────────────────────────────────────────
export function ContentGapsTabContent({
  onAddQuery,
}: {
  onAddQuery: () => void;
}) {
  const contentGaps = [
    { topic: "Automated SEO Audit Software", searchVol: "14.2K", competitor: "Semrush", rank: 1, gapScore: 94, reason: "Competitors have extensive landing pages with interactive checklists and teardowns." },
    { topic: "Core Web Vitals Code Fix Platform", searchVol: "8.6K", competitor: "Ahrefs", rank: 2, gapScore: 89, reason: "Cited for automated LCP/INP script injection recipes that your docs don't yet feature." },
    { topic: "Programmatic SEO Indexing Tool", searchVol: "6.1K", competitor: "Moz", rank: 1, gapScore: 82, reason: "Moz beginner guides dominate introductory queries about programmatic sitemaps." },
    { topic: "AI Overviews vs Organic Search", searchVol: "5.4K", competitor: "Semrush", rank: 1, gapScore: 78, reason: "High-volume definition queries default to Semrush's authoritative research whitepaper." },
    { topic: "Real-time Website Crawler API", searchVol: "4.8K", competitor: "Screaming Frog", rank: 1, gapScore: 75, reason: "Developer queries cite Screaming Frog CLI documentation and log analysis guides." },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-[14.5px] font-bold text-slate-900">AI Model Content Gaps</h3>
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              High-value topics where AI models cite your competitors instead of your domain.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddQuery}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            + Add Target Topic
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
                <th className="py-2.5 pl-2 font-medium">Topic / Opportunity</th>
                <th className="py-2.5 font-medium">Search Volume</th>
                <th className="py-2.5 font-medium">Top Cited Competitor</th>
                <th className="py-2.5 font-medium">Gap Score</th>
                <th className="py-2.5 pr-2 font-medium">Why They Are Cited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70">
              {contentGaps.map((item) => (
                <tr key={item.topic} className="hover:bg-slate-50/70">
                  <td className="py-3.5 pl-2 font-bold text-slate-900 max-w-[200px] truncate">
                    {item.topic}
                  </td>
                  <td className="py-3.5 font-mono text-slate-600">{item.searchVol}</td>
                  <td className="py-3.5">
                    <span className="font-semibold text-slate-800">{item.competitor}</span>
                  </td>
                  <td className="py-3.5">
                    <span className="inline-block rounded-md bg-rose-50 px-2 py-0.5 text-[10.5px] font-bold text-rose-700 border border-rose-200">
                      {item.gapScore}/100
                    </span>
                  </td>
                  <td className="py-3.5 pr-2 text-slate-500 text-[11.5px] max-w-sm">
                    {item.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 4. Recommendations Tab ───────────────────────────────────────────────────
export function RecommendationsTabContent({
  domain,
}: {
  domain?: string;
}) {
  const recommendations = [
    {
      pillar: "Pillar 1: Quotable Definition Blocks",
      impact: "High Impact (+18% Citations)",
      timeframe: "1-2 Weeks",
      title: "Add authoritative 40-word definition snippets to key product pages",
      description:
        "ChatGPT and Gemini preferentially quote direct, declarative definitions (e.g. 'Aiva is an autonomous SEO platform that...') located in semantic <section> blocks.",
      actionLabel: "Generate Snippets",
    },
    {
      pillar: "Pillar 2: Direct Comparison Teardowns",
      impact: "High Impact (+24% Share of Voice)",
      timeframe: "2-3 Weeks",
      title: "Publish dedicated vs. competitor comparison teardowns",
      description:
        "When buyers ask 'Aiva vs Semrush for technical audits', AI engines search for unbiased feature matrices and pricing side-by-sides with structured FAQ schema.",
      actionLabel: "View Competitor Gaps",
    },
    {
      pillar: "Pillar 3: Schema & Authoritativeness Signals",
      impact: "Medium Impact (+12% Mentions)",
      timeframe: "3-4 Days",
      title: "Enrich Organization & SoftwareApplication JSON-LD schema",
      description:
        "Explicitly define author, aggregateRating, operatingSystem, and applicationCategory to reinforce entity resolution across knowledge graphs.",
      actionLabel: "Inject Schema",
    },
  ];

  return (
    <div className="space-y-4">
      {recommendations.map((rec, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-purple-700">
              {rec.pillar}
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-700 border border-emerald-200/60">
                {rec.impact}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-600">
                {rec.timeframe}
              </span>
            </div>
          </div>

          <h4 className="mt-2 text-[15px] font-bold text-slate-900">{rec.title}</h4>
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600 max-w-3xl">
            {rec.description}
          </p>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Targeting Claude, ChatGPT, and Gemini</span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-3.5 py-1.5 text-[11.5px] font-semibold hover:bg-slate-800 transition-colors shadow-2xs"
            >
              <span>{rec.actionLabel}</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
