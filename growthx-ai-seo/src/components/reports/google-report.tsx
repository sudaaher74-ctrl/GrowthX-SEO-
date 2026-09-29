"use client";
import { ReportGap, ReportKpis, ReportLoading, ReportPage, ReportSection, ReportTable, ReportText, useReportContext } from "@/components/reports/report-kit";
import { useGa4Report } from "@/hooks/use-ga4-report";
import { useGoogleAlerts, useGoogleKeywords, useGoogleOverview, useGscQueries, useIndexStatus } from "@/hooks/use-google";
import { DASH, count, formatKpi, percent, position } from "@/lib/google-format";

/** Google Search Console and Google Analytics 4, in one report. */
export function GoogleReport() {
  const { projectId, clientName, domain } = useReportContext();
  const overview = useGoogleOverview(projectId);
  const { report } = useGa4Report(projectId);
  const queries = useGscQueries(projectId, 25);
  const keywords = useGoogleKeywords(projectId);
  const alerts = useGoogleAlerts(projectId);
  const { query: index } = useIndexStatus(projectId);

  const o = overview.query.data;
  if (!projectId || overview.query.isLoading) return <ReportLoading what="the Google report" />;
  const days = overview.days;
  const ga = report.data?.data;
  const q = queries.query.data;
  const k = keywords.query.data;
  const a = alerts.query.data;
  const idx = index.data;

  return (
    <ReportPage
      title="Google performance report"
      clientName={clientName}
      domain={domain}
      intro={`How your website performs in Google over the last ${days} days: what people searched, how many visited, and what needs attention. Search figures come from Search Console and visit figures from Google Analytics 4.`}
    >
      <ReportSection title="At a glance">
        {o ? (
          <ReportKpis items={o.kpis.map((kpi) => ({ label: kpi.label, value: formatKpi(kpi), sub: kpi.value === null ? (kpi.note ?? undefined) : kpi.delta ? `${kpi.delta.value >= 0 ? "+" : "−"}${Math.abs(Math.round(kpi.delta.value * 10) / 10)}${kpi.delta.kind === "pct" ? "%" : kpi.delta.kind === "pts" ? " pts" : " places"} vs previous ${days} days` : undefined }))} />
        ) : (
          <ReportGap>Google data could not be loaded, so no figures are shown.</ReportGap>
        )}
      </ReportSection>

      {o && o.headlines.length > 0 && (
        <ReportSection title="What is happening" note="Each line is built from the figures under it.">
          <ul className="space-y-2">
            {o.headlines.map((h) => (
              <li key={h.id}>
                <ReportText>{h.text}</ReportText>
                <p className="text-[10.5px] text-brand-400">{h.evidence.map((e) => `${e.label}: ${e.value}`).join(" · ")}</p>
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      <ReportSection title="Alerts" note="Changes that moved enough against the previous period to flag.">
        {!a ? (
          <ReportGap>Alerts are not available.</ReportGap>
        ) : !a.comparable ? (
          <ReportGap>No earlier period is stored yet, so no change can be detected.</ReportGap>
        ) : a.alerts.length === 0 ? (
          <ReportText>Nothing moved enough to flag.</ReportText>
        ) : (
          <ul className="space-y-1.5">
            {a.alerts.map((x) => (
              <li key={x.id}><ReportText><strong>{x.direction === "GOOD" ? "Gain: " : "Watch: "}{x.title}.</strong> {x.detail}</ReportText></li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection title="Where visits come from" note="Sessions by channel, from Google Analytics 4.">
        {ga && !ga.empty ? (
          <ReportTable
            columns={[{ label: "Channel" }, { label: "Sessions", right: true }, { label: "Users", right: true }, { label: "Engagement", right: true }]}
            rows={ga.channels.map((c) => [c.channel, count(c.sessions), count(c.users), c.engagementRate === undefined ? DASH : percent(c.engagementRate)])}
            empty="No channels recorded."
          />
        ) : (
          <ReportGap>Google Analytics has no traffic for this period, or is not connected.</ReportGap>
        )}
      </ReportSection>

      <ReportSection title="Top search queries" note="What people searched to find you, by clicks.">
        <ReportTable
          columns={[{ label: "Query" }, { label: "Clicks", right: true }, { label: "Impressions", right: true }, { label: "CTR", right: true }, { label: "Position", right: true }]}
          rows={(q ?? []).slice(0, 25).map((r) => [r.key, count(r.clicks), count(r.impressions), percent(r.ctr), position(r.position)])}
          empty="Search Console has no queries for this period."
        />
      </ReportSection>

      <ReportSection title="Keyword movement">
        {k === undefined || k === null ? (
          <ReportGap>Not available for this period.</ReportGap>
        ) : (
          <>
            <ReportText>
              {k.new === null ? "No earlier period is stored, so new and rising keywords cannot be found. " : `${k.new.length} new and ${k.rising?.length ?? 0} rising keywords. `}
              {k.cannibalization === null ? "" : `${k.cannibalization.length} queries are split across more than one of your pages.`}
            </ReportText>
            {k.rising && k.rising.length > 0 && (
              <ReportTable
                columns={[{ label: "Rising query" }, { label: "Clicks before", right: true }, { label: "Clicks now", right: true }]}
                rows={k.rising.slice(0, 10).map((r) => [r.query, count(r.previousClicks), count(r.clicks)])}
                empty=""
              />
            )}
          </>
        )}
      </ReportSection>

      <ReportSection title="Index status" note="Whether Google has indexed your pages.">
        {idx && idx.connected ? (
          <ReportKpis items={[
            { label: "Indexed", value: count(idx.totals.indexed), sub: `of ${count(idx.totals.asked)} inspected` },
            { label: "Not indexed", value: count(idx.totals.notIndexed) },
            { label: "Could not check", value: count(idx.totals.couldNotCheck) },
            { label: "Not inspected yet", value: count(idx.totals.notYetAsked) },
          ]} />
        ) : (
          <ReportGap>Search Console is not connected, so index status is not known.</ReportGap>
        )}
      </ReportSection>
    </ReportPage>
  );
}
