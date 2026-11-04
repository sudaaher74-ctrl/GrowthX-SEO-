"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api-client";
import { usePortfolio, useWorkspace } from "@/hooks/use-growthx";
import { ActionButton, PageHeader, Panel } from "@/components/ui/console";

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

function Trend({ title, rows, pick, loading, error }: {
  title: string; rows: { date: string }[]; pick: (row: { date: string }) => number;
  loading: boolean; error: boolean;
}) {
  return <Panel title={title} subtitle="Recorded values by day" padded>
    {loading ? <p className="text-[12px] text-brand-500">Loading…</p> : error ? <p className="text-[12px] text-error-700">Source unavailable.</p> : rows.length === 0 ?
      <p className="text-[12px] text-brand-500">No recorded days for this month.</p> :
      <div className="h-48" role="img" aria-label={title + " by day"}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows.map((row) => ({ date: row.date, value: pick(row) }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(date: string) => date.slice(8, 10)} />
            <YAxis allowDecimals={false} width={40} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--color-series-1)" />
          </BarChart>
        </ResponsiveContainer>
      </div>}
  </Panel>;
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
  const changes = useQuery({ queryKey: ["monthly-changes", projectId], queryFn: () => api.listFixChanges(projectId!), enabled: !!projectId, retry: false });
  const crawls = useQuery({ queryKey: ["monthly-crawls", domain], queryFn: () => api.getCrawlHistory(domain!, 60), enabled: !!domain, retry: false });
  const searchRows = rowsFor(search.data ?? [], month);
  const trafficRows = rowsFor(traffic.data ?? [], month);
  const priorSearch = rowsFor(search.data ?? [], prior);
  const priorTraffic = rowsFor(traffic.data ?? [], prior);
  const monthCrawls = (crawls.data ?? []).filter((crawl) => crawl.finishedAt?.slice(0, 7) === month);
  const merged = (changes.data ?? []).filter((run) => run.reviewState === "MERGED" && run.mergedAt?.slice(0, 7) === month);
  const live = (changes.data ?? []).flatMap((run) => run.changes
    .filter((change) => change.verification === "MATCHED" && change.checkedAt?.slice(0, 7) === month)
    .map((change) => ({ ...change, pr: run.pullRequestUrl })));
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
    <p className="text-[12px] text-brand-500">Results come from connected sources. A change in results does not prove a fix caused it. Missing days are not treated as zero.</p>
    {!projectId ? <Panel padded>Select a website to see its report.</Panel> : <>
      <section className="report-section grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Monthly results">
        <Metric title="Search clicks" rows={searchRows} previous={priorSearch} pick={(row) => "clicks" in row ? Number(row.clicks) : 0} expected={expected} previousExpected={daysInMonth(prior)} loading={search.isLoading} error={search.isError} />
        <Metric title="Search impressions" rows={searchRows} previous={priorSearch} pick={(row) => "impressions" in row ? Number(row.impressions) : 0} expected={expected} previousExpected={daysInMonth(prior)} loading={search.isLoading} error={search.isError} />
        <Metric title="Website sessions" rows={trafficRows} previous={priorTraffic} pick={(row) => "sessions" in row ? Number(row.sessions) : 0} expected={expected} previousExpected={daysInMonth(prior)} loading={traffic.isLoading} error={traffic.isError} />
        <div className="rounded-xl border bg-white p-4 shadow-card"><p className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">Website audits</p><p className="mt-2 font-mono text-[27px] font-bold text-brand-950">{crawls.isLoading ? "…" : crawls.isError ? "—" : monthCrawls.length}</p><p className="text-[12px] text-brand-500">Completed crawls this month</p></div>
      </section>
      <section className="report-section grid gap-4 lg:grid-cols-2" aria-label="Daily trends">
        <Trend title="Search clicks" rows={searchRows} pick={(row) => "clicks" in row ? Number(row.clicks) : 0} loading={search.isLoading} error={search.isError} />
        <Trend title="Website sessions" rows={trafficRows} pick={(row) => "sessions" in row ? Number(row.sessions) : 0} loading={traffic.isLoading} error={traffic.isError} />
      </section>
      <section className="report-section"><Panel title="Website audit activity" subtitle="Completed crawl snapshots" padded>
        {crawls.isLoading ? <p className="text-[12px] text-brand-500">Loading…</p> : crawls.isError ? <p className="text-[12px] text-error-700">Crawl history unavailable.</p> : monthCrawls.length === 0 ? <p className="text-[12px] text-brand-500">No completed crawl recorded this month.</p> :
          <div className="space-y-2">{monthCrawls.map((crawl) => <div key={crawl.id} className="flex flex-wrap justify-between gap-2 border-t py-2 text-[12px] text-brand-700"><span>{new Date(crawl.finishedAt!).toLocaleDateString()}</span><span>{format(crawl.pagesCrawled)} pages scanned · {format(crawl.issuesFound)} findings</span></div>)}</div>}
        <p className="mt-2 text-[11px] text-brand-500">Crawls can cover different pages. Finding counts alone do not establish improvement. Older crawl history may be absent.</p>
      </Panel></section>
      <section className="report-section"><Panel title="Work recorded this month" subtitle="Merged pull requests and live checks" padded>
        {changes.isLoading ? <p className="text-[12px] text-brand-500">Loading…</p> : changes.isError ? <p className="text-[12px] text-error-700">Change history unavailable.</p> : <>
          <p className="text-[13px] font-semibold text-brand-950">{merged.length} merged pull requests · {live.length} live checks matched in the available history</p>
          <p className="mt-1 text-[11px] text-brand-500">This section uses recent Fix Engine runs only. Older work may be absent. A live check confirms one field on one page, not the entire issue or business impact.</p>
          {merged.length === 0 && live.length === 0 ? <p className="mt-3 text-[12px] text-brand-500">No work found in the available history for this month.</p> : <div className="mt-3 space-y-3">
            {merged.map((run) => <div key={run.id} className="border-t pt-3 text-[12px] text-brand-700"><span className="font-semibold">Pull request merged {new Date(run.mergedAt!).toLocaleDateString()}</span>{run.pullRequestUrl && <a className="ml-2 text-primary-700 underline" href={run.pullRequestUrl} target="_blank" rel="noreferrer">View on GitHub</a>}<span className="block text-brand-500">{run.filesChanged.length} files recorded · {run.changes.length} proposed changes</span>{run.changes.map((change, index) => <div key={change.issueId + change.url + index} className="mt-2 rounded-lg border p-2"><p className="font-medium text-brand-950">{change.findingTitle || change.field}</p><p className="break-all text-brand-500">{change.url}</p><p>Before: {change.before ?? "Not recorded"}</p><p>Proposed: {change.after}</p><p className="text-brand-500">Live check: {change.verification === "MATCHED" ? "Matched" : change.verification === "DIFFERENT" ? "Different" : change.verification === "UNSUPPORTED" ? "Unsupported" : "Not checked"}</p></div>)}</div>)}
            {live.map((change, index) => <div key={change.issueId + change.url + index} className="border-t pt-3 text-[12px] text-brand-700"><p className="font-semibold text-brand-950">{change.findingTitle || change.field}</p><p className="break-all text-brand-500">{change.url} · Checked {new Date(change.checkedAt!).toLocaleDateString()}</p><p className="mt-1">Before: {change.before ?? "Not recorded"}</p><p>Verified live value: {change.liveValue ?? "Not recorded"}</p>{change.pr && <a className="text-primary-700 underline" href={change.pr} target="_blank" rel="noreferrer">View pull request</a>}</div>)}
          </div>}
        </>}
      </Panel></section>
      <p className="text-[11px] text-brand-500">Available reporting window: last 12 calendar months. Totals sum only dates returned by connected sources. Unique users, rates, and rankings are not summed.</p>
    </>}
  </main>;
}
