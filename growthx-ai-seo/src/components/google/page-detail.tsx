"use client";
import { ArrowLeft } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ActionButton, Kpi, Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import { FailedState, LoadingState, NoDataState } from "@/components/ui/truthful-state";
import { ChangeText, EvidenceChips, Funnel, SourceBadge } from "@/components/google/parts";
import { useGooglePage } from "@/hooks/use-google";
import type { GoogleDiagnosisFinding, GooglePageDetail } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { DASH, count, duration, formatDayLabel, money, pathOf, percent, position, shortDay } from "@/lib/google-format";
import { cn } from "@/lib/utils";

const TONE = {
  good: "border-success-200 bg-success-50/40",
  bad: "border-error-200 bg-error-50/40",
  warn: "border-warning-200 bg-warning-50/40",
  neutral: "bg-brand-50/60",
} as const;

/** Everything known about one page, from Google and from our own crawl. */
export function PageDetail({ projectId, url, onBack }: { projectId: string | null; url: string; onBack: () => void }) {
  const { query, days } = useGooglePage(projectId, url);
  const d = query.data;

  return (
    <div className="space-y-4">
      <div>
        <ActionButton onClick={onBack} icon={<ArrowLeft size={12} />}>
          All pages
        </ActionButton>
      </div>

      {query.isLoading || !projectId ? (
        <LoadingState compact title="Loading this page…" message="Reading its search, visit and crawl data." />
      ) : query.error || !d ? (
        <FailedState title="Could not load this page" error={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : !d.found ? (
        <NoDataState
          compact
          title="Nothing recorded for this page"
          missing={`Search Console, Google Analytics and the last crawl have no data for ${pathOf(url)} in the last ${days} days.`}
          whyItMatters="A page appears here only once at least one source has real figures for it."
          actionRequired="Check the address, or widen the range."
          action={{ label: "Back to all pages", onClick: onBack, variant: "secondary" }}
        />
      ) : (
        <Detail d={d} days={days} />
      )}
    </div>
  );
}

function Detail({ d, days }: { d: GooglePageDetail; days: number }) {
  return (
    <>
      <Header d={d} days={days} />
      <Diagnosis findings={d.diagnosis} hasAnySource={Boolean(d.gsc || d.ga || d.crawl || d.index)} />
      <SearchSection d={d} days={days} />
      <AnalyticsSection d={d} days={days} />
      <Funnel stages={d.funnel} />
      <CrawlSection d={d} />
    </>
  );
}

function Header({ d, days }: { d: GooglePageDetail; days: number }) {
  const idx = d.index;
  const indexed = !idx ? null : idx.error ? null : idx.verdict === "PASS";
  return (
    <Panel>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="break-all font-mono text-[14px] font-semibold text-brand-950" title={d.url}>{pathOf(d.url)}</h2>
          {indexed === null ? (
            <span title={idx?.error ?? "Google has not been asked about this page yet."}><Pill>index not checked</Pill></span>
          ) : indexed ? (
            <Pill tone="good">indexed</Pill>
          ) : (
            <span title={idx?.coverageState ?? undefined}><Pill tone="bad">not indexed</Pill></span>
          )}
        </div>
        <p className="break-all text-[11px] text-brand-400">{d.url}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Organic clicks" value={d.gsc ? count(d.gsc.clicks) : DASH} sub={d.gsc ? undefined : "No Search Console data for this page"} aside={<SourceBadge source="GSC" />} trend={d.history.length >= 2 ? d.history.map((h) => h.clicks) : null} />
          <Kpi label="Organic users" value={d.ga ? count(d.ga.users) : DASH} sub={d.ga ? undefined : "Not among the top organic landing pages"} aside={<SourceBadge source="GA4" />} />
          <Kpi label="Key events" value={d.ga ? count(d.ga.keyEvents) : DASH} sub={d.ga && d.ga.keyEvents === null ? "None set up in Google Analytics" : undefined} aside={<SourceBadge source="GA4" />} />
          <Kpi label="Revenue" value={d.ga ? money(d.ga.revenue) : DASH} sub={d.ga && d.ga.revenue === null ? "None recorded in Google Analytics" : undefined} aside={<SourceBadge source="GA4" />} />
        </div>
        <p className="text-[11px] text-brand-400">Last {days} days.</p>
      </div>
    </Panel>
  );
}

function Diagnosis({ findings, hasAnySource }: { findings: GoogleDiagnosisFinding[]; hasAnySource: boolean }) {
  return (
    <Panel
      title="Why is this page performing this way?"
      subtitle="GrowthX analysis of this page's own figures. Every finding shows the numbers that triggered it."
    >
      <div className="space-y-3 p-4">
        {findings.length === 0 ? (
          <p className="text-[12.5px] text-brand-600">
            {hasAnySource
              ? "GrowthX found nothing wrong with this page in the data it holds. That is a result, not a gap: none of its checks fired."
              : "There is no data for this page yet, so nothing can be said about it."}
          </p>
        ) : (
          findings.map((f) => (
            <div key={f.id} className={cn("rounded-xl border p-3", TONE[f.tone])}>
              <p className="text-[13px] font-medium text-brand-950">{f.text}</p>
              <EvidenceChips items={f.evidence} />
              <p className="mt-2 text-[12px] text-brand-600">
                <span className="font-semibold text-brand-950">What to do: </span>
                {f.action}
              </p>
              <p className="mt-1 text-[10.5px] text-brand-400">
                Confidence {f.confidence.toLowerCase()} · <SourceBadge source={f.source} />
              </p>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function SearchSection({ d, days }: { d: GooglePageDetail; days: number }) {
  if (!d.gsc) {
    return (
      <Panel title="Search performance" actions={<SourceBadge source="GSC" />}>
        <p className="p-4 text-[12.5px] text-brand-500">No data available: Search Console recorded no impressions for this page in the last {days} days.</p>
      </Panel>
    );
  }
  return (
    <Panel title="Search performance" subtitle={`Last ${days} days`} actions={<SourceBadge source="GSC" />}>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Clicks" value={count(d.gsc.clicks)} aside={<ChangeText pct={d.gsc.clicksChangePct} />} />
          <Kpi label="Impressions" value={count(d.gsc.impressions)} />
          <Kpi label="CTR" value={percent(d.gsc.ctr)} />
          <Kpi label="Average position" value={position(d.gsc.position)} />
        </div>
        {d.history.length >= 2 && (
          <div>
            <p className="mb-2 text-[12px] font-semibold text-brand-950">Position history</p>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-100)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "var(--text-muted)" }} minTickGap={24} />
                  <YAxis reversed tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => position(Number(v))} width={36} />
                  <Tooltip formatter={(v) => [position(Number(v)), "Average position"]} labelFormatter={(l) => formatDayLabel(l)} />
                  <Line type="monotone" dataKey="position" stroke="var(--color-series-1)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <div>
          <p className="mb-2 text-[12px] font-semibold text-brand-950">Top queries</p>
          {d.queries.length === 0 ? (
            <p className="text-[12px] text-brand-500">No query data available for this page.</p>
          ) : (
            <Table minWidth={560}>
              <thead>
                <tr>
                  <Th>Query</Th>
                  <Th align="right">Clicks</Th>
                  <Th align="right">Impressions</Th>
                  <Th align="right">CTR</Th>
                  <Th align="right">Position</Th>
                </tr>
              </thead>
              <tbody>
                {d.queries.map((q) => (
                  <Tr key={q.query}>
                    <Td>{q.query}</Td>
                    <Td align="right">{count(q.clicks)}</Td>
                    <Td align="right">{count(q.impressions)}</Td>
                    <Td align="right">{percent(q.ctr)}</Td>
                    <Td align="right">{position(q.position)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </Panel>
  );
}

function AnalyticsSection({ d, days }: { d: GooglePageDetail; days: number }) {
  if (!d.ga) {
    return (
      <Panel title="Google Analytics performance" actions={<SourceBadge source="GA4" />}>
        <p className="p-4 text-[12.5px] text-brand-500">
          No data available: this page is not among the top organic landing pages Google Analytics reported for the last {days} days.
        </p>
      </Panel>
    );
  }
  return (
    <Panel title="Google Analytics performance" subtitle={`Organic Search visits only, last ${days} days`} actions={<SourceBadge source="GA4" />}>
      <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
        <Kpi label="Organic users" value={count(d.ga.users)} />
        <Kpi label="Organic sessions" value={count(d.ga.sessions)} />
        <Kpi label="Engagement rate" value={percent(d.ga.engagementRate)} />
        <Kpi label="Average engagement time" value={duration(d.ga.averageEngagementTimeSec)} />
        <Kpi label="Engaged sessions" value={count(d.ga.engagedSessions)} />
        <Kpi label="Views" value={count(d.ga.views)} />
        <Kpi label="Key events" value={count(d.ga.keyEvents)} sub={d.ga.keyEvents === null ? "None set up" : undefined} />
        <Kpi label="Revenue" value={money(d.ga.revenue)} sub={d.ga.revenue === null ? "None recorded" : undefined} />
      </div>
    </Panel>
  );
}

function CrawlSection({ d }: { d: GooglePageDetail }) {
  const c = d.crawl;
  const idx = d.index;
  return (
    <Panel
      title="GrowthX SEO data"
      subtitle={c ? `From the crawl of ${new Date(c.crawledAt).toLocaleDateString()}` : undefined}
      actions={<SourceBadge source="GrowthX" />}
    >
      <div className="space-y-4 p-4">
        {!c ? (
          <p className="text-[12.5px] text-brand-500">No data available: the latest crawl did not record this page. Run a website audit to add it.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Fact label="Status" value={String(c.statusCode || "no response")} bad={c.statusCode >= 400 || c.statusCode === 0} />
            <Fact label="Indexability" value={c.indexability === "INDEXABLE" ? "Indexable" : c.indexability === "NOT_INDEXABLE" ? "Not indexable" : "Unknown"} bad={c.indexability === "NOT_INDEXABLE"} />
            <Fact label="Title" value={c.title ? "Present" : "Missing"} bad={!c.title} detail={c.title} />
            <Fact label="Meta description" value={c.metaDescription ? "Present" : "Missing"} bad={!c.metaDescription} detail={c.metaDescription} />
            <Fact label="H1 headings" value={String(c.h1Count)} bad={c.h1Count === 0} />
            <Fact label="Words" value={count(c.wordCount)} />
            <Fact label="Canonical" value={c.canonicalUrl ? "Set" : "Not set"} detail={c.canonicalUrl} />
            <Fact label="Structured data" value={c.schemas.length ? c.schemas.map((s) => s.type.replace(/_/g, " ").toLowerCase()).join(", ") : "None found"} bad={c.schemas.some((s) => !s.valid)} />
            <Fact label="Internal links in" value={count(c.internalLinksIn)} />
            <Fact label="Internal links out" value={count(c.internalLinksOut)} />
            <Fact label="Server response" value={`${count(c.responseTimeMs)} ms`} />
            <Fact
              label="Performance score"
              value={c.performance?.performanceScore != null ? String(c.performance.performanceScore) : "Not measured"}
              detail={c.performance?.lcpMs != null ? `LCP ${(c.performance.lcpMs / 1000).toFixed(1)}s` : null}
            />
          </div>
        )}
        {c && c.openIssues.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-brand-950">Open issues on this page</p>
            <ul className="space-y-1">
              {c.openIssues.map((i, n) => (
                <li key={`${i.issueType}-${n}`} className="flex items-start gap-2 text-[12px] text-brand-600">
                  <Pill tone={i.severity === "CRITICAL" || i.severity === "HIGH" ? "bad" : "warn"}>{i.severity.toLowerCase()}</Pill>
                  <span>{i.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-brand-950">
            Google index status <SourceBadge source="GSC" />
          </p>
          {!idx ? (
            <p className="text-[12px] text-brand-500">Google has not been asked about this page yet. Use the Index status tab of Google Search to check it.</p>
          ) : idx.error ? (
            <p className="text-[12px] text-error-700">Google could not answer: {idx.error}</p>
          ) : (
            <div className="space-y-0.5 text-[12px] text-brand-600">
              <p><span className="font-semibold text-brand-950">{idx.coverageState ?? idx.verdict ?? "No status"}</span>{idx.meaning ? ` — ${idx.meaning}` : ""}</p>
              {idx.action && <p>{idx.action}</p>}
              <p className="text-[10.5px] text-brand-400">
                Checked {new Date(idx.inspectedAt).toLocaleDateString()}
                {idx.lastCrawlTime ? ` · Google last crawled it ${new Date(idx.lastCrawlTime).toLocaleDateString()}` : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Fact({ label, value, detail, bad }: { label: string; value: string; detail?: string | null; bad?: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">{label}</p>
      <p className={cn("mt-1 text-[13px] font-semibold", bad ? "text-error-600" : "text-brand-950")}>{value}</p>
      {detail && <p className="mt-0.5 line-clamp-2 break-all text-[11px] text-brand-500" title={detail}>{detail}</p>}
    </div>
  );
}
