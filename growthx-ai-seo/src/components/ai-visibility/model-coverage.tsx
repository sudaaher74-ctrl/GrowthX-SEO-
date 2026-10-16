"use client";
import type { VisibilityReport } from "@/lib/api-types";
import { providerName, type VisibilityJourneyResponse } from "@/lib/visibility-workflow";
import { Panel, Pill } from "@/components/ui/console";
import { platformKey } from "./live-dashboard-data";

export function ModelCoverage({ data, report, loading, error }: {
  data?: VisibilityJourneyResponse; report?: VisibilityReport | null; loading?: boolean; error?: Error | null;
}) {
  return <Panel title="Model coverage" padded>
    {loading ? <p className="text-xs text-brand-500">Checking model configuration…</p> : error ? <p className="text-xs text-error-700">Could not check model configuration: {error.message}</p> :
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{data?.providers.map(provider => {
        const measured = report?.byAssistant.filter(row => platformKey(row.assistant) === platformKey(provider.provider)).reduce((sum, row) => sum + row.checked, 0) ?? 0;
        const blocked = !provider.configured || !!provider.unavailableReason;
        return <div key={provider.provider} className="space-y-1 text-xs">
          <span className="font-semibold">{providerName(provider.provider)}</span>
          <div><Pill tone={blocked ? "warn" : measured ? "good" : "info"}>{blocked ? "Unavailable" : measured ? `${measured} answers measured` : "Configured · no results yet"}</Pill></div>
          <p className="break-words text-brand-500">{provider.unavailableReason || (!provider.configured ? "Provider credentials are not configured." : measured ? provider.model : "Run the reviewed questions to collect results for this period.")}</p>
        </div>;
      })}</div>}
    {data?.journey?.status === "FAILED" && <p className="mt-3 border-t pt-3 text-xs text-error-700">Latest run failed: {data.journey.errors.join(" ") || "Open Run Check to review the saved error."}</p>}
  </Panel>;
}
