"use client";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { ActionButton, StatusNote } from "@/components/ui/console";
import { FailedState, LoadingState, NotConnectedState } from "@/components/ui/truthful-state";
import { Funnel, Headlines, KpiCard, TrendChart } from "@/components/google/parts";
import { useGoogleOverview, useGoogleRefresh } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import type { GoogleOverview } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Search visibility", keys: ["clicks", "impressions", "ctr", "position"] },
  { title: "User behavior", keys: ["organicUsers", "organicSessions", "engagementRate"] },
  { title: "Business", keys: ["keyEvents"] },
];

/**
 * The Google section's landing view: what happened in Google, what visitors did
 * next and whether it mattered. Every figure is read from stored Search Console
 * and Google Analytics data for this workspace; one that a source did not
 * measure shows as "—" with the reason, never as zero.
 */
export default function GoogleCombinedOverviewPage() {
  const { projectId } = useWorkspace();
  const { query, days } = useGoogleOverview(projectId);
  const refresh = useGoogleRefresh(projectId);
  const o = query.data;

  if (!projectId || query.isLoading) return <LoadingState compact title="Loading Google performance…" message="Reading the stored Search Console and Analytics data for this workspace." />;
  if (query.error || !o) {
    return <FailedState title="Could not load Google performance" error={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  }

  const sc = o.sources.searchConsole;
  const ga = o.sources.analytics;

  if (!sc.connected && !ga.connected) {
    return (
      <NotConnectedState
        title="Connect Google to see how your website performs"
        missing="Neither Search Console nor Google Analytics is connected for this workspace."
        whyItMatters="Search Console shows how Google displays your pages; Analytics shows what visitors do after they arrive. This view joins them, and nothing is estimated."
        actionRequired="Connect both, and choose your website in each."
        action={{ label: "Open Integrations", href: "/integrations" }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Notices overview={o} onRefresh={() => refresh.mutate({ searchConsole: sc.connected, analytics: ga.connected })} refreshing={refresh.isPending} />
      <Headlines headlines={o.headlines} />

      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">{group.title}</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {group.keys.map((key) => {
              const kpi = o.kpis.find((k) => k.key === key);
              return kpi ? <KpiCard key={key} kpi={kpi} days={days} /> : null;
            })}
          </div>
        </section>
      ))}

      <TrendChart overview={o} />
      <Funnel stages={o.funnel} />
    </div>
  );
}

/** Says what is missing or needs a refresh, in the terms the spec asks for. */
function Notices({ overview: o, onRefresh, refreshing }: { overview: GoogleOverview; onRefresh: () => void; refreshing: boolean }) {
  const sc = o.sources.searchConsole;
  const ga = o.sources.analytics;
  const notes: React.ReactNode[] = [];

  if (sc.connected && !ga.connected) {
    notes.push(
      <span key="ga">
        <strong>Search Console connected.</strong> Connect Google Analytics to unlock user behavior and conversion intelligence.{" "}
        <Link href="/integrations" className="font-semibold underline">Open Integrations</Link>
      </span>,
    );
  }
  if (ga.connected && !sc.connected) {
    notes.push(
      <span key="sc">
        <strong>Analytics connected.</strong> Connect Search Console to unlock Google Search visibility intelligence.{" "}
        <Link href="/integrations" className="font-semibold underline">Open Integrations</Link>
      </span>,
    );
  }
  if (sc.connected && !sc.hasData) {
    notes.push(
      <span key="sc-empty">
        Search Console is connected but nothing has been fetched from it yet. Use <strong>Refresh data</strong> above to read the last 90 days.
      </span>,
    );
  }
  if (ga.connected && ga.needsRefresh) {
    notes.push(
      <span key="ga-refresh" className="flex flex-wrap items-center gap-2">
        Google Analytics was last fetched before organic figures were tracked, so they are blank.
        <ActionButton onClick={onRefresh} disabled={refreshing} icon={<RefreshCw size={12} className={refreshing ? "animate-spin" : undefined} />}>
          {refreshing ? "Refreshing…" : "Load organic figures"}
        </ActionButton>
      </span>,
    );
  } else if (ga.connected && ga.state !== "READY" && ga.message) {
    notes.push(<span key="ga-msg">{ga.message}</span>);
  }

  return (
    <>
      {notes.map((n, i) => (
        <StatusNote key={i} tone={sc.connected && ga.connected && !ga.needsRefresh && sc.hasData ? "good" : "bad"}>
          {n}
        </StatusNote>
      ))}
    </>
  );
}
