"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  Trophy,
  Crown,
  FileText,
  Search,
  MoreVertical,
  ArrowRight,
  ShieldCheck,
  Target,
  Compass,
  MessageSquare,
  Code2,
  Sparkles,
  ExternalLink,
  Settings,
  Layers,
  Plus,
  Bot,
} from "lucide-react";
import { AiKpiCard } from "./ai-kpi-card";
import type { VisibilityReport, TrackedCompetitor, CrawlJob } from "@/lib/api-client";
import { assistantList } from "@/lib/ai-assistants";

export interface AiVisibilityCompetitorsTabProps {
  report?: VisibilityReport | null;
  /** The rivals tracked in Competitor Intelligence, with their crawl results. */
  competitors?: TrackedCompetitor[];
  /** The customer's latest Website Audit crawl. */
  ownCrawl?: CrawlJob | null;
  domain?: string;
  onAddCompetitor?: () => void;
  onViewAllGaps?: () => void;
}

const BAR_COLORS = [
  "bg-slate-950",
  "bg-slate-600",
  "bg-slate-400",
  "bg-slate-300",
  "bg-slate-200",
  "bg-slate-700",
];

type ChartMetric = "ai" | "pages" | "health";

interface BenchmarkRow {
  key: string;
  name: string;
  domain: string;
  isYou: boolean;
  /** Tracked in Competitor Intelligence; false for a domain an answer named on its own. */
  tracked: boolean;
  /** Null when nothing has been asked yet — not measured is not 0%. */
  sharePct: number | null;
  mentions: number | null;
  pagesCrawled: number | null;
  healthScore: number | null;
  crawlStatus: string | null;
}

function normalizeDomain(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
}

function isCrawling(status: string | null): boolean {
  return status === "PENDING" || status === "RUNNING" || status === "QUEUED";
}

export function AiVisibilityCompetitorsTab({
  report,
  competitors = [],
  ownCrawl = null,
  domain = "",
  onAddCompetitor,
  onViewAllGaps,
}: AiVisibilityCompetitorsTabProps) {
  const [pickedMetric, setChartMetric] = useState<ChartMetric | null>(null);

  // An empty share of voice means no answer ran in the window.
  const shareOfVoice = useMemo(() => report?.shareOfVoice ?? [], [report?.shareOfVoice]);
  const measured = shareOfVoice.length > 0;
  const totalChecked = report?.summary?.checked ?? 0;
  const totalCitations = report?.summary?.cited ?? 0;

  // One row per brand, joining three sources: the AI answers (share of voice),
  // the Website Audit crawl for the customer, and Competitor Intelligence for
  // each tracked rival. A tracked rival shows up here even when no answer
  // named it or no sweep has run, so this tab and Competitor Intelligence
  // always list the same rivals.
  const rows = useMemo<BenchmarkRow[]>(() => {
    const voiceByDomain = new Map<string, (typeof shareOfVoice)[number]>();
    for (const row of shareOfVoice) {
      if (row.domain !== null) voiceByDomain.set(normalizeDomain(row.domain), row);
    }
    const ownVoice = shareOfVoice.find((row) => row.domain === null) ?? null;
    const ownCrawlDone = ownCrawl?.status === "COMPLETED";

    const result: BenchmarkRow[] = [
      {
        key: "__you__",
        name: domain || "Your website",
        domain,
        isYou: true,
        tracked: true,
        sharePct: measured ? ownVoice?.sharePct ?? 0 : null,
        mentions: measured ? ownVoice?.mentions ?? 0 : null,
        pagesCrawled: ownCrawl ? ownCrawl.pagesCrawled : null,
        healthScore: ownCrawlDone ? ownCrawl?.healthScore ?? null : null,
        crawlStatus: ownCrawl?.status ?? null,
      },
    ];

    const seen = new Set<string>();
    for (const c of competitors) {
      const key = normalizeDomain(c.domain);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const voice = voiceByDomain.get(key);
      const crawlDone = c.crawlStatus === "COMPLETED" || c.status === "ANALYZED";
      result.push({
        key,
        name: c.label || c.name || c.domain,
        domain: c.domain,
        isYou: false,
        tracked: true,
        sharePct: measured ? voice?.sharePct ?? 0 : null,
        mentions: measured ? voice?.mentions ?? 0 : null,
        pagesCrawled: crawlDone || (c.pagesCrawled ?? 0) > 0 ? c.pagesCrawled ?? 0 : null,
        healthScore: crawlDone ? c.healthScore ?? null : null,
        crawlStatus: c.crawlStatus ?? c.status ?? null,
      });
    }

    // Domains an answer named that nobody is tracking yet.
    for (const [key, voice] of voiceByDomain) {
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        key,
        name: voice.label || voice.domain || key,
        domain: voice.domain ?? key,
        isYou: false,
        tracked: false,
        sharePct: voice.sharePct,
        mentions: voice.mentions,
        pagesCrawled: null,
        healthScore: null,
        crawlStatus: null,
      });
    }

    const you = result[0];
    const rivals = result
      .slice(1)
      .sort(
        (a, b) =>
          (b.sharePct ?? -1) - (a.sharePct ?? -1) ||
          Number(b.tracked) - Number(a.tracked) ||
          (b.pagesCrawled ?? -1) - (a.pagesCrawled ?? -1),
      );
    return [you, ...rivals].sort((a, b) => (b.sharePct ?? -1) - (a.sharePct ?? -1));
  }, [shareOfVoice, measured, competitors, ownCrawl, domain]);

  const rivals = rows.filter((r) => !r.isYou);
  const trackedRivals = rivals.filter((r) => r.tracked);
  const you = rows.find((r) => r.isYou) ?? null;
  const yourShare = you?.sharePct ?? null;
  const assistantsAsked = assistantList(report?.measurableAssistants);

  const rivalsOutranking = yourShare === null ? 0 : rivals.filter((r) => (r.sharePct ?? 0) > yourShare).length;
  const namedRivals = rivals.filter((r) => (r.sharePct ?? 0) > 0);
  const topRival = namedRivals[0] ?? null;
  // Until someone picks a metric, open on AI share once any brand was named,
  // and on the crawl comparison while every share is still zero.
  const chartMetric: ChartMetric =
    pickedMetric ?? (rows.some((r) => (r.sharePct ?? 0) > 0) ? "ai" : "pages");

  const leading = topRival
    ? { value: topRival.domain, subtext: `${topRival.sharePct}% citation share, ${topRival.mentions} of ${totalChecked} answers` }
    : trackedRivals.length > 0
    ? {
        value: measured ? "None named" : "Not measured",
        subtext: measured
          ? `${trackedRivals.length} tracked rival${trackedRivals.length === 1 ? "" : "s"} named in 0 of ${totalChecked} answers`
          : "Run AI Analysis to measure your tracked rivals",
      }
    : { value: "None", subtext: "Add rivals to benchmark" };

  const chartItems = useMemo(() => {
    const valueOf = (r: BenchmarkRow) =>
      chartMetric === "ai" ? r.sharePct : chartMetric === "pages" ? r.pagesCrawled : r.healthScore;
    const plotted = rows.filter((r) => r.isYou || r.tracked).slice(0, 6);
    if (plotted.every((r) => valueOf(r) === null)) return [];
    const max = Math.max(1, ...plotted.map((r) => valueOf(r) ?? 0));
    return plotted.map((r, idx) => {
      const value = valueOf(r);
      return {
        key: r.key,
        name: r.isYou ? `${r.domain || "Your website"}\n(You)` : r.domain,
        label:
          value === null
            ? isCrawling(r.crawlStatus) && chartMetric !== "ai"
              ? "Crawling"
              : "—"
            : chartMetric === "ai"
            ? `${value}%`
            : chartMetric === "pages"
            ? `${value}`
            : `${value}/100`,
        color: r.isYou ? "bg-slate-950" : BAR_COLORS[(idx % (BAR_COLORS.length - 1)) + 1],
        heightPct: value === null || value === 0 ? 0 : Math.max(6, Math.min(100, Math.round((value / max) * 90))),
      };
    });
  }, [rows, chartMetric]);

  const chartEmptyText =
    chartMetric === "ai"
      ? "No answers measured yet. Run AI Analysis to compare citation share."
      : "No crawl results yet. Run the Website Audit and add rivals in Competitor Intelligence.";

  return (
    <div className="space-y-6">
      {/* ── ROW 1: 5 KPI Cards (Real Data) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: AI Citation Share */}
        <AiKpiCard
          label="Your Citation Share"
          value={yourShare === null ? "—" : `${yourShare}%`}
          subtext="Share of measured answers that name you"
          icon={<Users size={16} />}
          iconBgColor="bg-slate-100 text-slate-900"
          colorScheme="default"
        />

        {/* KPI 2: Competitors Cited More */}
        <AiKpiCard
          label="Rivals Outranking You"
          value={rivals.length === 0 || yourShare === null ? "—" : `${rivalsOutranking} / ${rivals.length}`}
          subtext={
            rivals.length === 0
              ? "No rivals tracked in Competitor Intelligence"
              : "Competitors with higher recommendation share"
          }
          icon={<Trophy size={16} />}
          iconBgColor="bg-rose-50 text-rose-600"
          colorScheme="coral"
        />

        {/* KPI 3: Top Competitor */}
        <AiKpiCard
          label="Leading Competitor"
          value={leading.value}
          subtext={leading.subtext}
          icon={<Crown size={16} />}
          iconBgColor="bg-amber-50 text-amber-600"
          colorScheme="yellow"
        />

        {/* KPI 4: Total Citations */}
        <AiKpiCard
          label="Total Citations"
          value={totalCitations.toLocaleString()}
          subtext="Direct brand mentions across tested queries"
          icon={<FileText size={16} />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          colorScheme="emerald"
        />

        {/* KPI 5: Tested Prompts */}
        <AiKpiCard
          label="Queries Evaluated"
          value={totalChecked.toString()}
          subtext={`Answers from ${assistantsAsked}`}
          icon={<Target size={16} />}
          iconBgColor="bg-blue-50 text-blue-600"
          colorScheme="blue"
        />
      </div>

      {/* ── ROW 2: Bar Chart Comparison + Strategic Recommendations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bar Chart (Col span 7) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">You vs Tracked Rivals</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {chartMetric === "ai"
                    ? `Share of ${assistantsAsked} answers that name each brand`
                    : chartMetric === "pages"
                    ? "Pages crawled by Website Audit and Competitor Intelligence"
                    : "SEO health score from the latest crawl"}
                </p>
              </div>

              <div className="flex items-center gap-1 p-0.5 rounded-lg border bg-brand-50 text-[11px] font-semibold">
                {(
                  [
                    { id: "ai", label: "AI Share" },
                    { id: "pages", label: "Pages" },
                    { id: "health", label: "SEO Health" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setChartMetric(m.id)}
                    className={`px-2 py-1 rounded-md ${chartMetric === m.id ? "bg-white text-brand-950 shadow-2xs" : "text-brand-500"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bars */}
            <div className="my-6 min-h-52 flex items-end justify-around gap-4 px-4 pb-2 border-b border-slate-100">
              {chartItems.length === 0 ? (
                <div className="w-full text-center py-12 text-brand-400 text-xs">{chartEmptyText}</div>
              ) : (
                chartItems.map((bar) => (
                  <div key={bar.key} className="flex flex-col items-center gap-2 flex-1 max-w-[80px]">
                    <span className="text-xs font-bold text-slate-700">{bar.label}</span>
                    <div className="w-full h-36 flex items-end justify-center bg-slate-50 rounded-lg p-1">
                      <div
                        className={`w-full ${bar.color} rounded-t-md transition-all duration-500`}
                        style={{ height: `${bar.heightPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight whitespace-pre-line truncate max-w-full">
                      {bar.name}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
            <span>
              {trackedRivals.length} rival{trackedRivals.length === 1 ? "" : "s"} from Competitor Intelligence
            </span>
            <button
              type="button"
              onClick={onAddCompetitor}
              className="text-slate-900 font-semibold hover:underline flex items-center gap-1"
            >
              <Plus size={12} /> Add Rival
            </button>
          </div>
        </div>

        {/* Strategic Next Steps (Col span 5) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">AI Conquesting Actions</h3>
                  <p className="text-[11px] text-slate-400">Tactics to overtake rival citations</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 text-xs space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Target size={14} className="text-slate-900" />
                  Target Rival Comparison Intent
                </span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Publish authoritative objective comparison pages and JSON-LD FAQ schemas targeting prompts where rivals currently dominate.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 text-xs space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Code2 size={14} className="text-blue-600" />
                  Deploy Structured AEO Entities
                </span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Large language models heavily weight schema markup (Organization, Product, SoftwareApplication) when determining authoritative answers.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 text-xs space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-emerald-600" />
                  Answer Engine Optimization (AEO)
                </span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Structure your page headers with direct, concise 50-word answers directly below H2 questions to feed snippet extraction.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewAllGaps}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-black text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <span>View All Competitor Gaps</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* ── ROW 3: Benchmarking Table ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">LLM Benchmarking Leaderboard</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              AI share of voice across {assistantsAsked}, joined to Website Audit and Competitor Intelligence crawls
            </p>
          </div>
          <span className="text-xs text-slate-400 font-semibold">
            {rows.length} domains analyzed
          </span>
        </div>

        {rivals.length === 0 && !measured ? (
          <div className="p-8 text-center space-y-2 border rounded-xl border-dashed border-slate-200 bg-slate-50/50">
            <Bot className="h-6 w-6 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-800">No Benchmarked Competitors Yet</p>
            <p className="text-[11px] text-slate-500">
              Add rivals here or in Competitor Intelligence to compare citations, pages crawled and SEO health.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 w-14 font-bold">Rank</th>
                  <th className="p-3.5 font-bold">Domain / Brand</th>
                  <th className="p-3.5 font-bold">Recommendation Share</th>
                  <th className="p-3.5 font-bold">AI Mentions</th>
                  <th className="p-3.5 font-bold">Pages Crawled</th>
                  <th className="p-3.5 font-bold">SEO Health</th>
                  <th className="p-3.5 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr
                    key={row.key}
                    className={`hover:bg-slate-50/80 transition-colors ${row.isYou ? "bg-slate-50" : ""}`}
                  >
                    <td className="p-3.5 font-bold text-slate-900">#{idx + 1}</td>
                    <td className="p-3.5 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <span>{row.isYou ? row.domain || "Your website" : row.name}</span>
                          {!row.isYou && row.name !== row.domain && (
                            <span className="text-[10.5px] font-normal text-brand-400">{row.domain}</span>
                          )}
                        </div>
                        {row.isYou && (
                          <span className="bg-slate-100 text-slate-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            Your Domain
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 w-10">
                          {row.sharePct === null ? "—" : `${row.sharePct}%`}
                        </span>
                        <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${row.isYou ? "bg-slate-950" : "bg-slate-400"} rounded-full`}
                            style={{ width: `${row.sharePct ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-700">
                      {row.mentions === null ? "—" : `${row.mentions} of ${totalChecked}`}
                    </td>
                    <td className="p-3.5 font-mono text-brand-700">
                      {row.pagesCrawled !== null
                        ? row.pagesCrawled.toLocaleString()
                        : isCrawling(row.crawlStatus)
                        ? "Crawling…"
                        : "—"}
                    </td>
                    <td className="p-3.5 font-mono text-brand-700">
                      {row.healthScore !== null ? `${row.healthScore}/100` : "—"}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="text-[11px] font-medium text-slate-500">
                        {row.isYou ? "Primary Site" : row.tracked ? "Tracked Rival" : "Named by AI, not tracked"}
                      </span>
                    </td>
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
