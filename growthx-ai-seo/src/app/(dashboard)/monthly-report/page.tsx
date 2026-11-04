"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api-client";
import { usePortfolio, useWorkspace } from "@/hooks/use-growthx";
import { ActionButton, PageHeader, Panel } from "@/components/ui/console";
import type { Ga4Point, GscPoint } from "@/lib/api-types";

const monthKey = (date: Date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
const nowMonth = () => monthKey(new Date());
const priorMonth = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return monthKey(new Date(year, number - 2, 1));
};
const daysInMonth = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return new Date(year, number, 0).getDate();
};
const format = (value: number) => new Intl.NumberFormat().format(value);
const rowsFor = <T extends { date: string }>(rows: T[], month: string) => rows.filter((row) => row.date.slice(0, 7) === month);
const countDays = <T extends { date: string }>(rows: T[]) => new Set(rows.map((row) => row.date)).size;
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function LineTrend({ title, subtitle, rows, first, second, separateScale = false, loading, error }: {
  title: string; subtitle: string; rows: { date: string; a: number | null; b?: number | null }[];
  first: string; second?: string; separateScale?: boolean; loading: boolean; error: boolean;
}) {
  return <Panel title={title} subtitle={subtitle} padded>
    {loading ? <p className="text-[12px] text-brand-500">Loading…</p> : error ? <p className="text-[12px] text-error-700">Source unavailable.</p> : !rows.some((row) => row.a !== null) ?
      <p className="py-10 text-center text-[12px] text-brand-500">No recorded measurements for this month.</p> : <>
        <div className="h-52" role="img" aria-label={`${title} by date; gaps mean no recorded measurement`}><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 4" vertical={false} /><XAxis dataKey="date" tickFormatter={(date: string) => date.slice(8)} minTickGap={16} tick={{ fontSize: 11 }} /><YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />{separateScale && <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />}<Tooltip formatter={(value, name) => [format(Number(value)), name === "a" ? first : second]} />
          <Line yAxisId="left" dataKey="a" name="a" stroke="var(--color-series-1)" strokeWidth={2.5} dot={{ r: 2 }} connectNulls={false} />
          {second && <Line yAxisId={separateScale ? "right" : "left"} dataKey="b" name="b" stroke="var(--color-series-2)" strokeWidth={2.5} dot={{ r: 2 }} connectNulls={false} />}
        </LineChart></ResponsiveContainer></div>
        <p className="mt-2 text-[11px] text-brand-500">Blue: {first}{second ? ` · Cyan: ${second}` : ""}{separateScale ? " (right axis)" : ""}. Gaps are unrecorded days.</p>
      </>}
  </Panel>;
}

function dailyRows<T extends { date: string }>(month: string, rows: T[], pickA: (row: T) => number, pickB?: (row: T) => number) {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const end = month === nowMonth() ? new Date().getDate() : daysInMonth(month);
  return Array.from({ length: end }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    const row = byDate.get(date);
    return { date, a: row ? pickA(row) : null, b: row && pickB ? pickB(row) : null };
  });
}

function Metric({ title, rows, previous, pick, expected, previousExpected, loading, error }: {
  title: string; rows: { date: string }[]; previous: { date: string }[];
  pick: (row: { date: string }) => number; expected: number; previousExpected: number;
  loading: boolean; error: boolean;
}) {
  const total = rows.reduce((value, row) => value + pick(row), 0);
  const prior = previous.reduce((value, row) => value + pick(row), 0);
  const complete = countDays(rows) === expected && countDays(previous) === previousExpected;
  return <div className="rounded-xl border bg-white p-4 shadow-card">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">{title}</p>
    {loading ? <p className="mt-3 text-brand-500">Loading…</p> : error ? <p className="mt-3 text-error-700">Source unavailable</p> : <>
      <p className="mt-2 font-mono text-[27px] font-bold text-brand-950">{rows.length ? format(total) : "—"}</p>
      <p className="text-[12px] text-brand-500">{countDays(rows)} of {expected} days recorded</p>
      {complete ? <p className="mt-2 text-[12px] font-medium text-brand-700">{total - prior >= 0 ? "+" : ""}{format(total - prior)} vs previous month</p> :
        <p className="mt-2 text-[12px] text-brand-500">Previous month: {previous.length ? format(prior) : "—"} ({countDays(previous)}/{previousExpected} days). Comparison needs complete daily coverage.</p>}
    </>}
  </div>;
}

export default function MonthlyReport() {
  const { projectId, orgId, projects } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const project = projects.find((item) => item.id === projectId);
  const domain = portfolio.data?.clients.find((item) => item.projectId === projectId)?.domain;
  const [month, setMonth] = useState(nowMonth);
  const prior = priorMonth(month);
  const search = useQuery({ queryKey: ["monthly-search", projectId], queryFn: () => api.gscTimeseries(projectId!, 400), enabled: !!projectId, retry: false });
  const traffic = useQuery({ queryKey: ["monthly-traffic", projectId], queryFn: () => api.ga4Timeseries(projectId!, 400), enabled: !!projectId, retry: false });
  const visibility = useQuery({ queryKey: ["monthly-visibility", projectId], queryFn: () => api.getVisibility(projectId!, 28), enabled: !!projectId, retry: false });
  const competitors = useQuery({ queryKey: ["monthly-competitors", projectId], queryFn: () => api.getLatestCompetitorReport(projectId!), enabled: !!projectId, retry: false });
  const changes = useQuery({ queryKey: ["monthly-changes", projectId], queryFn: () => api.listFixChanges(projectId!), enabled: !!projectId, retry: false });
  const crawls = useQuery({ queryKey: ["monthly-crawls", domain], queryFn: () => api.getCrawlHistory(domain!, 60), enabled: !!domain, retry: false });
  const searchRows = rowsFor(search.data ?? [], month);
  const trafficRows = rowsFor(traffic.data ?? [], month);
  const priorSearch = rowsFor(search.data ?? [], prior);
  const priorTraffic = rowsFor(traffic.data ?? [], prior);
  const monthCrawls = (crawls.data ?? []).filter((crawl) => crawl.finishedAt?.slice(0, 7) === month);
  const merged = (changes.data ?? []).filter((run) => run.reviewState === "MERGED" && run.mergedAt?.slice(0, 7) === month);
  const competitorWork = merged.flatMap((run) => run.changes.filter((change) => change.sourceModule === "COMPETITOR").map((change) => ({ ...change, pr: run.pullRequestUrl })));
  const live = (changes.data ?? []).flatMap((run) => run.changes
    .filter((change) => change.verification === "MATCHED" && change.checkedAt?.slice(0, 7) === month)
    .map((change) => ({ ...change, pr: run.pullRequestUrl })));
  // The visibility API returns the latest scan regardless of its days parameter.
  // Only timestamped trend points can be assigned to a selected calendar month.
  const aiScans = (visibility.data?.trend ?? []).filter((point) => point.weekStart.slice(0, 7) === month && point.checked > 0);
  const latestAiScan = (visibility.data?.trend ?? []).at(-1)?.weekStart;
  const recommendationIsThisMonth = latestAiScan?.slice(0, 7) === month;
  const competitorIsThisMonth = competitors.data?.generatedAt.slice(0, 7) === month;
  const rivalFacts = competitors.data?.facts;
  const rivalBars = [rivalFacts?.you && { label: "Your site", pages: rivalFacts.you.pagesCrawled, crawledAt: rivalFacts.you.crawledAt }, ...(rivalFacts?.rivals ?? []).map((rival) => ({ label: rival.domain, pages: rival.pagesCrawled, crawledAt: rival.crawledAt }))].filter((row): row is { label: string; pages: number; crawledAt: string | null } => !!row && row.pages !== null && row.pages !== undefined);
  const maxRivalPages = Math.max(1, ...rivalBars.map((row) => row.pages));
  const expected = month === nowMonth() ? new Date().getDate() : daysInMonth(month);
  const first = new Date();
  first.setMonth(first.getMonth() - 11);
  const [year, number] = month.split("-").map(Number);
  const title = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(year, number - 1, 1));

  return <main id="report-root" className="space-y-5 pb-12">
    <PageHeader title="Monthly report" subtitle={"Recorded work and results for " + (project?.name ?? "your website") + " in " + title}
      actions={<div className="no-print flex flex-wrap items-center gap-2">
        <label className="text-[12px] text-brand-600">Month <input aria-label="Report month" type="month" value={month} min={monthKey(first)} max={nowMonth()} onChange={(event) => setMonth(event.target.value)} className="ml-2 rounded-lg border bg-white p-2 text-brand-950" /></label>
        <ActionButton onClick={() => window.print()}>Print or save PDF</ActionButton>
      </div>} />
    <p className="rounded-xl border bg-white p-4 text-[12px] text-brand-600 shadow-card"><strong className="text-brand-950">Reading this report:</strong> Charts show recorded data from connected sources. Missing days are gaps, not zero. Changes in results do not prove a fix caused them.</p>
    {!projectId ? <Panel padded>Select a website to see its report.</Panel> : <>
      <section className="report-section grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Monthly results">
        <Metric title="Search clicks" rows={searchRows} previous={priorSearch} pick={(row) => "clicks" in row ? Number(row.clicks) : 0} expected={expected} previousExpected={daysInMonth(prior)} loading={search.isLoading} error={search.isError} />
        <Metric title="Search impressions" rows={searchRows} previous={priorSearch} pick={(row) => "impressions" in row ? Number(row.impressions) : 0} expected={expected} previousExpected={daysInMonth(prior)} loading={search.isLoading} error={search.isError} />
        <Metric title="Website sessions" rows={trafficRows} previous={priorTraffic} pick={(row) => "sessions" in row ? Number(row.sessions) : 0} expected={expected} previousExpected={daysInMonth(prior)} loading={traffic.isLoading} error={traffic.isError} />
        <div className="rounded-xl border bg-white p-4 shadow-card"><p className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">Daily active visitors</p><p className="mt-2 font-mono text-[27px] font-bold text-brand-950">{traffic.isLoading ? "…" : traffic.isError || !trafficRows.length ? "—" : format(Math.max(...trafficRows.map((row) => row.users)))}</p><p className="text-[12px] text-brand-500">Highest recorded day · GA4 users cannot be added across days</p></div>
      </section>
      <section className="report-section space-y-3" aria-label="Search and visitor trends">
        <div><h2 className="text-lg font-semibold text-brand-950">Search and visitors over time</h2><p className="text-[12px] text-brand-500">Daily Google Search Console and Analytics 4 measurements.</p></div>
        <div className="grid gap-4 lg:grid-cols-2">
          <LineTrend title="Visitors and sessions" subtitle="Google Analytics 4" rows={dailyRows(month, trafficRows as Ga4Point[], (row) => row.sessions, (row) => row.users)} first="Sessions" second="Active users" loading={traffic.isLoading} error={traffic.isError} />
          <LineTrend title="Google search activity" subtitle="Google Search Console" rows={dailyRows(month, searchRows as GscPoint[], (row) => row.clicks, (row) => row.impressions)} first="Clicks" second="Impressions" separateScale loading={search.isLoading} error={search.isError} />
        </div>
      </section>
      <section className="report-section space-y-3" aria-label="AI answer visibility">
        <div><h2 className="text-lg font-semibold text-brand-950">AI answer visibility</h2><p className="text-[12px] text-brand-500">Measured brand mentions in sampled AI answers. A mention is not a guarantee of endorsement or consumer app placement.</p></div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="AI mention trend" subtitle="Completed scans in the selected month · up to 8 recent scans available" padded>
            {visibility.isLoading ? <p className="text-[12px] text-brand-500">Loading…</p> : visibility.isError ? <p className="text-[12px] text-error-700">AI check history unavailable.</p> : aiScans.length === 0 ? <p className="py-10 text-center text-[12px] text-brand-500">No completed AI scans available for {title}.</p> :
              <div className="h-52" role="img" aria-label="Percentage of sampled AI answers naming your brand at each scan"><ResponsiveContainer width="100%" height="100%"><LineChart data={aiScans.map((point) => ({ date: point.weekStart.slice(0, 10), share: point.citationSharePct }))}><CartesianGrid strokeDasharray="3 4" vertical={false} /><XAxis dataKey="date" tickFormatter={(date: string) => date.slice(5)} tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => [`${value}%`, "Brand named"]} /><Line dataKey="share" stroke="var(--color-series-1)" strokeWidth={2.5} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>}
            <p className="mt-2 text-[11px] text-brand-500">Each point is a scan snapshot, not a daily average.</p>
          </Panel>
          <Panel title="Latest recommendation check" subtitle={latestAiScan ? `Snapshot from ${dateLabel(latestAiScan)}` : "No completed scan"} padded>
            {!recommendationIsThisMonth ? <p className="py-10 text-center text-[12px] text-brand-500">No latest recommendation snapshot from {title}.</p> : <>
              <p className="text-[13px] text-brand-700">Your brand was named in <strong className="text-brand-950">{visibility.data?.customerJourney?.recommendation.cited ?? 0} of {visibility.data?.customerJourney?.recommendation.checked ?? 0}</strong> successful recommendation-stage answers.</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100"><div className="h-full rounded-full bg-primary-600" style={{ width: `${visibility.data?.customerJourney?.recommendation.citationSharePct ?? 0}%` }} /></div>
              <p className="mt-2 text-[12px] font-semibold text-brand-950">{visibility.data?.customerJourney?.recommendation.checked ? `${visibility.data.customerJourney.recommendation.citationSharePct}% of sampled answers` : "No recommendation-stage answers measured"}</p>
              <div className="mt-4 space-y-2 border-t pt-3">{(visibility.data?.byAssistant ?? []).filter((model) => model.checked > 0).map((model) => <div key={model.assistant} className="flex justify-between gap-2 text-[12px]"><span>{model.assistant}</span><span>{model.cited}/{model.checked} named your brand</span></div>)}</div>
              <p className="mt-3 text-[11px] text-brand-500">Latest scan only. Model rows include every prompt type; the recommendation figure uses recommendation-stage prompts.</p>
            </>}
          </Panel>
        </div>
      </section>
      <section className="report-section space-y-3" aria-label="Competitor comparison">
        <div><h2 className="text-lg font-semibold text-brand-950">Competitor comparison</h2><p className="text-[12px] text-brand-500">What our crawler could read, not Google rankings or market share.</p></div>
        <Panel title="Pages read across sites" subtitle={competitorIsThisMonth ? `Latest snapshot · ${dateLabel(competitors.data!.generatedAt)}` : `No competitor snapshot generated in ${title}`} padded>
          {competitors.isLoading ? <p className="text-[12px] text-brand-500">Loading…</p> : competitors.isError ? <p className="text-[12px] text-error-700">Competitor evidence unavailable.</p> : !competitorIsThisMonth || !rivalBars.length ? <p className="py-8 text-center text-[12px] text-brand-500">No crawl-based comparison available for this month.</p> : <div className="grid gap-4 sm:grid-cols-2">{rivalBars.map((rival) => <div key={rival.label}><div className="flex justify-between gap-2 text-[12px]"><span className="truncate font-medium text-brand-950">{rival.label}</span><span>{format(rival.pages)} pages</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-100"><div className="h-full rounded-full bg-primary-600" style={{ width: `${Math.max(1, rival.pages / maxRivalPages * 100)}%` }} /></div><p className="mt-1 text-[10px] text-brand-500">{rival.crawledAt ? `Crawled ${dateLabel(rival.crawledAt)}` : "Crawl date unavailable"}</p></div>)}</div>}
          <p className="mt-3 text-[11px] text-brand-500">Sites may have different crawl limits or coverage. More pages read does not mean better performance. Historical competitor improvement is not available from this snapshot.</p>
        </Panel>
        <Panel title="Competitor-informed work" subtitle="Merged changes linked to Competitor Intelligence findings" padded>
          {changes.isLoading ? <p className="text-[12px] text-brand-500">Loading…</p> : changes.isError ? <p className="text-[12px] text-error-700">Change history unavailable.</p> : competitorWork.length === 0 ? <p className="py-5 text-[12px] text-brand-500">No competitor-linked code changes found in the available recent history for {title}. The comparison above shows opportunities, not completed improvements.</p> : <div className="space-y-3">{competitorWork.map((change, index) => <div key={`${change.issueId}-${index}`} className="border-t pt-3 text-[12px]"><p className="font-semibold text-brand-950">{change.findingTitle || change.field}</p><p className="mt-1 break-all text-brand-500">{change.url}</p><p className="mt-1 text-brand-700">{change.verification === "MATCHED" ? "Recorded change matched on the live page" : "Pull request merged; live effect not confirmed"}</p>{change.pr && <a href={change.pr} target="_blank" rel="noreferrer" className="text-primary-700 underline">View pull request</a>}</div>)}</div>}
          <p className="mt-3 text-[11px] text-brand-500">A merged change or live field match does not show that rankings or traffic improved against a competitor.</p>
        </Panel>
      </section>
      <section className="report-section"><Panel title="Website audit activity" subtitle="Completed crawl snapshots" padded>
        {crawls.isLoading ? <p className="text-[12px] text-brand-500">Loading…</p> : crawls.isError ? <p className="text-[12px] text-error-700">Crawl history unavailable.</p> : monthCrawls.length === 0 ? <p className="text-[12px] text-brand-500">No completed crawl recorded this month.</p> :
          <div className="space-y-2">{monthCrawls.map((crawl) => <div key={crawl.id} className="flex flex-wrap justify-between gap-2 border-t py-2 text-[12px] text-brand-700"><span>{new Date(crawl.finishedAt!).toLocaleDateString()}</span><span>{format(crawl.pagesCrawled)} pages scanned · {format(crawl.issuesFound)} findings</span></div>)}</div>}
        <p className="mt-2 text-[11px] text-brand-500">Crawls can cover different pages. Finding counts alone do not establish improvement. Older crawl history may be absent.</p>
      </Panel></section>
      <section className="report-section"><Panel title="What changed this month" subtitle="Recorded GitHub work and live verification" padded>
        {changes.isLoading ? <p className="text-[12px] text-brand-500">Loading…</p> : changes.isError ? <p className="text-[12px] text-error-700">Change history unavailable.</p> : <>
          <p className="text-[13px] font-semibold text-brand-950">{merged.length} merged pull requests · {live.length} live checks matched in the available history</p>
          <p className="mt-1 text-[11px] text-brand-500">This section uses recent Fix Engine runs only. Older work may be absent. A live check confirms one field on one page, not the entire issue or business impact.</p>
          {merged.length === 0 && live.length === 0 ? <p className="mt-3 text-[12px] text-brand-500">No work found in the available history for this month.</p> : <div className="mt-3 space-y-2">
            {merged.map((run) => <details key={run.id} className="rounded-lg border p-3 text-[12px] text-brand-700"><summary className="cursor-pointer font-medium text-brand-950">{dateLabel(run.mergedAt!)} · {run.changes.length} proposed changes · {run.filesChanged.length} files</summary><div className="mt-2 space-y-2">{run.pullRequestUrl && <a className="text-primary-700 underline" href={run.pullRequestUrl} target="_blank" rel="noreferrer">View GitHub pull request</a>}{run.changes.map((change, index) => <div key={change.issueId + change.url + index} className="rounded-lg border p-2"><p className="font-medium text-brand-950">{change.findingTitle || change.field}</p><p className="break-all text-brand-500">{change.url}</p><p>Before: {change.before ?? "Not recorded"}</p><p>Proposed: {change.after}</p><p className="text-brand-500">Live check: {change.verification === "MATCHED" ? "Matched" : change.verification === "DIFFERENT" ? "Different" : change.verification === "UNSUPPORTED" ? "Unsupported" : "Not checked"}</p></div>)}</div></details>)}
            {merged.length === 0 && live.length > 0 && <p className="text-[12px] text-brand-500">Live checks were recorded, but no merged pull request appears in the available recent history.</p>}
          </div>}
        </>}
      </Panel></section>
      <p className="text-[11px] text-brand-500">Available reporting window: last 12 calendar months. Totals sum only dates returned by connected sources. Unique users, rates, and rankings are not summed.</p>
    </>}
  </main>;
}
