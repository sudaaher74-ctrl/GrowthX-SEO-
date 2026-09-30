"use client";
import { FailedState, LoadingState, NoDataState, NotConnectedState } from "@/components/ui/truthful-state";
import { useGa4Report } from "@/hooks/use-ga4-report";
import { useWorkspace } from "@/hooks/use-growthx";
import type { Ga4Report, Ga4ReportData } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

/**
 * Loading, connection and empty states for the stored Google Analytics report.
 * Renders `children` only when there is a report with sessions in it, so a
 * view never has to decide what "not connected" or "nothing fetched" looks like.
 */
export function Ga4Gate({ children }: { children: (ctx: { report: Ga4Report; data: Ga4ReportData; days: number }) => React.ReactNode }) {
  const { projectId } = useWorkspace();
  const { report, sync, days } = useGa4Report(projectId);
  const r = report.data;

  if (!projectId || report.isLoading) {
    return <LoadingState compact title="Loading Google Analytics…" message="Reading the stored Google Analytics report for this workspace." />;
  }
  if (report.error || !r) {
    return <FailedState title="Could not load Google Analytics" error={errorMessage(report.error)} onRetry={() => report.refetch()} />;
  }

  if (r.state === "NOT_CONNECTED") {
    return (
      <NotConnectedState
        title="Connect Google Analytics to see your traffic"
        missing="Google Analytics is not connected for this workspace."
        whyItMatters="Analytics is the only source that knows which channel each visit came from. Nothing is estimated."
        actionRequired="Connect Google Analytics, and choose your website's property."
        action={{ label: "Open Integrations", href: "/integrations" }}
      />
    );
  }
  if (r.state === "NEEDS_SELECTION" || r.state === "NEEDS_REAUTH" || r.state === "ERROR") {
    return (
      <FailedState
        title={r.state === "NEEDS_SELECTION" ? "Choose a Google Analytics property" : r.state === "NEEDS_REAUTH" ? "Reconnect Google Analytics" : "Google Analytics returned an error"}
        error={r.message ?? "Open Integrations to fix the Google Analytics connection."}
      />
    );
  }
  if (r.state === "NEVER_SYNCED" && !r.data) {
    return (
      <LoadingState
        compact
        title={sync.isPending ? "Fetching from Google Analytics…" : "Nothing fetched yet"}
        message={sync.error ? errorMessage(sync.error) : "The first fetch reads channels, landing pages and daily visits. Use Refresh data above if it does not start."}
      />
    );
  }
  if (!r.data || r.data.empty) {
    return (
      <NoDataState
        compact
        title="No traffic recorded for this period"
        missing={`Google Analytics reported no sessions in the last ${days} days.`}
        whyItMatters="Channels and landing pages are built from sessions, so there is nothing to compare yet."
        actionRequired="Try a longer range, or press Refresh data above."
      />
    );
  }
  return <>{children({ report: r, data: r.data, days })}</>;
}
