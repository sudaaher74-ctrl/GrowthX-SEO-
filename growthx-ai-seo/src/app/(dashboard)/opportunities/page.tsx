"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  RefreshCw,
  Check,
  X,
  ChevronDown,
  Target,
  Sparkles,
  Search,
  FileText,
  MapPin,
  Cpu,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { ActionButton, PageHeader } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api, type GrowthOpportunity } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

const FILTERS = [
  { label: "All", value: undefined, icon: Target },
  { label: "SEO", value: "SEO", icon: Search },
  { label: "Content", value: "CONTENT", icon: FileText },
  { label: "Local", value: "LOCAL", icon: MapPin },
  { label: "Technical", value: "TECHNICAL", icon: Cpu },
  { label: "Business", value: "BUSINESS", icon: TrendingUp },
] as const;

/** Where a finding came from, so the reader can weigh it without opening it. */
const SOURCE_LABEL: Record<string, string> = {
  SEARCH_CONSOLE: "Search Console",
  COMPETITOR: "Competitor",
  WEBSITE: "Site Audit",
  ANALYTICS: "Analytics",
  LOCAL: "Local SEO",
  MARKET: "Market Intel",
};

const CATEGORY_TONE: Record<string, string> = {
  SEO: "bg-blue-50 text-blue-700 border-blue-200",
  CONTENT: "bg-purple-50 text-purple-700 border-purple-200",
  LOCAL: "bg-amber-50 text-amber-700 border-amber-200",
  TECHNICAL: "bg-emerald-50 text-emerald-700 border-emerald-200",
  BUSINESS: "bg-rose-50 text-rose-700 border-rose-200",
};

const BAND_TONE: Record<string, string> = {
  HIGH: "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200 font-medium",
  LOW: "bg-slate-50 text-slate-600 border-slate-200 font-normal",
};

function OpportunitiesClient() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const hasAutoTriggered = useRef(false);

  const list = useQuery({
    queryKey: ["opportunities", projectId, category],
    queryFn: () => api.opportunities(projectId!, { category }),
    enabled: !!projectId,
  });

  const detect = useMutation({
    mutationFn: () => api.detectOpportunities(projectId!),
    onSuccess: (res) => {
      setError(null);
      setSuccessBanner(
        `Analysis complete! Found ${res.detected} opportunity${res.detected === 1 ? "" : "ies"} across your website, search, local, and competitor data.`,
      );
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      setTimeout(() => setSuccessBanner(null), 6000);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIONED" | "DISMISSED" }) =>
      api.setOpportunityStatus(projectId!, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities"] }),
    onError: (err) => setError(errorMessage(err)),
  });

  // Auto-run baseline detection once if the project currently has 0 opportunities
  useEffect(() => {
    if (
      projectId &&
      !list.isLoading &&
      list.data?.total === 0 &&
      !hasAutoTriggered.current &&
      !detect.isPending
    ) {
      hasAutoTriggered.current = true;
      detect.mutate();
    }
  }, [projectId, list.isLoading, list.data?.total, detect]);

  if (!projectId) {
    return <div className="flex h-40 items-center justify-center text-sm text-brand-500">Select a project.</div>;
  }

  const data = list.data;
  const high = data?.opportunities.filter((o) => o.potential === "HIGH") ?? [];
  const rest = data?.opportunities.filter((o) => o.potential !== "HIGH") ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Growth Opportunities"
        subtitle="Prioritized recommendations derived from site audits, competitor gaps, search demand, local presence, and technical performance."
        actions={
          <ActionButton
            variant="secondary"
            icon={detect.isPending ? <Loader2 size={13} className="animate-spin text-accent-600" /> : <RefreshCw size={13} />}
            onClick={() => detect.mutate()}
            disabled={detect.isPending}
          >
            {detect.isPending ? "Analysing…" : "Re-analyse"}
          </ActionButton>
        }
      />

      {successBanner && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800 animate-in fade-in duration-200">
          <Sparkles size={15} className="shrink-0 text-emerald-600" />
          <span>{successBanner}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-800">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((filter) => {
          const count = filter.value ? (data?.byCategory[filter.value] ?? 0) : (data?.total ?? 0);
          const Icon = filter.icon;
          return (
            <button
              key={filter.label}
              onClick={() => setCategory(filter.value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                category === filter.value
                  ? "bg-brand-950 text-white shadow-sm"
                  : "border border-brand-200 bg-white text-brand-600 hover:bg-brand-50"
              }`}
            >
              <Icon size={13} className={category === filter.value ? "text-white" : "text-brand-400"} />
              {filter.label}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                  category === filter.value
                    ? "bg-white/20 text-white"
                    : count > 0
                      ? "bg-brand-100 text-brand-700"
                      : "bg-brand-50 text-brand-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {list.isLoading || (detect.isPending && (!data || data.total === 0)) ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-brand-100 bg-white py-16 text-center">
          <Loader2 size={24} className="animate-spin text-accent-600" />
          <div>
            <p className="text-[14px] font-medium text-brand-950">Analysing your site & competitors…</p>
            <p className="mt-0.5 text-[12px] text-brand-500">Checking SEO, technical health, content gaps, local presence, and market opportunities.</p>
          </div>
        </div>
      ) : !data || data.total === 0 ? (
        <EmptyState detecting={detect.isPending} onDetect={() => detect.mutate()} filtered={!!category} />
      ) : (
        <div className="space-y-6">
          {high.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-brand-700">
                  High potential ({high.length})
                </h2>
              </div>
              <div className="space-y-3">
                {high.map((item) => (
                  <OpportunityCard
                    key={item.id}
                    opportunity={item}
                    busy={setStatus.isPending}
                    onStatus={(status) => setStatus.mutate({ id: item.id, status })}
                  />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-500" />
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-brand-700">
                  Additional Recommendations ({rest.length})
                </h2>
              </div>
              <div className="space-y-3">
                {rest.map((item) => (
                  <OpportunityCard
                    key={item.id}
                    opportunity={item}
                    busy={setStatus.isPending}
                    onStatus={(status) => setStatus.mutate({ id: item.id, status })}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Opportunity card with verified evidence and clear action paths.
 */
function OpportunityCard({
  opportunity,
  busy,
  onStatus,
}: {
  opportunity: GrowthOpportunity;
  busy: boolean;
  onStatus: (status: "ACTIONED" | "DISMISSED") => void;
}) {
  const [open, setOpen] = useState(false);

  const categoryStyle = CATEGORY_TONE[opportunity.category] || "bg-brand-50 text-brand-700 border-brand-200";
  const potentialStyle = BAND_TONE[opportunity.potential] || "bg-brand-50 text-brand-700 border-brand-200";

  return (
    <article className="rounded-xl border border-brand-200/80 bg-white transition hover:border-brand-300 hover:shadow-sm">
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-md border px-2 py-0.5 text-[10px] ${potentialStyle}`}>
                {opportunity.potential} POTENTIAL
              </span>
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${categoryStyle}`}>
                {opportunity.category}
              </span>
              <span className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600">
                {SOURCE_LABEL[opportunity.source] ?? opportunity.source}
              </span>
              <span className="text-[11px] text-brand-400">
                {opportunity.effort} effort · {opportunity.confidence}% confidence
              </span>
            </div>
            <h3 className="mt-2 text-[14px] font-semibold text-brand-950 leading-snug">{opportunity.title}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-brand-600">{opportunity.summary}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => onStatus("ACTIONED")}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-brand-700 hover:bg-brand-50 hover:text-emerald-700 disabled:opacity-50 transition"
              title="Mark as completed"
            >
              <Check size={12} className="text-emerald-600" /> Done
            </button>
            <button
              onClick={() => onStatus("DISMISSED")}
              disabled={busy}
              className="rounded-lg border border-transparent p-1.5 text-brand-400 hover:border-brand-200 hover:bg-brand-50 hover:text-red-600 disabled:opacity-50 transition"
              title="Dismiss opportunity"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-brand-600 hover:text-brand-950 transition"
        >
          <ChevronDown size={13} className={`transition-transform duration-150 ${open ? "" : "-rotate-90"}`} />
          {open ? "Hide details & evidence" : `View reasoning & evidence (${opportunity.evidence?.length ?? 0})`}
        </button>
      </div>

      {open && (
        <div className="border-t border-brand-100 bg-brand-50/40 px-5 py-4 space-y-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-brand-500 mb-2">Verified Evidence</div>
            <dl className="grid gap-2 sm:grid-cols-2">
              {opportunity.evidence?.map((item, i) => (
                <div key={i} className="rounded-lg border border-brand-200/70 bg-white p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-brand-500">{item.label}</dt>
                  <dd className="mt-1 text-[12px] font-medium text-brand-900 leading-snug">{item.value}</dd>
                  <dd className="mt-1 text-[10px] text-brand-400 flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500" />
                    Source: {item.source}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-lg border border-accent-200 bg-accent-50/50 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-accent-900 flex items-center gap-1.5">
              <Sparkles size={13} className="text-accent-600" /> Recommended Action
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-accent-950 font-normal">{opportunity.recommendedAction}</p>
          </div>

          {opportunity.affectedPages && opportunity.affectedPages.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-brand-500 mb-1.5">Affected Pages</div>
              <ul className="space-y-1">
                {opportunity.affectedPages.map((page) => (
                  <li key={page} className="flex items-center gap-1.5 text-[12px] text-brand-700">
                    <ExternalLink size={11} className="shrink-0 text-brand-400" />
                    <span className="font-mono text-[11px] truncate">{page}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function EmptyState({
  detecting,
  onDetect,
  filtered,
}: {
  detecting: boolean;
  onDetect: () => void;
  filtered: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed border-brand-200 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-accent-600">
        <Target size={24} />
      </div>
      <p className="text-[15px] font-semibold text-brand-950">
        {filtered ? "No opportunities in this category" : "No opportunities generated yet"}
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-brand-500">
        {filtered
          ? "Try selecting another category or click Re-analyse to run detection across all data sources."
          : "Growth Opportunities analyzes your website crawl, on-page SEO, technical health, content gaps, local presence, and competitor signals."}
      </p>
      <button
        onClick={onDetect}
        disabled={detecting}
        className="mx-auto mt-5 flex items-center gap-2 rounded-lg bg-brand-950 px-4 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-brand-900 disabled:opacity-60 transition"
      >
        {detecting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        {detecting ? "Analysing data sources…" : "Analyse now"}
      </button>
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-32 items-center justify-center text-sm text-brand-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading opportunities…
        </div>
      }
    >
      <OpportunitiesClient />
    </Suspense>
  );
}
