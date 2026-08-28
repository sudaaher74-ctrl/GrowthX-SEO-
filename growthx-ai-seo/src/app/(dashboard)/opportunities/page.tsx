"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Check, X, ChevronDown, Target } from "lucide-react";
import { ActionButton, PageHeader } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api, type GrowthOpportunity } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

const FILTERS = [
  { label: "All", value: undefined },
  { label: "SEO", value: "SEO" },
  { label: "Content", value: "CONTENT" },
  { label: "Local", value: "LOCAL" },
  { label: "Technical", value: "TECHNICAL" },
  { label: "Business", value: "BUSINESS" },
] as const;

/** Where a finding came from, so the reader can weigh it without opening it. */
const SOURCE_LABEL: Record<string, string> = {
  SEARCH_CONSOLE: "Search Console",
  COMPETITOR: "Competitor",
  WEBSITE: "Your site",
  ANALYTICS: "Analytics",
  LOCAL: "Local",
  MARKET: "Market",
};

const BAND_TONE: Record<string, string> = {
  HIGH: "bg-[#10b98118] text-success-500",
  MEDIUM: "bg-brand-100 text-brand-600",
  LOW: "bg-brand-100 text-brand-400",
};

function OpportunitiesClient() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["opportunities", projectId, category],
    queryFn: () => api.opportunities(projectId!, { category }),
    enabled: !!projectId,
  });

  const detect = useMutation({
    mutationFn: () => api.detectOpportunities(projectId!),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIONED" | "DISMISSED" }) =>
      api.setOpportunityStatus(projectId!, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities"] }),
    onError: (err) => setError(errorMessage(err)),
  });

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
        subtitle="Everything worth doing, from your site, your competitors and your search data — with the evidence behind each one."
        actions={
          <ActionButton
            variant="secondary"
            icon={detect.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            onClick={() => detect.mutate()}
            disabled={detect.isPending}
          >
            {detect.isPending ? "Analysing…" : "Re-analyse"}
          </ActionButton>
        }
      />

      {error && <p className="text-[12px] text-error-500">{error}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((filter) => {
          const count = filter.value ? (data?.byCategory[filter.value] ?? 0) : (data?.total ?? 0);
          return (
            <button
              key={filter.label}
              onClick={() => setCategory(filter.value)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                category === filter.value
                  ? "bg-brand-950 text-white"
                  : "border border-brand-200 text-brand-600 hover:bg-brand-100"
              }`}
            >
              {filter.label}
              {/* Counts come from the unfiltered totals, so a tab showing 0 is
                  telling the truth rather than reflecting the current filter. */}
              <span className="ml-1.5 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {list.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-[13px] text-brand-500">
          <Loader2 size={14} className="animate-spin" /> Loading opportunities…
        </div>
      ) : !data || data.total === 0 ? (
        <EmptyState detecting={detect.isPending} onDetect={() => detect.mutate()} filtered={!!category} />
      ) : (
        <div className="space-y-5">
          {high.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                High potential ({high.length})
              </h2>
              {high.map((item) => (
                <OpportunityCard
                  key={item.id}
                  opportunity={item}
                  busy={setStatus.isPending}
                  onStatus={(status) => setStatus.mutate({ id: item.id, status })}
                />
              ))}
            </section>
          )}

          {rest.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                Also worth doing ({rest.length})
              </h2>
              {rest.map((item) => (
                <OpportunityCard
                  key={item.id}
                  opportunity={item}
                  busy={setStatus.isPending}
                  onStatus={(status) => setStatus.mutate({ id: item.id, status })}
                />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One opportunity, with its evidence one click away rather than hidden.
 *
 * The evidence is the difference between a recommendation and an instruction.
 * Collapsed by default only because a page of twenty expanded findings is
 * unreadable — never because the reasoning is an optional extra.
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

  return (
    <article className="rounded-xl border bg-white" style={{ borderColor: "var(--color-brand-100)" }}>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BAND_TONE[opportunity.potential]}`}>
                {opportunity.potential} POTENTIAL
              </span>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-500">
                {SOURCE_LABEL[opportunity.source] ?? opportunity.source}
              </span>
              <span className="text-[11px] text-brand-400">
                {opportunity.effort} effort · {opportunity.confidence}% confidence
              </span>
            </div>
            <h3 className="mt-1.5 text-[14px] font-semibold text-brand-950">{opportunity.title}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-brand-600">{opportunity.summary}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => onStatus("ACTIONED")}
              disabled={busy}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-brand-600 hover:bg-brand-100 disabled:opacity-50"
              style={{ borderColor: "var(--color-brand-200)" }}
              title="Mark as done"
            >
              <Check size={11} /> Done
            </button>
            <button
              onClick={() => onStatus("DISMISSED")}
              disabled={busy}
              className="rounded-md p-1.5 text-brand-400 hover:bg-brand-100 hover:text-error-500 disabled:opacity-50"
              title="Not worth doing — this will not come back"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-brand-500 hover:text-brand-950"
        >
          <ChevronDown size={12} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
          {open ? "Hide evidence" : `Why this — ${opportunity.evidence.length} pieces of evidence`}
        </button>
      </div>

      {open && (
        <div className="border-t px-5 py-4" style={{ borderColor: "var(--color-brand-100)" }}>
          <dl className="space-y-2.5">
            {opportunity.evidence.map((item, i) => (
              <div key={i}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">{item.label}</dt>
                <dd className="mt-0.5 text-[13px] leading-relaxed text-brand-700">{item.value}</dd>
                {/* Named on every row. Two findings can look identical and mean
                    very different things depending on whether the number came
                    from the customer's own property or from an estimate. */}
                <dd className="text-[11px] text-brand-400">{item.source}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">Recommended action</div>
            <p className="mt-1 text-[13px] leading-relaxed text-brand-700">{opportunity.recommendedAction}</p>
          </div>

          {opportunity.affectedPages.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">Affected pages</div>
              <ul className="mt-1 space-y-0.5">
                {opportunity.affectedPages.map((page) => (
                  <li key={page} className="truncate text-[12px] text-brand-600">
                    {page}
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

/**
 * Nothing found is not the same as nothing to do.
 *
 * Detection needs inputs — a crawl of the customer's own site, at least one
 * crawled competitor, ideally Search Console. Saying "no opportunities" when
 * the real answer is "nothing has been analysed yet" reads as a clean bill of
 * health the data does not support.
 */
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
    <div
      className="rounded-xl border border-dashed bg-white px-6 py-14 text-center"
      style={{ borderColor: "var(--color-brand-200)" }}
    >
      <Target size={26} className="mx-auto mb-3 text-brand-300" />
      <p className="text-[14px] font-medium text-brand-950">
        {filtered ? "Nothing in this category" : "Nothing analysed yet"}
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-brand-500">
        {filtered
          ? "Try another category, or re-analyse to pick up anything new."
          : "Opportunities are found by comparing your site against your competitors and your search data. Crawl your own site, add and analyse a competitor, and connect Search Console — then run this."}
      </p>
      <button
        onClick={onDetect}
        disabled={detecting}
        className="mx-auto mt-5 flex items-center gap-2 rounded-lg bg-brand-950 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
      >
        {detecting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        {detecting ? "Analysing…" : "Analyse now"}
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
