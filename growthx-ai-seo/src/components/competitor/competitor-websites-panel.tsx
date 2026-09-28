"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Loader2, Star } from "lucide-react";
import { Panel, Pill, relativeTime } from "@/components/ui/console";
import { api, type CompetitorWebsite, type SiteReadStatus } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const ACTIVE: SiteReadStatus[] = ["READING", "QUEUED"];
/**
 * One colour per kind of page, as classes rather than var(--color-series-n):
 * Tailwind only emits a theme colour a class uses, so a series colour named
 * only inside a style prop is not on the page at all.
 */
const SERIES = ["bg-series-1", "bg-series-2", "bg-series-3", "bg-series-4", "bg-series-5"];
/** Kinds of page named in the legend; the rest are summed as "Other kinds". */
const TYPES_SHOWN = SERIES.length;

/**
 * Every website on the page — yours first, then each competitor's — with the
 * things a customer asks about a rival's site: are you reading it, how much of
 * it have you read, what kinds of pages does it have, how healthy is it, and
 * what do its Google reviews say.
 *
 * Polls while any site is being read, so "Reading now · 37 pages so far"
 * counts up and turns into "Read just now" without a reload.
 */
export function CompetitorWebsitesPanel({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: ["competitor-websites", projectId],
    queryFn: () => api.competitorWebsites(projectId),
    enabled: Boolean(projectId),
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data?.sites.some((s) => ACTIVE.includes(s.status)) ? 10_000 : false),
  });
  const sites = query.data?.sites ?? [];
  const reading = sites.filter((s) => ACTIVE.includes(s.status)).length;

  return (
    <Panel
      title="Websites we read"
      subtitle={
        reading
          ? `Reading ${reading} website${reading === 1 ? "" : "s"} now. This updates by itself.`
          : "Your website and each competitor's: how much we've read, what kinds of pages they have, and their Google rating."
      }
    >
      {query.isLoading ? (
        <p className="flex items-center justify-center gap-2 p-6 text-[12px] text-brand-500">
          <Loader2 size={13} className="animate-spin" /> Loading websites…
        </p>
      ) : query.error ? (
        <p className="p-5 text-[12px] text-error-600">
          Couldn&apos;t load the websites: {(query.error as Error).message}
        </p>
      ) : sites.length === 0 ? (
        <p className="p-6 text-center text-[12px] text-brand-500">Add your website and a competitor to see them here.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((site) => (
            <SiteCard key={site.competitorId ?? `you-${site.domain}`} site={site} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function SiteCard({ site }: { site: CompetitorWebsite }) {
  const you = site.role === "you";
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-4", you ? "border-primary-200 bg-primary-50" : "bg-white")}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13.5px] font-semibold text-brand-950">{site.name}</p>
          {you && <Pill tone="info">You</Pill>}
        </div>
        <a
          href={`https://${site.domain}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11.5px] text-brand-500 hover:text-primary-700 hover:underline"
        >
          {site.domain} <ExternalLink size={10} />
        </a>
      </div>

      <ReadStatus site={site} />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Pages read" value={site.pagesRead ? site.pagesRead.toLocaleString() : "—"} />
        <Stat label="Health" value={site.healthScore != null ? `${site.healthScore}/100` : "—"} />
        <RatingStat site={site} />
      </div>

      <PageKinds site={site} />
      <NotOpenedNote site={site} />
    </div>
  );
}

function ReadStatus({ site }: { site: CompetitorWebsite }) {
  const box = "flex items-start gap-2 rounded-lg px-2.5 py-2 text-[12px]";
  switch (site.status) {
    case "READING":
      return (
        <div className={cn(box, "bg-primary-100 text-primary-800")}>
          <Loader2 size={14} className="mt-px shrink-0 animate-spin" />
          <div>
            <p className="font-semibold">
              Reading now · {(site.pagesSoFar ?? 0).toLocaleString()} page{site.pagesSoFar === 1 ? "" : "s"} so far
            </p>
            {(site.notOpenedSoFar ?? 0) > 0 && (
              <p className="text-[11px] text-warning-700">
                {site.notOpenedSoFar!.toLocaleString()} more didn&apos;t open, so they aren&apos;t counted.
              </p>
            )}
            <p className="text-[11px] opacity-80">
              {site.readingStartedAt ? `Started ${relativeTime(site.readingStartedAt)}. ` : ""}
              {site.pagesRead && site.lastReadAt
                ? `The figures below are from the last read, ${relativeTime(site.lastReadAt)}.`
                : "Figures appear here when it finishes."}
            </p>
          </div>
        </div>
      );
    case "QUEUED":
      return (
        <div className={cn(box, "bg-brand-100 text-brand-700")}>
          <Clock size={14} className="mt-px shrink-0" />
          <p className="font-semibold">Waiting to start. It begins shortly.</p>
        </div>
      );
    case "READ":
      return (
        <div className={cn(box, "bg-success-50 text-success-700")}>
          <CheckCircle2 size={14} className="mt-px shrink-0" />
          <div>
            <p className="font-semibold">Read {site.lastReadAt ? relativeTime(site.lastReadAt) : ""}</p>
            {site.error && <p className="text-[11px] text-warning-700">The latest re-read didn&apos;t work: {site.error}</p>}
          </div>
        </div>
      );
    case "FAILED":
      return (
        <div className={cn(box, "bg-error-50 text-error-700")}>
          <AlertTriangle size={14} className="mt-px shrink-0" />
          <div>
            <p className="font-semibold">Couldn&apos;t read this website</p>
            <p className="text-[11px]">
              {site.error ?? "No pages could be read."}{" "}
              {site.role === "competitor" ? "We'll try again automatically." : "Run a new audit to try again."}
            </p>
          </div>
        </div>
      );
    default:
      return (
        <div className={cn(box, "bg-brand-100 text-brand-600")}>
          <Clock size={14} className="mt-px shrink-0" />
          <p className="font-semibold">
            {site.role === "competitor" ? "Not read yet. It starts automatically." : "Not read yet. Run an audit to read it."}
          </p>
        </div>
      );
  }
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-400">{label}</p>
      <p className="mt-0.5 text-[16px] font-bold leading-tight text-brand-950">{value}</p>
      {sub && <p className="text-[10.5px] leading-tight text-brand-500">{sub}</p>}
    </div>
  );
}

function RatingStat({ site }: { site: CompetitorWebsite }) {
  if (site.rating == null) {
    return <Stat label="Rating" value="—" sub={site.role === "you" ? "Google not connected" : "Not on Google yet"} />;
  }
  if (!site.reviewCount) return <Stat label="Rating" value="—" sub="No Google reviews yet" />;
  return (
    <div className="rounded-lg border bg-white px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-400">Rating</p>
      <p className="mt-0.5 flex items-center gap-1 text-[16px] font-bold leading-tight text-brand-950">
        {site.rating.toFixed(1)} <Star size={13} className="fill-warning-400 text-warning-400" />
      </p>
      <p className="text-[10.5px] leading-tight text-brand-500">{site.reviewCount.toLocaleString()} Google reviews</p>
    </div>
  );
}

/**
 * The pages the crawl asked for and did not get, shown apart from "Pages read"
 * so that figure and the kinds of pages under it are always the same pages.
 * Folding them in is how a card once said 300 pages read above kinds of pages
 * that added up to 16.
 */
function NotOpenedNote({ site }: { site: CompetitorWebsite }) {
  const n = site.notOpened;
  if (!n) return null;
  const reasons = [
    { key: "refused", count: n.refused, text: "their website turned us away" },
    { key: "errored", count: n.errored, text: "showed an error, like “page not found”" },
    { key: "noAnswer", count: n.noAnswer, text: "didn't answer in time" },
  ].filter((r) => r.count > 0);
  const total = reasons.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-lg bg-warning-50 px-2.5 py-2 text-[11.5px] text-warning-700">
      <p className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle size={12} className="shrink-0" />
        {total.toLocaleString()} more page{total === 1 ? "" : "s"} didn&apos;t open, so {total === 1 ? "it isn't" : "they aren't"} counted
        above
      </p>
      <ul className="mt-1 space-y-0.5 pl-[18px]">
        {reasons.map((r) => (
          <li key={r.key}>
            <span className="font-semibold">{r.count.toLocaleString()}</span> {r.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What the site is made of, as one bar and a short legend. */
function PageKinds({ site }: { site: CompetitorWebsite }) {
  const total = site.pageTypes.reduce((sum, t) => sum + t.count, 0);
  if (total === 0) {
    return (
      <p className="text-[11.5px] text-brand-500">
        {ACTIVE.includes(site.status)
          ? "Kinds of pages appear here when reading finishes."
          : site.status === "READ"
            ? "Page details from this read are no longer kept. They return with the next read."
            : "No pages read yet."}
      </p>
    );
  }

  const shown = site.pageTypes.slice(0, TYPES_SHOWN);
  const rest = site.pageTypes.slice(TYPES_SHOWN).reduce((sum, t) => sum + t.count, 0);
  const segments = [
    ...shown.map((t, i) => ({ key: t.type, label: t.label, count: t.count, color: SERIES[i] })),
    ...(rest > 0 ? [{ key: "rest", label: "Other kinds", count: rest, color: "bg-brand-300" }] : []),
  ];

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-400">Kinds of pages</p>
      <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-brand-100" aria-hidden>
        {segments.map((s) => (
          <div key={s.key} className={s.color} style={{ width: `${(s.count / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-[11.5px] text-brand-600">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", s.color)} />
            <span className="truncate">{s.label}</span>
            <span className="ml-auto font-semibold text-brand-950">{s.count.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
