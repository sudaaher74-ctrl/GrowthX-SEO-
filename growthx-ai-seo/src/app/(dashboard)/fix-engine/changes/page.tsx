"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel, Pill, ActionButton } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";

const fields: Record<string, string> = {
  META_TITLE: "Page name in search results", META_DESCRIPTION: "Description in search results",
  ALT_TEXT: "Image description", FAQ_SCHEMA: "Questions and answers for search engines",
  PRODUCT_SCHEMA: "Product information for search engines", ORGANIZATION_SCHEMA: "Business information for search engines",
  BREADCRUMB_SCHEMA: "Page navigation for search engines",
};

export default function FixChangesPage() {
  const { projectId } = useWorkspace();
  const report = useQuery({ queryKey: ["fix-changes", projectId], queryFn: () => api.listFixChanges(projectId!), enabled: Boolean(projectId), retry: false });
  return <div className="space-y-4 pb-12">
    <PageHeader title="Changes & proof" subtitle="See what we prepared, what it looked like before, why we changed it, and what your website shows now."
      actions={<ActionButton variant="secondary" onClick={() => report.refetch()} disabled={report.isFetching}>Refresh evidence</ActionButton>} />
    <Link href="/fix-engine" className="inline-block text-sm text-accent-700 hover:underline">← Back to Fix Engine</Link>
    <Panel title="How to read this page" padded>
      <p className="text-sm text-brand-600">Before comes from your saved website audit. Prepared change is the version sent for your approval. Live evidence comes from a later audit of your website. A matching value confirms that value was seen live; it does not promise higher rankings or more sales.</p>
      <Link href="/website" className="mt-3 inline-block text-sm font-semibold text-accent-700 hover:underline">Run a fresh website audit to collect live evidence →</Link>
    </Panel>
    {!projectId ? <Panel padded>Select a workspace to see its changes.</Panel> : <QueryState isLoading={report.isLoading} error={report.error} isEmpty={report.data?.length === 0} emptyTitle="No changes prepared yet" emptyBody="Prepare website fixes in Fix Engine. Your changes will appear here with their saved evidence.">
      {report.data?.map(run => <Panel key={run.id} title={`Website changes · ${new Date(run.startedAt).toLocaleString()}`} padded>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Pill tone={run.status === "FAILED" ? "bad" : "warn"}>{run.status === "FAILED" ? "Preparation failed" : run.status === "RUNNING" ? "Preparing" : "Prepared for approval"}</Pill>
          <span className="text-sm text-brand-500">{run.changes.length} recorded changes · {run.filesChanged.length} unique files</span>
          {run.pullRequestUrl && <a href={run.pullRequestUrl} target="_blank" rel="noreferrer" className="text-sm text-accent-700 hover:underline">View approval request</a>}
        </div>
        {run.error && <p className="mb-3 text-sm text-error-700">{run.error}</p>}
        {run.changes.length === 0 && <p className="text-sm text-brand-600">Detailed before and after evidence was not saved for this run. We cannot reconstruct it reliably. You can review its approval request; future website fix runs will save these details here.</p>}
        <div className="space-y-6">{run.changes.map((change, index) => <article key={`${change.issueId}-${index}`} className="border-t pt-4">
          <h2 className="font-semibold text-brand-950">{fields[change.field] || "Website information"}</h2>
          <a href={change.url} target="_blank" rel="noreferrer" className="break-all text-sm text-accent-700 hover:underline">{change.url}</a>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-brand-50 p-3"><dt className="text-sm font-semibold text-brand-950">Before — saved audit</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm text-brand-600">{change.before ?? (change.measuredAt && ["META_TITLE", "META_DESCRIPTION"].includes(change.field) ? "No value found in that audit" : "Before value was not recorded")}</dd>{change.measuredAt && <dd className="mt-2 text-xs text-brand-500">Measured {new Date(change.measuredAt).toLocaleString()}</dd>}</div>
            <div className="rounded-lg bg-brand-50 p-3"><dt className="text-sm font-semibold text-brand-950">After — prepared change</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm text-brand-600">{change.after}</dd></div>
          </dl>
          <p className="mt-3 text-sm text-brand-600"><strong className="text-brand-950">Why we changed it: </strong>{change.why}</p>
          <div className="mt-3 space-y-2">
            <Pill tone={change.verification === "MATCHED" ? "good" : "warn"}>{change.verification === "MATCHED" ? "Seen on your live website" : change.verification === "DIFFERENT" ? "Live website shows a different value" : "Live website not checked yet"}</Pill>
            {change.checkedAt ? <p className="text-sm text-brand-600">Live value: {change.liveValue ?? "No value found"}<br />Checked {new Date(change.checkedAt).toLocaleString()}</p> : <p className="text-sm text-brand-500">Publish the approved changes, then run a fresh audit. Some types of change need a separate manual check.</p>}
          </div>
          <details className="mt-3 text-xs text-brand-500"><summary className="cursor-pointer">Technical details</summary><p className="mt-2 break-all">File: {change.file} · Change type: {change.field}</p></details>
        </article>)}</div>
        {run.skipped.length > 0 && <details className="mt-4 text-sm text-brand-600"><summary className="cursor-pointer font-semibold">{run.skipped.length} items left unchanged</summary><p className="my-2">These were not included in the prepared changes and may need a developer.</p><ul className="list-disc space-y-2 pl-5">{run.skipped.map((reason, index) => <li key={index}>{reason}</li>)}</ul></details>}
      </Panel>)}
    </QueryState>}
  </div>;
}
