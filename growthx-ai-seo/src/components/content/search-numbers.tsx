"use client";

import Link from "next/link";
import { AlertTriangle, BarChart3, Clock, Target } from "lucide-react";
import { Panel } from "@/components/ui/console";
import type { MeasuredNumbers, MeasuredSearch, SearchDataStatus } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * Google's own numbers, next to the product's suggestions.
 *
 * Every number here comes from the customer's Search Console, for a search
 * their site already appeared in. A phrase with no numbers is labelled a
 * suggestion — the product never estimates a search it has no data for.
 */

/** "page 2 of Google", from an average position. */
function googlePage(position: number): string {
  const page = Math.max(1, Math.ceil(position / 10));
  return page === 1 ? "page 1 of Google" : `page ${page} of Google`;
}

const fmt = (n: number) => n.toLocaleString("en-IN");
const pos = (p: number) => (Math.round(p * 10) / 10).toString();

/** The numbers for one phrase, in words: "Seen 340 times · 12 clicks · position 14 (page 2)". */
function measuredText(m: Pick<MeasuredNumbers, "impressions" | "clicks" | "position">): string {
  return `Seen ${fmt(m.impressions)} time${m.impressions === 1 ? "" : "s"} · ${fmt(m.clicks)} click${m.clicks === 1 ? "" : "s"} · position ${pos(m.position)} (${googlePage(m.position)})`;
}

/** Google's numbers for a phrase, or a plain "Suggested" when there are none. */
export function MeasuredBadge({ measured }: { measured: MeasuredNumbers | null | undefined; days?: number }) {
  if (!measured) {
    return (
      <span className="inline-flex items-center rounded-md bg-brand-100 px-1.5 py-0.5 text-[10.5px] font-medium text-brand-500">
        Suggested, not measured yet
      </span>
    );
  }
  return (
    <span
      title={`From your Google Search Console, last ${measured.days} days`}
      className="inline-flex items-center gap-1 rounded-md bg-success-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-success-700"
    >
      <BarChart3 size={11} /> Google: {measuredText(measured)}
    </span>
  );
}

/** What to say when there are no numbers to show, and where to fix it. */
export function SearchConnectNote({ status, className }: { status: SearchDataStatus | undefined; className?: string }) {
  if (!status || status === "OK") return null;
  const copy = {
    NOT_CONNECTED: {
      icon: BarChart3,
      text: "See how many people really search for each phrase: connect Google Search Console. It's free and takes two minutes.",
      cta: "Connect Search Console",
    },
    NO_DATA_YET: {
      icon: Clock,
      text: "Google Search Console is connected. Real search numbers appear here after the first sync, usually within a day.",
      cta: "Check the connection",
    },
    NEEDS_ATTENTION: {
      icon: AlertTriangle,
      text: "Your Google Search Console connection needs attention, so these phrases have no real numbers yet.",
      cta: "Fix the connection",
    },
  }[status];
  const Icon = copy.icon;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3", className)}>
      <Icon size={15} className="shrink-0 text-accent-600" />
      <p className="min-w-0 flex-1 text-[12.5px] text-accent-700">{copy.text}</p>
      <Link href="/integrations" className="shrink-0 text-[12px] font-semibold text-accent-700 underline">
        {copy.cta}
      </Link>
    </div>
  );
}

/**
 * Searches the site already shows for, just off the first page of Google —
 * the closest wins there are. Every number is Google's; the advice is the
 * same plain step for each, not a guess about the page.
 */
export function AlmostWinningPanel({
  searches,
  days,
  pathOf,
  action,
}: {
  searches: MeasuredSearch[];
  days: number;
  pathOf?: (url: string) => string;
  /** Optional per-row control, such as "Save as a plan". */
  action?: (s: MeasuredSearch) => React.ReactNode;
}) {
  if (searches.length === 0) return null;
  const path = pathOf ?? defaultPath;
  return (
    <Panel
      title="Searches you almost win"
      subtitle={`People already search for these and Google shows your website, but not near the top. Real numbers from your Google Search Console, last ${days} days.`}
    >
      <ul className="divide-y">
        {searches.map((s) => (
          <li key={s.query} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-700">
              <Target size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-brand-950">&ldquo;{s.query}&rdquo;</p>
              <p className="mt-0.5 font-mono text-[11.5px] text-brand-600">{measuredText(s)}</p>
              <p className="mt-1 text-[12px] text-brand-700">
                <span className="font-semibold text-success-700">What to do: </span>
                {s.page ? (
                  <>
                    Improve <span className="font-medium text-brand-950">{path(s.page)}</span>: use &ldquo;{s.query}&rdquo; in its
                    title and main heading, and add a short section that answers it.
                  </>
                ) : (
                  <>Use &ldquo;{s.query}&rdquo; in the title and main heading of the page that best answers it.</>
                )}
              </p>
            </div>
            {action && <div className="shrink-0">{action(s)}</div>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function defaultPath(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}
