"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, Printer, Sparkles } from "lucide-react";
import { ActionButton, Panel, Pill, relativeTime } from "@/components/ui/console";
import { SourceBadge } from "@/components/google/parts";
import { usePeriodDays, useWorkspace } from "@/hooks/use-growthx";
import { api, type GoogleReport, type GoogleReportLevel, type GoogleReportPriority } from "@/lib/api-client";
import { download, themeColours } from "@/lib/competitor-report";
import { googleReportFilename, googleReportMarkdown, googleReportPrintableHtml } from "@/lib/google-improvement-report";

const LEVEL_TONE: Record<GoogleReportLevel, "bad" | "warn" | "default"> = { high: "bad", medium: "warn", low: "default" };
const SOURCE: Record<GoogleReportPriority["platform"], "GSC" | "GA4" | "GSC+GA4"> = { GSC: "GSC", GA4: "GA4", BOTH: "GSC+GA4" };

/**
 * The improvement report: Sarvam reads everything stored from Search Console
 * and Analytics 4 and says where the site stands and what to do first. Never
 * generated on its own, because each run spends model tokens; the last one is
 * shown after a reload.
 */
export function ImprovementReportView() {
  const { projectId } = useWorkspace();
  const days = usePeriodDays();

  // A query rather than a mutation so the report survives moving between pages.
  const report = useQuery({
    queryKey: ["google-improvement-report", projectId, days],
    queryFn: () => api.generateGoogleReport(projectId!, days),
    enabled: false,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
  const saved = useQuery({
    queryKey: ["google-improvement-report-latest", projectId],
    queryFn: () => api.getLatestGoogleReport(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: false,
  });
  const data: GoogleReport | undefined = report.data ?? saved.data ?? undefined;
  const a = data?.analysis ?? null;

  const printReport = (r: GoogleReport) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(googleReportPrintableHtml(r, themeColours()));
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Google improvement report"
        subtitle={`Sarvam reads your Search Console and Analytics 4 figures for the last ${days} days, says where you stand, and lists what to do first. It uses measured data only.`}
        actions={
          <ActionButton
            variant="primary"
            icon={report.isFetching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            onClick={() => report.refetch()}
            disabled={report.isFetching || !projectId}
          >
            {report.isFetching ? "Writing report…" : data ? "Regenerate" : "Generate report"}
          </ActionButton>
        }
        padded
      >
        {report.isFetching ? (
          <p className="py-6 text-center text-[12px] text-brand-500">Sarvam is reading your Google data. This can take up to a minute.</p>
        ) : report.error ? (
          <p className="py-4 text-center text-[12px] text-error-600">{(report.error as Error).message}</p>
        ) : !data ? (
          <p className="py-6 text-center text-[12px] text-brand-500">
            {saved.isLoading ? "Looking for your last report…" : "Press Generate report. You can then download it or print it to PDF."}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-brand-400">
              Generated {relativeTime(data.generatedAt)} · last {data.facts.days} days{data.model ? ` · ${data.model}` : ""}
            </span>
            <span className="ml-auto flex flex-wrap gap-2">
              <ActionButton icon={<FileText size={13} />} onClick={() => download(googleReportFilename(data, "md"), googleReportMarkdown(data), "text/markdown")}>
                Report (.md)
              </ActionButton>
              <ActionButton icon={<Printer size={13} />} onClick={() => printReport(data)}>
                Print / PDF
              </ActionButton>
            </span>
          </div>
        )}
      </Panel>

      {data && !a && (
        <Panel padded>
          <p className="text-[12px] text-warning-600">
            {data.analysisError ?? "The analysis could not be written."}{" "}
            {!data.facts.searchConsole.connected || !data.facts.analytics.connected ? (
              <Link href="/integrations" className="font-semibold underline">Open Integrations</Link>
            ) : null}
          </p>
        </Panel>
      )}

      {a && (
        <>
          <Panel title="Summary" padded>
            <p className="text-[13px] leading-relaxed text-brand-950">{a.executiveSummary || "No summary returned."}</p>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <WhereWeAre title="Search Console" source="GSC" side={a.whereWeAre.searchConsole} href="/google/search-console" />
            <WhereWeAre title="Analytics 4" source="GA4" side={a.whereWeAre.analytics} href="/google/analytics" />
          </div>

          {a.marketingStrategy && <MarketingStrategyPanels strategy={a.marketingStrategy} />}

          <Panel title={`What to do, in order (${a.priorities.length})`} subtitle="First item first: high impact and low effort come before the rest." padded>
            {a.priorities.length === 0 && <p className="text-[12px] text-brand-500">No actions returned.</p>}
            <ol className="space-y-3">
              {a.priorities.map((p) => (
                <li key={`${p.rank}-${p.title}`} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 font-mono text-[11px] font-semibold text-white">{p.rank}</span>
                    <p className="text-[13px] font-semibold text-brand-950">{p.title}</p>
                    <SourceBadge source={SOURCE[p.platform]} />
                    <Pill tone={LEVEL_TONE[p.priority]}>{p.priority} priority</Pill>
                    <span className="ml-auto text-[11px] text-brand-400">Impact: {p.impact} · Effort: {p.effort}</span>
                  </div>
                  {p.evidence && (
                    <p className="mt-2 text-[12px] text-brand-600"><span className="font-semibold text-brand-950">Evidence: </span>{p.evidence}</p>
                  )}
                  {p.whyItMatters && (
                    <p className="mt-1 text-[12px] text-brand-600"><span className="font-semibold text-brand-950">Why it matters: </span>{p.whyItMatters}</p>
                  )}
                  {p.steps.length > 0 && (
                    <>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-brand-400">Steps</p>
                      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[12px] text-brand-950">
                        {p.steps.map((s, n) => <li key={n}>{s}</li>)}
                      </ol>
                    </>
                  )}
                  {p.measureBy && (
                    <p className="mt-2 text-[12px] text-brand-600"><span className="font-semibold text-brand-950">Measure by: </span>{p.measureBy}</p>
                  )}
                </li>
              ))}
            </ol>
          </Panel>

          {a.quickWins.length > 0 && (
            <Panel title="Quick wins" subtitle="Under an hour each" padded>
              <ul className="list-disc space-y-0.5 pl-5 text-[12px] text-brand-950">
                {a.quickWins.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </Panel>
          )}

          {a.plan.length > 0 && (
            <Panel title="4-week plan" padded>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                {a.plan.map((w) => (
                  <div key={w.week} className="rounded-xl border bg-brand-50 p-3">
                    <p className="text-[12px] font-semibold text-brand-950">{w.week}</p>
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[12px] text-brand-600">
                      {w.actions.map((x) => <li key={x}>{x}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {a.dataGaps.length > 0 && (
            <Panel title="Not measured yet" padded>
              <ul className="list-disc space-y-0.5 pl-5 text-[12px] text-brand-600">
                {a.dataGaps.map((g) => <li key={g}>{g}</li>)}
              </ul>
            </Panel>
          )}
        </>
      )}

      {data && (
        <Panel title="Figures the report used" subtitle="Read from the stored Search Console and Analytics 4 data. Included in the download." padded>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-[12px] text-brand-600 sm:grid-cols-2">
            {data.facts.kpis.map((k) => (
              <li key={`${k.source}-${k.label}`} className="flex items-center gap-2">
                <SourceBadge source={k.source} />
                <span>{k.label}:</span>
                <span className="font-mono font-semibold text-brand-950">{k.value === null ? "not measured" : k.format === "percent" ? `${(k.value * 100).toFixed(1)}%` : k.format === "position" ? k.value.toFixed(1) : Math.round(k.value).toLocaleString("en-US")}</span>
                {k.change && <span className="text-brand-400">{k.change}</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

const VERDICT: Record<"grow" | "fix" | "start" | "maintain", { label: string; tone: "good" | "bad" | "warn" | "default" }> = {
  grow: { label: "Grow", tone: "good" },
  fix: { label: "Fix", tone: "bad" },
  start: { label: "Start", tone: "warn" },
  maintain: { label: "Keep going", tone: "default" },
};

type Strategy = NonNullable<NonNullable<GoogleReport["analysis"]>["marketingStrategy"]>;

/** Where the traffic comes from, and the marketing plan that follows from it, channel by channel. */
function MarketingStrategyPanels({ strategy: m }: { strategy: Strategy }) {
  if (!m.summary && m.channels.length === 0 && m.whereTrafficComesFrom.length === 0) return null;
  return (
    <>
      <Panel title="Where your traffic comes from" subtitle="Measured by Google Analytics 4, read by Sarvam" padded>
        {m.summary && <p className="text-[13px] leading-relaxed text-brand-950">{m.summary}</p>}
        {m.whereTrafficComesFrom.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12px] text-brand-600">
            {m.whereTrafficComesFrom.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}
        {m.audience.length > 0 && (
          <>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-brand-400">Who and where</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12px] text-brand-600">
              {m.audience.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </>
        )}
      </Panel>

      {m.channels.length > 0 && (
        <Panel title={`Marketing strategy by channel (${m.channels.length})`} subtitle="What to do with each place your visitors come from, or should come from" padded>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {m.channels.map((c) => (
              <div key={c.channel} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-semibold text-brand-950">{c.channel}</p>
                  <Pill tone={VERDICT[c.verdict].tone}>{VERDICT[c.verdict].label}</Pill>
                  <span className="ml-auto font-mono text-[11px] text-brand-400">{c.share}</span>
                </div>
                {c.whatWeSee && <p className="mt-2 text-[12px] text-brand-600"><span className="font-semibold text-brand-950">What we see: </span>{c.whatWeSee}</p>}
                {c.strategy && <p className="mt-1 text-[12px] text-brand-600"><span className="font-semibold text-brand-950">Strategy: </span>{c.strategy}</p>}
                {c.actions.length > 0 && (
                  <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[12px] text-brand-950">
                    {c.actions.map((x, n) => <li key={n}>{x}</li>)}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}

function WhereWeAre({ title, source, side, href }: { title: string; source: "GSC" | "GA4"; side: { verdict: string; points: string[] }; href: string }) {
  return (
    <Panel
      title={`Where you are: ${title}`}
      actions={<Link href={href} className="text-[12px] font-semibold text-accent-700 hover:underline">Open {title} →</Link>}
      padded
    >
      <div className="mb-2"><SourceBadge source={source} /></div>
      <p className="text-[13px] font-medium text-brand-950">{side.verdict || "Nothing to report."}</p>
      {side.points.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12px] text-brand-600">
          {side.points.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
    </Panel>
  );
}
