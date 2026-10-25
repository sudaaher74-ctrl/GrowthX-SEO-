"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, CheckCircle2, FileText, Loader2, MapPin, Plus, Printer, Sparkles, Wrench, X } from "lucide-react";
import { ActionButton, Panel, Pill, StatusNote, relativeTime } from "@/components/ui/console";
import { SourceBadge } from "@/components/google/parts";
import { usePeriodDays, useWorkspace } from "@/hooks/use-growthx";
import {
  api,
  type BusinessTrafficContext,
  type GoogleReport,
  type GoogleReportLevel,
  type GoogleReportPriority,
  type LocationTrafficGap,
} from "@/lib/api-client";
import { download, themeColours } from "@/lib/competitor-report";
import { googleReportFilename, googleReportMarkdown, googleReportPrintableHtml } from "@/lib/google-improvement-report";

const LEVEL_TONE: Record<GoogleReportLevel, "bad" | "warn" | "default"> = { high: "bad", medium: "warn", low: "default" };
const SOURCE: Record<GoogleReportPriority["platform"], "GSC" | "GA4" | "GSC+GA4"> = { GSC: "GSC", GA4: "GA4", BOTH: "GSC+GA4" };

/**
 * The Traffic & Business Improvement Report: combines Website Audit business
 * understanding (offerings, service pages, target cities) with Search Console
 * and Analytics 4 telemetry, identifies target cities with 0 clicks or low
 * traffic, builds a quality improvement plan, and forwards actions to Fix Engine.
 */
export function ImprovementReportView() {
  const { projectId } = useWorkspace();
  const days = usePeriodDays();
  const queryClient = useQueryClient();
  const [cityInput, setCityInput] = useState("");
  const [extraCities, setExtraCities] = useState<string[]>([]);
  const [forwardedCount, setForwardedCount] = useState<number | null>(null);

  const saved = useQuery({
    queryKey: ["google-improvement-report-latest", projectId],
    queryFn: () => api.getLatestGoogleReport(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const baseCities = saved.data?.facts.business?.targetCities ?? [];
      const mergedCities = Array.from(new Set([...extraCities, ...baseCities])).filter(Boolean);
      return api.generateGoogleReport(projectId!, days, mergedCities.length > 0 ? mergedCities : undefined);
    },
    onSuccess: async (res) => {
      queryClient.setQueryData(["google-improvement-report-latest", projectId], res);
      const count =
        res.forwardedToFixEngine ??
        (res.analysis?.priorities.length ?? 0) +
          (res.facts.locationGaps?.filter((g) => g.status !== "ACTIVE").length ?? 0);
      setForwardedCount(Math.max(1, count));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["findings", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["growth-opportunities", projectId] }),
      ]);
    },
  });

  const data: GoogleReport | undefined = generateMutation.data ?? saved.data ?? undefined;
  const a = data?.analysis ?? null;
  const business: BusinessTrafficContext | null = data?.facts.business ?? null;
  const locationGaps: LocationTrafficGap[] = data?.facts.locationGaps ?? [];

  const activeTargetCities = Array.from(
    new Set([...(business?.targetCities ?? []), ...extraCities]),
  );

  const handleAddCity = () => {
    const trimmed = cityInput.trim();
    if (!trimmed) return;
    if (!activeTargetCities.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setExtraCities((prev) => [...prev, trimmed]);
    }
    setCityInput("");
  };

  const handleRemoveExtraCity = (city: string) => {
    setExtraCities((prev) => prev.filter((c) => c !== city));
  };

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
        title="Traffic & Business Improvement Report"
        subtitle={`Combines what Website Audit learned about your business (offerings, service pages, and target cities) with your last ${days} days of Search Console & GA4 traffic, detects target locations with 0 clicks, and forwards the action plan directly to Fix Engine → Traffic.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/fix-engine"
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/80 bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-950 hover:bg-brand-100 transition"
            >
              <Wrench size={12} />
              <span>Open Fix Engine (Traffic)</span>
            </Link>
            <ActionButton
              variant="primary"
              icon={generateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || !projectId}
            >
              {generateMutation.isPending ? "Analyzing business & traffic…" : data ? "Regenerate & forward to Fix Engine" : "Generate report & forward to Fix Engine"}
            </ActionButton>
          </div>
        }
        padded
      >
        {/* Target Cities / Where Business Wants Traffic input bar */}
        <div className="mb-4 rounded-xl border border-brand-200/60 bg-brand-50/60 p-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] font-semibold text-brand-950 flex items-center gap-1.5">
                <MapPin size={13} className="text-accent-600" />
                Where your business wants traffic (Target Cities & Service Areas)
              </p>
              <p className="text-[11.5px] text-brand-500">
                Cities detected from your Website Audit are listed below. Add any city or region where you do business to check if you are getting clicks from that area.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCity();
                  }
                }}
                placeholder="Add city (e.g. Nashik, Pune, Mumbai)…"
                className="h-8 w-56 rounded-lg border border-brand-200 bg-surface-1 px-3 text-[12px] text-brand-950 outline-none focus:border-primary-500"
              />
              <ActionButton icon={<Plus size={12} />} onClick={handleAddCity} disabled={!cityInput.trim()}>
                Add city
              </ActionButton>
            </div>
          </div>

          {activeTargetCities.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {activeTargetCities.map((city) => {
                const isExtra = extraCities.includes(city);
                return (
                  <span
                    key={city}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11.5px] font-medium text-brand-950"
                  >
                    <MapPin size={11} className="text-accent-600" />
                    <span>{city}</span>
                    {isExtra && (
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraCity(city)}
                        className="text-brand-400 hover:text-error-600"
                        aria-label={`Remove ${city}`}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {generateMutation.isPending ? (
          <p className="py-6 text-center text-[12px] text-brand-500">
            Analyzing your Website Audit business profile, target cities, Search Console clicks, and GA4 traffic, and forwarding the plan to Fix Engine…
          </p>
        ) : generateMutation.error ? (
          <p className="py-4 text-center text-[12px] text-error-600">{(generateMutation.error as Error).message}</p>
        ) : !data ? (
          <p className="py-6 text-center text-[12px] text-brand-500">
            {saved.isLoading
              ? "Looking for your last Traffic Report…"
              : "Press \"Generate report & forward to Fix Engine\" to analyze your business cities vs. traffic clicks and send the action plan to Fix Engine."}
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

      {/* Forwarded to Fix Engine Confirmation */}
      {(forwardedCount !== null || (data?.forwardedToFixEngine && data.forwardedToFixEngine > 0)) && (
        <StatusNote tone="good">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              <span>
                <strong>Forwarded to Fix Engine → Traffic tab:</strong>{" "}
                {forwardedCount ?? data?.forwardedToFixEngine} traffic &amp; city gap improvement actions are ready in your Fix Engine plan.
              </span>
            </span>
            <Link href="/fix-engine" className="inline-flex items-center gap-1 font-semibold underline">
              <span>View in Fix Engine → Traffic</span>
              <ArrowRight size={12} />
            </Link>
          </span>
        </StatusNote>
      )}

      {/* Business Understanding from Website Audit */}
      {business && (
        <Panel
          title="What Website Audit understands about your business"
          subtitle="Read from your crawled website pages, structured data, and business profile to evaluate traffic relevance and quality"
          actions={
            <Link href="/website" className="text-[12px] font-semibold text-accent-700 hover:underline">
              Open Website Audit →
            </Link>
          }
          padded
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-brand-200/60 bg-brand-50/50 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                <Building2 size={12} />
                <span>Business &amp; Niche</span>
              </div>
              <p className="mt-1 text-[13px] font-bold text-brand-950">
                {business.businessName || data?.facts.site || "Your Business"}
              </p>
              <p className="mt-0.5 text-[12px] text-brand-600">
                {business.industry || "Website business profile"}
              </p>
              {business.summary && (
                <p className="mt-2 text-[11.5px] leading-relaxed text-brand-500">
                  {business.summary}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-brand-200/60 bg-brand-50/50 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                Core Offerings &amp; Audited Pages ({business.pagesAudited})
              </p>
              {business.offerings.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {business.offerings.map((o) => (
                    <Pill key={o} tone="info">{o}</Pill>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-[12px] text-brand-500">
                  Run Website Audit to extract all product and service offerings.
                </p>
              )}
              {business.auditedPages.length > 0 && (
                <p className="mt-2.5 text-[11px] text-brand-400">
                  Key pages: {business.auditedPages.slice(0, 4).map((p) => p.path).join(", ")}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-brand-200/60 bg-brand-50/50 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                <MapPin size={12} />
                <span>Target Business Locations</span>
              </div>
              {business.targetCities.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {business.targetCities.map((c) => (
                    <Pill key={c} tone="good">{c}</Pill>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-[12px] text-brand-500">
                  {business.country || "Add your target cities above to track city-level clicks."}
                </p>
              )}
              <p className="mt-2.5 text-[11.5px] text-brand-500">
                Platform compares these business locations against your GA4 &amp; Search Console clicks below.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* Target City & Market Traffic Gap Analysis */}
      {locationGaps.length > 0 && (
        <Panel
          title={`Target City & Market Traffic Plan (${locationGaps.length})`}
          subtitle="Where your business operates vs. actual clicks and visitors — with our plan to capture missing local traffic and improve quality"
          padded
        >
          <div className="space-y-3">
            {locationGaps.map((gap) => (
              <div key={gap.location} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <MapPin size={14} className="text-accent-600" />
                  <p className="text-[13.5px] font-bold text-brand-950">{gap.location}</p>
                  <Pill
                    tone={
                      gap.status === "NO_CLICKS"
                        ? "bad"
                        : gap.status === "LOW_TRAFFIC"
                          ? "warn"
                          : "good"
                    }
                  >
                    {gap.status === "NO_CLICKS"
                      ? "0 clicks from this area — Action Needed"
                      : gap.status === "LOW_TRAFFIC"
                        ? "Low traffic from this area"
                        : "Active traffic"}
                  </Pill>
                  <Pill tone="info">Forwarded to Fix Engine</Pill>
                  <span className="ml-auto font-mono text-[11.5px] text-brand-500">
                    {gap.searchClicks} search clicks · {gap.searchImpressions} impressions · {gap.sessions} GA4 sessions
                  </span>
                </div>

                <p className="mt-2 text-[12px] text-brand-600">
                  <span className="font-semibold text-brand-950">What we found: </span>
                  {gap.finding}
                </p>
                <p className="mt-1 text-[12px] text-brand-600">
                  <span className="font-semibold text-brand-950">Quality &amp; Traffic Plan: </span>
                  {gap.plan}
                </p>

                {gap.recommendedSteps.length > 0 && (
                  <>
                    <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wide text-brand-400">
                      Steps to win traffic in {gap.location}
                    </p>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[12px] text-brand-950">
                      {gap.recommendedSteps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

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
