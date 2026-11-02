"use client";

import { useMemo, useState } from "react";
import { Activity, Info } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { CrawlJob, CrawlPage, CrawlHistoryPoint } from "@/lib/api-client";
import { ActionButton, Kpi, Panel, Table, Th, Tr, Td } from "@/components/ui/console";

type Metric = "lcpMs" | "inpMs" | "clsScore";

const metrics: Record<Metric, { label: string; unit: string; scale: number }> = {
  lcpMs: { label: "LCP", unit: "s", scale: 1000 },
  inpMs: { label: "INP", unit: "ms", scale: 1 },
  clsScore: { label: "CLS", unit: "", scale: 1 },
};

const measured = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const average = (values: unknown[]) => {
  const valid = values.filter(measured);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

const display = (value: number | null | undefined, scale = 1, digits = 1) =>
  measured(value) ? (value / scale).toFixed(digits) : "—";

export function PerformanceTab({
  pages,
  historyRuns = [],
}: {
  crawl: CrawlJob | null;
  pages: CrawlPage[];
  historyRuns?: CrawlHistoryPoint[];
}) {
  const [metric, setMetric] = useState<Metric>("lcpMs");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const homepagePages = useMemo(
    () =>
      pages.filter((page) => {
        try {
          return new URL(page.url).pathname === "/";
        } catch {
          return false;
        }
      }),
    [pages],
  );

  const values = useMemo(() => {
    const scoreValues = homepagePages.map((page) => page.performance?.performanceScore);
    const lcpValues = homepagePages.map((page) => page.performance?.lcpMs);
    const inpValues = homepagePages.map((page) => page.performance?.inpMs);
    const clsValues = homepagePages.map((page) => page.performance?.clsScore);

    return {
      score: average(scoreValues),
      lcp: average(lcpValues),
      inp: average(inpValues),
      cls: average(clsValues),
      scoreCount: scoreValues.filter(measured).length,
      lcpCount: lcpValues.filter(measured).length,
      inpCount: inpValues.filter(measured).length,
      clsCount: clsValues.filter(measured).length,
      pageCount: homepagePages.filter((page) =>
        [page.performance?.performanceScore, page.performance?.lcpMs, page.performance?.inpMs, page.performance?.clsScore]
          .some(measured),
      ).length,
    };
  }, [homepagePages]);

  const definition = metrics[metric];
  const points = useMemo(
    () =>
      historyRuns
        .filter((run) => run.finishedAt && measured(run.performance?.[metric]))
        .map((run) => ({
          id: run.id,
          date: new Date(run.finishedAt!).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          value: run.performance![metric]! / metrics[metric].scale,
        })),
    [historyRuns, metric],
  );

  const filtered = useMemo(
    () =>
      pages
        .filter((page) => `${page.url} ${page.title ?? ""}`.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => (b.responseTimeMs ?? 0) - (a.responseTimeMs ?? 0)),
    [pages, search],
  );

  const kpis = [
    {
      label: "Homepage Lighthouse score",
      value: values.score == null ? null : String(Math.round(values.score)),
      count: values.scoreCount,
      sub: "Lighthouse lab · out of 100",
    },
    {
      label: "Homepage LCP",
      value: values.lcp == null ? null : `${display(values.lcp, 1000)}s`,
      count: values.lcpCount,
      sub: "Lighthouse lab measurement",
    },
    {
      label: "Homepage INP",
      value: values.inp == null ? null : `${display(values.inp, 1, 0)}ms`,
      count: values.inpCount,
      sub: "PageSpeed field data · p75",
    },
    {
      label: "Homepage CLS",
      value: values.cls == null ? null : display(values.cls, 1, 3),
      count: values.clsCount,
      sub: "Lighthouse lab measurement",
    },
  ].filter((kpi): kpi is typeof kpi & { value: string } => kpi.value !== null);

  return (
    <div className="space-y-5">
      {values.pageCount === 0 ? (
        <Panel padded className="border-dashed">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning-500/10 text-warning-600">
              <Activity size={21} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-brand-950">No speed results for this audit</h2>
              <p className="mt-1 text-sm leading-6 text-brand-600">
                PageSpeed Insights did not return a usable measurement for the homepage.
                We leave the score and Core Web Vitals blank instead of estimating them from crawl timings.
              </p>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-xs leading-5 text-brand-600">
                <Info size={15} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
                <p>
                  This audit checks PageSpeed on the homepage only. Crawl response times for the other URLs appear below,
                  but they are not visitor-facing speed or Core Web Vitals measurements. Use “Check my website again”
                  above to request a fresh homepage check.
                </p>
              </div>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          <Panel title="Homepage speed measurements" subtitle={`${values.pageCount} homepage URL${values.pageCount === 1 ? "" : "s"} with recorded results.`} padded>
            <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-xs leading-5 text-brand-600">
              <Info size={15} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
              <p>
                LCP, CLS and the Lighthouse score are lab measurements. INP is PageSpeed field data (the 75th
                percentile for each URL). Crawl fetch duration is shown separately and is not a Core Web Vital.
              </p>
            </div>
          </Panel>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <Kpi
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                sub={`${kpi.sub} · ${kpi.count} URL${kpi.count === 1 ? "" : "s"}`}
              />
            ))}
          </div>
        </>
      )}

      <Panel
        title="Homepage Core Web Vitals trend"
        subtitle="Recorded homepage measurements from completed audits. Missing measurements are not plotted."
        padded
      >
        <label className="mb-4 flex flex-wrap items-center gap-3 text-xs text-brand-600">
          Metric
          <select
            aria-label="Trend metric"
            value={metric}
            onChange={(event) => setMetric(event.target.value as Metric)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-brand-950"
          >
            {Object.entries(metrics).map(([key, item]) => (
              <option key={key} value={key}>
                {item.label}{item.unit ? ` (${item.unit})` : ""}
              </option>
            ))}
          </select>
          <span>{points.length} measured audit{points.length === 1 ? "" : "s"}</span>
        </label>

        {!points.length ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
            <p className="text-sm font-medium text-brand-700">No {definition.label} history yet</p>
            <p className="mt-1 text-xs text-brand-500">
              A trend appears after PageSpeed measurements are saved for completed audits.
            </p>
          </div>
        ) : (
          <>
            {points.length === 1 && (
              <p className="mb-3 text-xs text-brand-500">
                One measured audit is available. At least two are needed to show a trend.
              </p>
            )}
            <div
              className="h-60 min-w-0"
              role="img"
              aria-label={`${definition.label} values for the homepage from completed audits`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="var(--color-brand-100)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis unit={definition.unit} tick={{ fontSize: 10 }} domain={[0, "auto"]} />
                  <Tooltip />
                  <Line
                    dataKey="value"
                    name={`Homepage ${definition.label}${definition.unit ? ` (${definition.unit})` : ""}`}
                    stroke="var(--color-primary-600)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-3 text-xs text-brand-600">
              <summary className="cursor-pointer">View recorded values</summary>
              <ul className="mt-2 space-y-1">
                {points.map((point) => (
                  <li key={point.id}>
                    {point.date}: {point.value.toFixed(metric === "clsScore" ? 3 : 1)}{definition.unit}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </Panel>

      <Panel
        title="Audited URL timings"
        subtitle="Crawler response times, sorted slowest first. These include crawler processing and are not PageSpeed measurements."
        padded
      >
        <label className="mb-4 block text-xs text-brand-600">
          Search audited URLs
          <input
            type="search"
            aria-label="Search speed URLs"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setShowAll(false);
            }}
            className="mt-2 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-brand-950"
          />
        </label>
        <Table minWidth={650}>
          <thead>
            <tr>
              <Th>URL</Th>
              <Th>LCP</Th>
              <Th>INP</Th>
              <Th>CLS</Th>
              <Th>Crawler response time</Th>
            </tr>
          </thead>
          <tbody>
            {(showAll ? filtered : filtered.slice(0, 10)).map((page) => (
              <Tr key={page.id}>
                <Td>
                  <a href={page.url} target="_blank" rel="noreferrer" className="break-all text-primary-700">
                    {page.url}
                  </a>
                </Td>
                <Td>{measured(page.performance?.lcpMs) ? `${display(page.performance.lcpMs, 1000)}s` : "—"}</Td>
                <Td>{measured(page.performance?.inpMs) ? `${display(page.performance.inpMs, 1, 0)}ms` : "—"}</Td>
                <Td>{display(page.performance?.clsScore, 1, 3)}</Td>
                <Td>{measured(page.responseTimeMs) ? `${display(page.responseTimeMs, 1000)}s` : "—"}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        {!filtered.length && (
          <p className="py-6 text-center text-sm text-brand-500">
            {search ? "No audited URLs match your search." : "No URL records are available for this audit."}
          </p>
        )}
        {filtered.length > 10 && (
          <ActionButton className="mt-4" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show fewer URLs" : `Show all ${filtered.length} URLs`}
          </ActionButton>
        )}
      </Panel>
    </div>
  );
}