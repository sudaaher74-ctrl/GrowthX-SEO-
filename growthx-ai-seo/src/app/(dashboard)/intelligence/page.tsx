"use client";
import Link from "next/link";
import { useState } from "react";
import { Panel, PageHeader, Pill } from "@/components/ui/console";
import { FailedState, LoadingState } from "@/components/ui/truthful-state";
import { useGrowthIntelligence } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import type { GrowthIntelligenceReport, IntelligenceEvidence, IntelligenceFinding, IntelligencePage, IntelligenceSource } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<IntelligenceSource, string> = {
  CRAWL: "Website crawl",
  GSC: "Search Console",
  GA4: "Analytics",
  GBP: "Business Profile",
  COMPETITORS: "Competitors",
  AI_VISIBILITY: "AI visibility",
};
const SEVERITY_TONE = { CRITICAL: "bad", HIGH: "bad", MEDIUM: "warn", LOW: "default" } as const;
const CONFIDENCE_TONE = { HIGH: "good", MEDIUM: "info", LOW: "default" } as const;

/**
 * "Why is my website not growing?" — every connected source combined into
 * problems, opportunities and risks, each with the evidence behind it. Nothing
 * here is an unsupported opinion: a finding that cites no evidence is not shown.
 */
export default function IntelligencePage() {
  const { projectId } = useWorkspace();
  const { query, days } = useGrowthIntelligence(projectId);

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="Why is my website not growing?"
        subtitle={`Website crawl, Search Console, Analytics, Business Profile, competitors and AI visibility, combined — last ${days} days.`}
      />
      {!projectId ? (
        <FailedState title="No website selected" error="Choose a client in the sidebar." />
      ) : query.isLoading ? (
        <LoadingState message="Combining every connected source…" />
      ) : query.isError ? (
        <FailedState title="Could not build the analysis" error={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : query.data ? (
        <Report report={query.data} />
      ) : null}
    </div>
  );
}

function Report({ report }: { report: GrowthIntelligenceReport }) {
  return (
    <>
      <Panel padded>
        <p className="text-[14px] leading-relaxed text-brand-950">{report.answer.summary}</p>
        <p className="mt-2 text-[11.5px] text-brand-500">{report.answer.confidenceNote}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(SOURCE_LABEL) as IntelligenceSource[]).map((s) => (
            <span key={s} title={report.sources[s].note ?? "Connected"}>
              <Pill tone={report.sources[s].connected ? "good" : "default"}>
                {SOURCE_LABEL[s]}: {report.sources[s].connected ? "connected" : "not measured"}
              </Pill>
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-brand-600">
          <span><b>{report.counts.problems}</b> problems</span>
          <span><b>{report.counts.opportunities}</b> opportunities</span>
          <span><b>{report.counts.risks}</b> risks</span>
          {report.estimatedExtraClicks > 0 && <span>≈ <b>{report.estimatedExtraClicks.toLocaleString("en-US")}</b> extra clicks available (estimate)</span>}
        </div>
      </Panel>

      {report.risks.length > 0 && (
        <Panel title="Risks" subtitle="Measured change between two real periods">
          <FindingList findings={report.risks} evidence={report.evidence} />
        </Panel>
      )}

      <Panel title="Pages to work on, in order" subtitle="Ranked by estimated extra clicks, then by how many sources agree">
        {report.pages.length === 0 ? (
          <p className="p-4 text-[12.5px] text-brand-500">No page has a finding the connected data can support yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {report.pages.map((p, i) => (
              <PageCard key={p.url} page={p} rank={i + 1} />
            ))}
          </div>
        )}
      </Panel>

      {report.notMeasured.length > 0 && (
        <Panel title="Not measured yet">
          <ul className="space-y-1 p-4 text-[12.5px] text-brand-600">
            {report.notMeasured.map((m) => (
              <li key={m.source}><b>{SOURCE_LABEL[m.source]}:</b> {m.reason}</li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="How this is worked out">
        <ul className="list-disc space-y-1 p-4 pl-8 text-[12px] text-brand-600">
          {report.methodology.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </Panel>
    </>
  );
}

function PageCard({ page, rank }: { page: IntelligencePage; rank: number }) {
  const [open, setOpen] = useState(rank === 1);
  return (
    <div className="p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        <span className="mt-0.5 font-mono text-[11px] text-brand-400">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[12.5px] font-semibold text-brand-950">{page.path}</span>
          <span className="mt-0.5 block text-[12.5px] text-brand-600">{page.headline}</span>
        </span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <Pill tone={CONFIDENCE_TONE[page.confidence]}>{page.confidence.toLowerCase()} confidence · {page.corroboratingSources.length} source{page.corroboratingSources.length === 1 ? "" : "s"}</Pill>
          {page.priority.potentialClicks > 0 && <Pill tone="info">≈ +{page.priority.potentialClicks} clicks</Pill>}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-4 pl-6">
          {page.conclusion && <p className="text-[12.5px] leading-relaxed text-brand-950">{page.conclusion}</p>}
          <p className="text-[11.5px] text-brand-500">{page.priority.reason}</p>

          <div>
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-500">Evidence</h4>
            <EvidenceList items={page.evidence} />
          </div>

          <div>
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-500">What to do</h4>
            <FindingList findings={page.findings} evidence={Object.fromEntries(page.evidence.map((e) => [e.id, e]))} />
          </div>

          {page.notMeasured.length > 0 && (
            <p className="text-[11.5px] text-brand-500">
              Not measured for this page: {page.notMeasured.map((m) => `${SOURCE_LABEL[m.source]} (${m.reason})`).join("; ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EvidenceList({ items }: { items: IntelligenceEvidence[] }) {
  return (
    <ul className="space-y-1">
      {items.map((e) => (
        <li key={e.id} className="flex gap-2 text-[12px] text-brand-700">
          <span className="w-28 shrink-0 font-semibold text-brand-500">{SOURCE_LABEL[e.source]}</span>
          <span>{e.text}</span>
        </li>
      ))}
    </ul>
  );
}

function FindingList({ findings, evidence }: { findings: IntelligenceFinding[]; evidence: Record<string, IntelligenceEvidence> }) {
  return (
    <ul className="divide-y divide-line">
      {findings.map((f) => (
        <li key={f.id} className="space-y-1.5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={SEVERITY_TONE[f.severity]}>{f.severity.toLowerCase()}</Pill>
            <Pill>{f.category.toLowerCase()}</Pill>
            {f.url && <span className="font-mono text-[11px] text-brand-500">{f.url}</span>}
          </div>
          <p className="text-[12.5px] font-medium text-brand-950">{f.what}</p>
          <Row label="Why it matters">{f.why}</Row>
          <Row label="Evidence">
            {f.evidenceIds.map((id) => evidence[id]).filter(Boolean).map((e) => `${SOURCE_LABEL[e.source]}: ${e.text}`).join(" · ")}
          </Row>
          <Row label="Action">{f.action}</Row>
          {f.expectedImpact && <Row label="Expected impact">{f.expectedImpact}</Row>}
          <Row label="Measure">{f.measurement.join(" ")}</Row>
          {f.fixIssueId && (
            <Link href="/fix-engine" className={cn("inline-block text-[12px] font-semibold text-accent-700 hover:underline")}>
              An AI fix is available → open Fix Engine
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-[12px] text-brand-700">
      <span className="font-semibold text-brand-500">{label}: </span>
      {children}
    </p>
  );
}
