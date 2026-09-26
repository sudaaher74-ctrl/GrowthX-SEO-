"use client";

import { useMemo, useState } from "react";
import { PlanModal } from "@/components/competitor/plan-modal";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  ExternalLink,
  Loader2,
  FileText,
  LayoutGrid,
  Layers,
  HelpCircle,
  Code2,
  BookOpen,
  Compass,
  Building2,
  SlidersHorizontal,
  Globe,
} from "lucide-react";
import { useProgrammaticMatrix } from "@/hooks/use-growthx";
import { api, type TrackedCompetitor } from "@/lib/api-client";
import { buildGapItems, buildGapPlan, type GapItem, type GapKind } from "@/lib/gaps-plain";
import { stagingEngine } from "@/lib/staging-engine";

interface SectionTheme {
  icon: typeof FileText;
  badge: string;
  badgeClass: string;
  headerBg: string;
  accentBar: string;
}

const SECTION_THEMES: Record<GapKind, SectionTheme> = {
  topic: {
    icon: FileText,
    badge: "Missing Pages",
    badgeClass: "bg-error-50 text-error-700 border-error-200",
    headerBg: "from-error-50/40 via-white to-surface-1",
    accentBar: "bg-error-500",
  },
  pageType: {
    icon: LayoutGrid,
    badge: "Page Architecture",
    badgeClass: "bg-accent-50 text-accent-700 border-accent-200",
    headerBg: "from-accent-50/40 via-white to-surface-1",
    accentBar: "bg-accent-500",
  },
  series: {
    icon: Layers,
    badge: "Programmatic Sets",
    badgeClass: "bg-series-6/10 text-series-6 border-series-6/20",
    headerBg: "from-brand-50 via-white to-surface-1",
    accentBar: "bg-series-6",
  },
  question: {
    icon: HelpCircle,
    badge: "AI & Search Answers",
    badgeClass: "bg-warning-50 text-warning-700 border-warning-200",
    headerBg: "from-warning-50/40 via-white to-surface-1",
    accentBar: "bg-warning-500",
  },
  schema: {
    icon: Code2,
    badge: "Rich SERP Snippets",
    badgeClass: "bg-success-50 text-success-700 border-success-200",
    headerBg: "from-success-50/40 via-white to-surface-1",
    accentBar: "bg-success-500",
  },
  depth: {
    icon: BookOpen,
    badge: "Content Depth",
    badgeClass: "bg-series-2/10 text-series-2 border-series-2/20",
    headerBg: "from-accent-50/30 via-white to-surface-1",
    accentBar: "bg-series-2",
  },
};

const SECTIONS: Array<{ kind: GapKind; title: string; explain: string }> = [
  {
    kind: "topic",
    title: "Topics they have a page for, and you don't",
    explain: "When someone searches for one of these, Google can show your competitor's page. It can't show yours, because you don't have one yet.",
  },
  {
    kind: "pageType",
    title: "Kinds of pages they have more of",
    explain: "More pages of the right kind means more searches they can show up for.",
  },
  {
    kind: "series",
    title: "Sets of similar pages they publish",
    explain: "Some competitors make a whole family of pages from one idea, for example one page per city or one per comparison.",
  },
  {
    kind: "question",
    title: "Customer questions they answer",
    explain: "Google and AI assistants like ChatGPT answer people's questions using websites that answer them clearly.",
  },
  {
    kind: "schema",
    title: "Extra details they give Google",
    explain: "Hidden labels on a page that tell Google things like star ratings, prices or opening hours, so it can show them in search results.",
  },
  {
    kind: "depth",
    title: "How detailed their pages are",
    explain: "Google prefers the page that answers a visitor's questions most completely.",
  },
];

const SHOWN_PER_SECTION = 6;

const safeUrl = (url: string) => (/^https?:\/\//.test(url) ? url : undefined);

function GapMetricCard({
  label,
  value,
  sub,
  tag,
  icon: Icon,
  variant,
}: {
  label: string;
  value: string;
  sub: string;
  tag: string;
  icon: typeof FileText;
  variant: "error" | "accent" | "warning" | "success";
}) {
  const styles = {
    error: {
      border: "border-error-200/80 hover:border-error-300",
      topBar: "bg-error-500",
      iconBg: "bg-error-50 text-error-600 border-error-200",
      numColor: "text-error-600",
      tagClass: "bg-error-50 text-error-700 border-error-200",
    },
    accent: {
      border: "border-accent-200/80 hover:border-accent-300",
      topBar: "bg-accent-500",
      iconBg: "bg-accent-50 text-accent-600 border-accent-200",
      numColor: "text-accent-700",
      tagClass: "bg-accent-50 text-accent-700 border-accent-200",
    },
    warning: {
      border: "border-warning-200/80 hover:border-warning-300",
      topBar: "bg-warning-500",
      iconBg: "bg-warning-50 text-warning-700 border-warning-200",
      numColor: "text-warning-700",
      tagClass: "bg-warning-50 text-warning-700 border-warning-200",
    },
    success: {
      border: "border-success-200/80 hover:border-success-300",
      topBar: "bg-success-500",
      iconBg: "bg-success-50 text-success-700 border-success-200",
      numColor: "text-success-700",
      tagClass: "bg-success-50 text-success-700 border-success-200",
    },
  }[variant];

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-white p-4 shadow-2xs transition-all hover:shadow-xs ${styles.border}`}
    >
      <div className={`absolute top-0 inset-x-0 h-1 ${styles.topBar}`} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-brand-500">{label}</p>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${styles.iconBg}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-2xl font-bold tracking-tight ${styles.numColor}`}>{value}</span>
        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${styles.tagClass}`}>
          {tag}
        </span>
      </div>
      <p className="mt-1 text-[11.5px] text-brand-500">{sub}</p>
    </div>
  );
}

/**
 * What competitors have that you don't, in plain words.
 *
 * Shows actionable gap categories with vivid visual hierarchy, color-coded
 * status tags, and distinctive primary action buttons for generating plans.
 */
export function GapsTab({
  projectId,
  domain,
  competitors,
  onOpenCounterMoves,
}: {
  projectId: string;
  domain: string;
  competitors: TrackedCompetitor[];
  onOpenCounterMoves: () => void;
}) {
  const [rivalFilter, setRivalFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<GapKind>>(new Set());
  const [planFor, setPlanFor] = useState<GapItem | null>(null);

  const facts = useQuery({
    queryKey: ["rival-advantages", projectId],
    queryFn: () => api.getRivalAdvantages(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });
  const series = useProgrammaticMatrix(projectId);

  const rivals = useMemo(() => facts.data?.rivals ?? [], [facts.data]);
  const items = useMemo(() => buildGapItems(rivals, series.data?.clusters ?? []), [rivals, series.data]);
  const shown = rivalFilter === "all" ? items : items.filter((i) => i.rivalDomain === rivalFilter);
  const waiting = rivals.filter((r) => !r.advantages).map((r) => r.name);

  const count = (kind: GapKind) => shown.filter((i) => i.kind === kind).length;
  const topicsMissing = rivals
    .filter((r) => rivalFilter === "all" || r.domain === rivalFilter)
    .reduce((n, r) => n + (r.advantages?.missingTopicsTotal ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* ── TOP BRIEFING & STRATEGY BOX ── */}
      <div className="rounded-2xl border border-accent-200/80 bg-gradient-to-br from-accent-50/50 via-white to-surface-1 p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-600 text-white shadow-xs">
              <Compass size={20} />
            </div>
            <div>
              <h1 className="text-[17px] font-bold text-brand-950 tracking-[-0.01em]">
                What your competitors have that you don&apos;t
              </h1>
              <p className="mt-0.5 text-[12.5px] text-brand-600">
                We read every page of your website and your competitors&apos; websites. Below is everything they offer that your website doesn&apos;t have yet.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 self-start sm:self-center px-3 py-1 rounded-full text-xs font-bold bg-accent-100 text-accent-700 border border-accent-200 shrink-0">
            <Sparkles size={12} className="text-accent-600" />
            <span>AI Competitive Intelligence</span>
          </div>
        </div>

        {/* 3 Step Walkthrough */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-xl border border-accent-200/80 bg-white/95 p-3.5 shadow-2xs transition-all hover:border-accent-300">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-600 text-[11px] font-bold text-white shadow-xs">
              1
            </span>
            <div>
              <p className="text-[12px] font-bold text-accent-700">1. Review Opportunities</p>
              <p className="mt-0.5 text-[11.5px] text-brand-600 leading-snug">
                Look through the list. Highest-impact gaps are ranked at the top of each category.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-warning-200/80 bg-white/95 p-3.5 shadow-2xs transition-all hover:border-warning-300">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning-600 text-[11px] font-bold text-white shadow-xs">
              2
            </span>
            <div>
              <p className="text-[12px] font-bold text-warning-700">2. Generate Action Plan</p>
              <p className="mt-0.5 text-[11.5px] text-brand-600 leading-snug">
                Click <span className="font-semibold text-accent-700">&quot;Get a plan&quot;</span> on anything you want to target. You get ready-to-use prompts and structure.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-success-200/80 bg-white/95 p-3.5 shadow-2xs transition-all hover:border-success-300">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-600 text-[11px] font-bold text-white shadow-xs">
              3
            </span>
            <div>
              <p className="text-[12px] font-bold text-success-700">3. Outrank &amp; Capture Traffic</p>
              <p className="mt-0.5 text-[11.5px] text-brand-600 leading-snug">
                Publish the content or send the plan straight to your web team to claim the search traffic.
              </p>
            </div>
          </div>
        </div>

        {/* Competitor Filter Bar */}
        {competitors.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-accent-200/60 pt-3">
            <span className="flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-wider text-brand-500">
              <SlidersHorizontal size={12} className="text-accent-600" />
              Filter by Rival:
            </span>
            {[{ domain: "all", name: "All competitors" }, ...rivals].map((r) => {
              const isSelected = rivalFilter === r.domain;
              return (
                <button
                  key={r.domain}
                  type="button"
                  onClick={() => setRivalFilter(r.domain)}
                  aria-pressed={isSelected}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-all ${
                    isSelected
                      ? "border-accent-600 bg-accent-600 text-white shadow-xs scale-[1.02]"
                      : "border-line bg-white text-brand-700 hover:border-accent-300 hover:bg-accent-50/40 hover:text-accent-700"
                  }`}
                >
                  {r.domain === "all" ? (
                    <Layers size={11} className={isSelected ? "text-white" : "text-brand-400"} />
                  ) : (
                    <Building2 size={11} className={isSelected ? "text-white" : "text-brand-400"} />
                  )}
                  {r.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {facts.isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-accent-200/70 bg-accent-50/30 p-8 shadow-xs">
          <Loader2 size={24} className="animate-spin text-accent-600" />
          <p className="text-[13px] font-semibold text-brand-700">Comparing your website with your competitors…</p>
        </div>
      ) : facts.error ? (
        <div className="rounded-2xl border border-error-200 bg-error-50/50 p-6 text-center shadow-xs">
          <p className="text-[13px] font-semibold text-error-700">
            Couldn&apos;t load the comparison: {(facts.error as Error).message}
          </p>
        </div>
      ) : !facts.data?.you?.crawledAt ? (
        <div className="rounded-2xl border border-warning-200 bg-warning-50/50 p-6 text-center shadow-xs">
          <p className="text-[13px] text-brand-700">
            We haven&apos;t read your website yet. Click <span className="font-bold text-accent-700">Run audit</span> at the top, then come back here.
          </p>
        </div>
      ) : (
        <>
          {/* ── KPI HIGHLIGHT CARDS ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <GapMetricCard
              label="Topics you're missing"
              value={String(topicsMissing)}
              sub="pages they have, you don't"
              tag="High Impact"
              icon={FileText}
              variant="error"
            />
            <GapMetricCard
              label="Kinds of pages behind"
              value={String(count("pageType"))}
              sub="e.g. city or service pages"
              tag="Structure"
              icon={LayoutGrid}
              variant="accent"
            />
            <GapMetricCard
              label="Question gaps"
              value={String(count("question"))}
              sub="competitors answering more questions"
              tag="AI Search"
              icon={HelpCircle}
              variant="warning"
            />
            <GapMetricCard
              label="Google extras missing"
              value={String(count("schema"))}
              sub="ratings, prices, FAQs, schema"
              tag="Schema"
              icon={Code2}
              variant="success"
            />
          </div>

          {waiting.length > 0 && (
            <div className="flex items-center gap-2.5 rounded-xl border border-accent-200/80 bg-accent-50/50 p-3.5 text-[12px] text-accent-700 shadow-2xs">
              <Loader2 size={14} className="animate-spin text-accent-600 shrink-0" />
              <span>
                Still reading {waiting.join(", ")}&apos;s website. Their gaps will appear here once that finishes.
              </span>
            </div>
          )}

          {shown.length === 0 && waiting.length === 0 && (
            <div className="rounded-2xl border border-success-200 bg-success-50/40 p-8 text-center shadow-xs">
              <p className="text-[13px] font-semibold text-success-700">
                Good news: we found nothing your competitors have that you don&apos;t.
              </p>
            </div>
          )}

          {/* ── GAP CATEGORY SECTIONS ── */}
          {SECTIONS.map((section) => {
            const list = shown.filter((i) => i.kind === section.kind);
            if (!list.length) return null;
            const theme = SECTION_THEMES[section.kind] || SECTION_THEMES.topic;
            const Icon = theme.icon;
            const open = expanded.has(section.kind);
            const visible = open ? list : list.slice(0, SHOWN_PER_SECTION);

            return (
              <div
                key={section.kind}
                className="overflow-hidden rounded-2xl border border-line bg-white shadow-2xs transition-all"
              >
                {/* Section Header with dynamic color tint */}
                <div className={`flex flex-col gap-2 border-b border-line bg-gradient-to-r ${theme.headerBg} p-4 sm:flex-row sm:items-center sm:justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${theme.badgeClass} shadow-2xs`}>
                      <Icon size={17} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[14px] font-bold text-brand-950">{section.title}</h2>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${theme.badgeClass}`}>
                          {list.length}
                        </span>
                        <span className={`hidden sm:inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-semibold ${theme.badgeClass}`}>
                          {theme.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] text-brand-500">{section.explain}</p>
                    </div>
                  </div>
                </div>

                {/* Gap List */}
                <div className="p-4">
                  <ul className="space-y-2.5">
                    {visible.map((item) => (
                      <GapRow
                        key={item.id}
                        item={item}
                        showRival={rivalFilter === "all"}
                        accentBarClass={theme.accentBar}
                        onPlan={() => setPlanFor(item)}
                      />
                    ))}
                  </ul>
                  {list.length > SHOWN_PER_SECTION && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (open) next.delete(section.kind);
                          else next.add(section.kind);
                          return next;
                        })
                      }
                      className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg border border-accent-200 bg-accent-50/60 px-3.5 py-1.5 text-[12px] font-bold text-accent-700 hover:bg-accent-100 transition-colors shadow-2xs"
                    >
                      {open ? "Show fewer" : `Show all ${list.length} opportunities`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {planFor && (
        <PlanModal
          subtitle={`${planFor.rival} · ${planFor.headline}`}
          why={planFor.why}
          steps={planFor.steps}
          plan={buildGapPlan(planFor, { domain })}
          onClose={() => setPlanFor(null)}
          onSave={(plan) => {
            stagingEngine.stage(projectId, {
              title: planFor.headline,
              category: "Competitor Intelligence",
              source: "COMPETITOR_CONTENT",
              priority: planFor.kind === "topic" || planFor.kind === "pageType" ? "HIGH" : "MEDIUM",
              impact: planFor.why,
              effortHours: 2,
              deliverable: plan,
              evidence: `${planFor.rival} · counted from both websites`,
            });
            setPlanFor(null);
            onOpenCounterMoves();
          }}
        />
      )}
    </div>
  );
}

function GapRow({
  item,
  showRival,
  accentBarClass,
  onPlan,
}: {
  item: GapItem;
  showRival: boolean;
  accentBarClass: string;
  onPlan: () => void;
}) {
  const href = item.example ? safeUrl(item.example.url) : undefined;
  return (
    <li className="group relative flex flex-col justify-between gap-3 overflow-hidden rounded-xl border border-line bg-white p-3.5 pl-4 shadow-2xs transition-all hover:border-accent-300 hover:bg-accent-50/15 hover:shadow-xs md:flex-row md:items-center">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentBarClass}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-bold text-brand-950 leading-snug group-hover:text-accent-700 transition-colors">
            {item.headline}
          </p>
          {showRival && (
            <span className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
              <Globe size={11} className="text-brand-500" />
              {item.rival}
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] text-brand-600 leading-relaxed">{item.why}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5 pt-1 md:pt-0">
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-accent-200/70 bg-accent-50/50 px-2.5 py-1.5 text-[11.5px] font-semibold text-accent-700 hover:bg-accent-100 transition-colors"
          >
            <span>{item.example!.label}</span>
            <ExternalLink size={11} />
          </a>
        )}
        <button
          type="button"
          onClick={onPlan}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3.5 py-1.5 text-[12px] font-bold text-white shadow-xs transition-all hover:bg-accent-700 active:scale-[0.98]"
        >
          <Sparkles size={13} className="text-accent-200" />
          <span>Get a plan</span>
        </button>
      </div>
    </li>
  );
}
