"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Globe, ArrowRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

const LABELS: Record<string, string> = {
  SERVICE: "Service pages",
  PRODUCT: "Product pages",
  LOCATION: "Location pages",
  BLOG: "Blog & articles",
  CASE_STUDY: "Case studies",
  FAQ: "FAQ pages",
  ABOUT: "About pages",
  CONTACT: "Contact pages",
};

/**
 * Page coverage on both sides, for one competitor.
 *
 * The counts come from crawling both public sites and typing each page. That
 * is the whole basis of the claim shown here, and the copy says so — a number
 * on a dashboard with no stated source gets read as something more than it is.
 *
 * Nothing is rendered as zero when it was never measured. "We have not crawled
 * them" and "they publish nothing" look identical as a zero, and only one of
 * them is a reason to go and write pages.
 */
export function CoverageComparison({
  projectId,
  competitorId,
  domain,
}: {
  projectId: string;
  competitorId: string;
  domain: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const comparison = useQuery({
    queryKey: ["competitor-coverage", projectId, competitorId],
    queryFn: () => api.competitorComparison(projectId, competitorId),
    // A crawl takes minutes and finishes in the background, so the panel polls
    // rather than leaving a queued crawl looking like a failed one. Polling
    // stops once their side has arrived.
    refetchInterval: (query) => (queued && !query.state.data?.theirs ? 15_000 : false),
  });

  const crawl = useMutation({
    mutationFn: () => api.crawlCompetitorSite(projectId, competitorId),
    onSuccess: () => {
      setError(null);
      setQueued(true);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const data = comparison.data;
  const theirs = data?.theirs;
  const ours = data?.ours;

  return (
    <div className="mt-3 rounded-lg border bg-brand-50 px-4 py-3" style={{ borderColor: "var(--color-brand-100)" }}>
      {comparison.isLoading ? (
        <div className="flex items-center gap-2 text-[12px] text-brand-500">
          <Loader2 size={12} className="animate-spin" /> Loading coverage…
        </div>
      ) : !theirs ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-brand-600">
            {crawl.isPending || (queued && !theirs) ? (
              <span className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                Crawling {domain}. This takes a few minutes — the results appear here on their own.
              </span>
            ) : (
              <>
                <span className="font-medium text-brand-950">Page coverage not measured yet.</span>{" "}
                Crawl their public site to compare how many service, product and location pages each of
                you publishes.
              </>
            )}
          </div>
          {!queued && (
            <button
              onClick={() => crawl.mutate()}
              disabled={crawl.isPending}
              className="flex items-center gap-1.5 rounded-md bg-brand-950 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
            >
              <Globe size={12} /> Analyze their site
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[12px] font-medium text-brand-950">
              {theirs.totalPages} pages crawled on {domain}
              {ours ? ` · ${ours.totalPages} on yours` : ""}
            </span>
            <button
              onClick={() => crawl.mutate()}
              disabled={crawl.isPending}
              className="text-[11px] font-medium text-brand-500 underline-offset-2 hover:underline disabled:opacity-60"
            >
              {crawl.isPending ? "Re-crawling…" : "Re-crawl"}
            </button>
          </div>

          {/* Stated plainly rather than footnoted: a count from a crawl that
              stopped at its ceiling is a floor, and presenting it as their
              total would turn a limit we chose into a fact about their site. */}
          {theirs.capped && (
            <p className="mt-1 text-[11px] text-brand-500">
              The crawl stopped at its page limit, so these counts are a minimum, not their full site.
            </p>
          )}

          <RecentChanges projectId={projectId} competitorId={competitorId} />

          {!ours ? (
            <p className="mt-2 text-[11px] text-brand-500">
              Your own site has not been crawled yet, so there is nothing to compare against. Run a
              crawl under Site Audit and this fills in.
            </p>
          ) : data.behindOn.length === 0 ? (
            <p className="mt-2 text-[12px] text-brand-600">
              They publish no more of any page kind than you do.
            </p>
          ) : (
            <div className="mt-2.5 space-y-1.5">
              {data.behindOn.map((row) => (
                <div key={row.pageType} className="flex items-center gap-3 text-[12px]">
                  <span className="w-32 shrink-0 text-brand-600">{LABELS[row.pageType] ?? row.pageType}</span>
                  <span className="font-mono text-[11px] text-brand-500">
                    you {row.ours} <ArrowRight size={9} className="inline" /> them {row.theirs}
                  </span>
                  <span className="rounded-full bg-accent-600/10 px-2 py-0.5 text-[11px] font-medium text-accent-600">
                    +{row.gap} they have
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-error-500">{error}</p>}
    </div>
  );
}

/**
 * What moved on their site since the crawl before this one.
 *
 * Renders nothing at all until there have been two crawls. A first crawl
 * diffed against nothing would read as "they added 35 pages", announcing the
 * site's whole existence as this week's news, and an empty "no changes" box
 * would say we checked when we did not.
 */
function RecentChanges({ projectId, competitorId }: { projectId: string; competitorId: string }) {
  const changes = useQuery({
    queryKey: ["competitor-changes", projectId, competitorId],
    queryFn: () => api.competitorChanges(projectId, competitorId),
  });

  const data = changes.data;
  if (!data) return null;

  const moved = data.added.length + data.removed.length + data.retitled.length;
  if (moved === 0) return null;

  const since = data.since ? new Date(data.since).toLocaleDateString() : null;

  return (
    <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "var(--color-brand-100)" }}>
      <div className="text-[11px] font-medium text-brand-950">
        Since {since ?? "the previous crawl"}
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {data.added.length > 0 && (
          <span className="rounded-full bg-[#10b98118] px-2 py-0.5 text-[11px] text-success-500">
            +{data.added.length} new {data.added.length === 1 ? "page" : "pages"}
          </span>
        )}
        {data.removed.length > 0 && (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] text-brand-600">
            −{data.removed.length} removed
          </span>
        )}
        {data.retitled.length > 0 && (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] text-brand-600">
            {data.retitled.length} retitled
          </span>
        )}
      </div>
      {/* The pages themselves, not just a count — "they added 6 pages" is a
          notification, "they added 6 service pages for cities you don't cover"
          is something to act on. Capped so one big relaunch cannot push the
          rest of the panel off the screen. */}
      {data.added.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {data.added.slice(0, 5).map((page) => (
            <li key={page.url} className="truncate text-[11px] text-brand-500">
              <span className="font-mono text-[10px] text-brand-400">{page.pageType}</span>{" "}
              {page.title || page.url}
            </li>
          ))}
          {data.added.length > 5 && (
            <li className="text-[11px] text-brand-400">and {data.added.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
