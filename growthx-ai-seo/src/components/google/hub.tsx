"use client";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Pill } from "@/components/ui/console";
import { FailedState, LoadingState } from "@/components/ui/truthful-state";
import { MoreLinks } from "@/components/google/more-links";
import { useGoogleOverview } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import type { GoogleOverview, GoogleSourceStatus } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { formatKpi } from "@/lib/google-format";

/** Two choices: Search Console or Analytics 4, each with its state and two headline numbers. */
export function GoogleHub() {
  const { projectId } = useWorkspace();
  const { query, days } = useGoogleOverview(projectId);
  const o = query.data;

  if (!projectId || query.isLoading) return <LoadingState compact title="Loading Google…" message="Reading the stored Search Console and Analytics data for this workspace." />;
  if (query.error || !o) return <FailedState title="Could not load Google performance" error={errorMessage(query.error)} onRetry={() => query.refetch()} />;

  return (
    <div className="space-y-6">
      <Link href="/google/report" className="group flex flex-wrap items-center gap-4 rounded-xl border border-primary-200 bg-primary-50 p-5 hover:bg-primary-100">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white"><Sparkles size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-brand-950">Improvement report</span>
          <span className="block text-[12px] text-brand-600">Sarvam reads all your Search Console and Analytics 4 data, tells you where you stand, and lists what to do first.</span>
        </span>
        <span className="flex items-center gap-1 text-[12px] font-semibold text-primary-700">
          Get the report <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SourceCard
          href="/google/search-console"
          title="Search Console"
          blurb="How Google shows your site in search."
          status={o.sources.searchConsole}
          overview={o}
          keys={["clicks", "impressions"]}
          days={days}
        />
        <SourceCard
          href="/google/analytics"
          title="Analytics 4"
          blurb="What visitors do once they arrive."
          status={o.sources.analytics}
          overview={o}
          keys={["organicSessions", "engagementRate"]}
          days={days}
        />
      </div>
      <MoreLinks group="analysis" />
    </div>
  );
}

function SourceCard({ href, title, blurb, status, overview, keys, days }: { href: string; title: string; blurb: string; status: GoogleSourceStatus; overview: GoogleOverview; keys: string[]; days: number }) {
  return (
    <Link href={href} className="group flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-card hover:bg-primary-50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-brand-950">{title}</h2>
          <p className="mt-0.5 text-[12px] text-brand-500">{blurb}</p>
        </div>
        <Pill tone={status.connected ? "good" : "default"}>{status.connected ? "● Connected" : "Not connected"}</Pill>
      </div>
      {status.connected ? (
        <div className="grid grid-cols-2 gap-3">
          {keys.map((key) => {
            const kpi = overview.kpis.find((k) => k.key === key);
            return kpi ? (
              <div key={key}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">{kpi.label}</p>
                <p className="font-mono text-[22px] font-bold tracking-[-0.02em] text-brand-950">{formatKpi(kpi)}</p>
                <p className="text-[10.5px] text-brand-400">Last {days} days</p>
              </div>
            ) : null;
          })}
        </div>
      ) : (
        <p className="text-[12px] text-brand-500">Connect it in Integrations to see these figures.</p>
      )}
      <span className="mt-auto flex items-center gap-1 text-[12px] font-semibold text-primary-700">
        Open {title} <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
