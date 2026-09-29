"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { ActionButton, Mono, Panel, Pill, Table, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import type { ComparedPage, KeywordDiagnosis } from "@/lib/search-intelligence";
import { AnalyticsNudge, ErrorNote, Field, GoogleConnectGate, ReasonCard, inputClass, pathOf } from "./shared";

const CONFIDENCE_TONE = { HIGH: "good", MEDIUM: "warn", LOW: "bad" } as const;

/** What a search picked from the rankings table brings with it. */
interface Seed {
  keyword: string;
  pageUrl: string | null;
}

export function DiagnosisTab({
  projectId,
  searchConsoleConnected,
  analyticsConnected,
  liveResults,
  initial,
}: {
  projectId: string;
  searchConsoleConnected: boolean;
  analyticsConnected: boolean;
  /** The platform can read Google's live results and the pages that rank, which makes the fullest answer. */
  liveResults: boolean;
  /** A search chosen elsewhere; the form opens filled in with it. */
  initial: Seed | null;
}) {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState(initial?.keyword ?? "");
  const [pageUrl, setPageUrl] = useState(initial?.pageUrl ?? "");
  const [shown, setShown] = useState<KeywordDiagnosis | null>(null);

  const history = useQuery({
    queryKey: ["si-diagnoses", projectId],
    queryFn: () => api.searchIntelligence.diagnoses(projectId),
  });

  const run = useMutation({
    mutationFn: (request: { keyword: string; pageUrl?: string }) => api.searchIntelligence.diagnose(projectId, request),
    onSuccess: (result) => {
      setShown(result);
      queryClient.invalidateQueries({ queryKey: ["si-diagnoses", projectId] });
      queryClient.invalidateQueries({ queryKey: ["si-rankings", projectId] });
    },
  });
  const diagnose = () => run.mutate({ keyword: keyword.trim(), pageUrl: pageUrl.trim() || undefined });

  const open = useMutation({
    mutationFn: (id: string) => api.searchIntelligence.diagnosis(projectId, id),
    onSuccess: setShown,
  });

  // React runs a mount effect twice in development to flush out effects that
  // are not safe to repeat; asking Search Console the same question twice, and
  // saving it twice, is exactly that.
  const started = useRef(false);
  useEffect(() => {
    // A search picked in the rankings table is diagnosed as the tab opens when
    // that costs nothing. A live check is paid for, so it waits for the click.
    if (started.current || !initial || !searchConsoleConnected || liveResults) return;
    started.current = true;
    run.mutate({ keyword: initial.keyword, pageUrl: initial.pageUrl ?? undefined });
    // Once, when the tab opens with a search chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!searchConsoleConnected && !liveResults) return <GoogleConnectGate analyticsConnected={analyticsConnected} />;

  return (
    <div className="space-y-4">
      <Panel
        title="Why isn't my page ranking?"
        subtitle={
          liveResults
            ? "Checks Google's live results and reads your page next to the pages that beat it"
            : "Reads how Google has been showing your page for this search, and reads the page itself"
        }
        padded
      >
        <form
          className="grid gap-3 md:grid-cols-[1fr_1.2fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (keyword.trim().length >= 2) diagnose();
          }}
        >
          <Field label="What do people search for?">
            <input className={inputClass} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="a2 cow milk delivery pune" />
          </Field>
          <Field label="Your page" hint="optional: we use the page Google already shows">
            <input className={inputClass} value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://yoursite.com/a2-milk" />
          </Field>
          <ActionButton type="submit" variant="primary" icon={<Search size={12} />} disabled={run.isPending || keyword.trim().length < 2}>
            {run.isPending ? (liveResults ? "Checking Google…" : "Reading your data…") : "Diagnose"}
          </ActionButton>
        </form>
        {run.isPending && (
          <p className="mt-3 text-[11.5px] text-brand-500">
            {liveResults ? "Reading Google's results and the top pages. This takes up to a minute." : "Reading your Search Console numbers and your page. This takes a few seconds."}
          </p>
        )}
        {run.error && <div className="mt-3"><ErrorNote message={errorMessage(run.error)} /></div>}
      </Panel>

      {shown && <DiagnosisView d={shown} analyticsConnected={analyticsConnected} />}

      {(history.data?.length ?? 0) > 0 && (
        <Panel title="Earlier diagnoses" subtitle="Each is kept as it was on the day it ran">
          <Table minWidth={640}>
            <thead>
              <tr>
                <Th>Search</Th>
                <Th>Page</Th>
                <Th>Result</Th>
                <Th align="right">When</Th>
              </tr>
            </thead>
            <tbody>
              {history.data!.map((h) => (
                <Tr key={h.id} className="cursor-pointer" onClick={() => open.mutate(h.id)}>
                  <Td><span className="text-[12.5px] font-medium text-brand-950">{h.keyword}</span></Td>
                  <Td><Mono tone="soft">{pathOf(h.pageUrl)}</Mono></Td>
                  <Td><span className="text-[12px] text-brand-600">{h.verdictText ?? "—"} {h.reasons > 0 && `· ${h.reasons} reason(s)`}</span></Td>
                  <Td align="right"><Mono tone="soft">{relativeTime(h.createdAt)}</Mono></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </div>
  );
}

function Tick({ on }: { on: boolean }) {
  return on ? <Check size={14} className="inline text-success-600" /> : <X size={14} className="inline text-error-500" />;
}

/** A position as a diagnosis says it: a place in live results, an average from Search Console. */
function placed(d: KeywordDiagnosis): string {
  if (d.results.position === null) return d.mode === "SEARCH_CONSOLE" ? "not shown" : "not in top 20";
  return d.mode === "SEARCH_CONSOLE" ? `avg #${d.results.position}` : `#${d.results.position}`;
}

/** Two facts about a page come from its address, so they show even when the page itself could not be read. */
function shows(page: ComparedPage, label: string): boolean {
  return page.read || label === "Kind of page" || label === "Search words in the address";
}

function DiagnosisView({ d, analyticsConnected }: { d: KeywordDiagnosis; analyticsConnected: boolean }) {
  // A diagnosis saved before there were two kinds was always a live check.
  const fromSearchConsole = d.mode === "SEARCH_CONSOLE";
  const pages: Array<{ label: string; page: ComparedPage; yours?: boolean }> = [
    { label: "Your page", page: d.comparison.yours, yours: true },
    ...d.comparison.competitors.map((c) => ({ label: `#${c.position ?? "?"} ${c.domain}`, page: c })),
  ];
  const rows: Array<{ label: string; cell: (p: ComparedPage) => React.ReactNode }> = [
    { label: "Kind of page", cell: (p) => <span className="text-[11.5px] text-brand-700">{p.formatLabel}</span> },
    { label: "Words of content", cell: (p) => <Mono>{p.wordCount?.toLocaleString() ?? "—"}</Mono> },
    { label: "Search words in title", cell: (p) => (p.read ? <Tick on={p.keywordInTitle} /> : "—") },
    { label: "Search words in main heading", cell: (p) => (p.read ? <Tick on={p.keywordInHeading} /> : "—") },
    { label: "Search words in the address", cell: (p) => <Tick on={p.keywordInAddress} /> },
    { label: "Mentioned early in the text", cell: (p) => (p.read ? <Tick on={p.keywordInOpening} /> : "—") },
    { label: "Structured data", cell: (p) => <span className="text-[11px] text-brand-600">{p.structuredData.join(", ") || "none"}</span> },
  ];
  const { intent, dominantFormat } = d.results;
  const previous = d.searchConsole?.previous ?? null;

  return (
    <div className="space-y-4">
      <Panel padded>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-semibold text-brand-950">&ldquo;{d.keyword}&rdquo;</h2>
          <Pill tone={d.verdict === "TOP_3" ? "good" : d.verdict === "NOT_IN_TOP_20" ? "bad" : "warn"}>{placed(d)}</Pill>
          <Pill tone={CONFIDENCE_TONE[d.confidence.level]}>{d.confidence.level.toLowerCase()} confidence</Pill>
          <span className="ml-auto text-[11px] text-brand-400">
            {fromSearchConsole || !d.market ? "Search Console, last 28 days" : `Google ${d.market.country}, checked ${relativeTime(d.checkedAt)}`}
          </span>
        </div>
        <p className="mt-1 break-all font-mono text-[11px] text-brand-500">{d.pageUrl}</p>
        <p className="mt-2 text-[13px] text-brand-700">{d.verdictText}</p>
        {d.results.otherPageOfYours && (
          <p className="mt-1 text-[12px] text-warning-700">
            Google {fromSearchConsole ? "shows" : "ranks"} a different page of yours here: {d.results.otherPageOfYours.url}
            {d.results.otherPageOfYours.position !== null &&
              (fromSearchConsole ? `, averaging #${d.results.otherPageOfYours.position.toFixed(1)}` : ` at #${d.results.otherPageOfYours.position}`)}
            .
          </p>
        )}
        {fromSearchConsole && (
          <p className="mt-2 text-[11.5px] text-brand-500">
            This check uses your Search Console numbers and your page. It did not look at Google&apos;s results, so it cannot say what the pages above yours do differently.
          </p>
        )}
        <details className="mt-2 text-[11.5px] text-brand-500">
          <summary className="cursor-pointer">What this is based on</summary>
          <ul className="mt-1 list-disc pl-5">
            {d.confidence.basis.map((b) => <li key={b}>{b}</li>)}
            {d.confidence.missing.map((m) => <li key={m} className="text-warning-700">Missing: {m}</li>)}
          </ul>
        </details>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {intent && (
          <Panel title="What Google wants for this search" padded>
            <p className="text-[13px] text-brand-950">
              The searcher <strong>{intent.primaryLabel}</strong>
              {dominantFormat && (
                <>
                  , and Google mostly shows <strong>{dominantFormat.label}</strong> ({dominantFormat.count} of the top {dominantFormat.of}).
                </>
              )}
            </p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12px] text-brand-600">
              {intent.evidence.map((e) => <li key={e}>{e}</li>)}
            </ul>
            {d.results.questions.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">People also ask</p>
                <ul className="mt-1 space-y-0.5 text-[12px] text-brand-700">
                  {d.results.questions.map((q) => <li key={q}>• {q}</li>)}
                </ul>
              </div>
            )}
          </Panel>
        )}

        <Panel title="Google's own numbers for this search" subtitle="Search Console, last 28 days" padded>
          {d.searchConsole ? (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="font-mono text-[18px] font-bold text-brand-950">{d.searchConsole.clicks}</p><p className="text-[10.5px] text-brand-400">clicks</p></div>
                <div><p className="font-mono text-[18px] font-bold text-brand-950">{d.searchConsole.impressions.toLocaleString()}</p><p className="text-[10.5px] text-brand-400">times shown</p></div>
                <div><p className="font-mono text-[18px] font-bold text-brand-950">{d.searchConsole.position ?? "—"}</p><p className="text-[10.5px] text-brand-400">avg position</p></div>
              </div>
              {previous && previous.impressions > 0 && (
                <p className="mt-3 text-[11.5px] text-brand-600">
                  The 28 days before: {previous.impressions.toLocaleString()} times shown, {previous.clicks.toLocaleString()} clicks
                  {previous.position !== null && `, average position ${previous.position.toFixed(1)}`}.
                </p>
              )}
              {d.searchConsole.pages.length > 0 && (
                <ul className="mt-3 space-y-1 text-[11.5px]">
                  {d.searchConsole.pages.slice(0, 4).map((p) => (
                    <li key={p.url} className="flex justify-between gap-2">
                      <span className="truncate font-mono text-brand-600">{pathOf(p.url)}</span>
                      <span className="shrink-0 text-brand-500">{p.impressions.toLocaleString()} shown · {p.clicks} clicks</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-[12px] text-brand-500">Search Console is not connected, so Google&apos;s own figures are not included.</p>
          )}
          {d.indexStatus && (
            <p className="mt-3 text-[11.5px] text-brand-600">
              Index status: <strong>{d.indexStatus.coverageState ?? d.indexStatus.verdict}</strong> (checked {relativeTime(d.indexStatus.inspectedAt)})
            </p>
          )}
        </Panel>

        <Panel title="Visitors to this page" subtitle="Google Analytics 4, last 28 days, from every source" padded>
          {!analyticsConnected ? (
            <AnalyticsNudge what="See how many people visit this page and whether they take action." />
          ) : d.visits ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="font-mono text-[18px] font-bold text-brand-950">{d.visits.sessions.toLocaleString()}</p><p className="text-[10.5px] text-brand-400">visits</p></div>
              <div>
                <p className="font-mono text-[18px] font-bold text-brand-950">
                  {d.visits.engagementRate === null ? "—" : `${Math.round(d.visits.engagementRate * 100)}%`}
                </p>
                <p className="text-[10.5px] text-brand-400">engaged</p>
              </div>
              <div>
                <p className="font-mono text-[18px] font-bold text-brand-950">{d.visits.conversions === null ? "—" : d.visits.conversions.toLocaleString()}</p>
                <p className="text-[10.5px] text-brand-400">{d.visits.conversions === null ? "conversions not set up" : "conversions"}</p>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-brand-500">Google Analytics 4 recorded no visits that started on this page in the last 28 days.</p>
          )}
        </Panel>
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-semibold text-brand-950">
          {d.reasons.length === 0
            ? fromSearchConsole
              ? "No problems found in your Search Console numbers or on the page"
              : "No problems found against the pages that rank"
            : `Why it is not ranking higher (${d.reasons.length})`}
        </h3>
        <div className="space-y-2">
          {d.reasons.map((r, i) => <ReasonCard key={`${r.code}-${i}`} reason={r} index={i} />)}
        </div>
      </div>

      {fromSearchConsole ? (
        <Panel title="Your page" subtitle="Read live just now" padded>
          <dl className="grid gap-x-10 gap-y-2.5 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4 border-b pb-2">
                <dt className="text-[11.5px] font-medium text-brand-700">{row.label}</dt>
                <dd>{shows(d.comparison.yours, row.label) ? row.cell(d.comparison.yours) : <span className="text-[11px] text-brand-400">could not read</span>}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      ) : (
        <Panel title="Your page next to the pages that rank" subtitle="All read live, the same way, at the same moment">
          <Table minWidth={Math.max(640, 180 + pages.length * 130)}>
            <thead>
              <tr>
                <Th> </Th>
                {pages.map((p) => (
                  <Th key={p.page.url}>
                    <span className={p.yours ? "text-primary-700" : undefined}>{p.label}</span>
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Tr key={row.label}>
                  <Td><span className="text-[11.5px] font-medium text-brand-700">{row.label}</span></Td>
                  {pages.map((p) => (
                    <Td key={p.page.url}>{shows(p.page, row.label) ? row.cell(p.page) : <span className="text-[11px] text-brand-400">could not read</span>}</Td>
                  ))}
                </Tr>
              ))}
            </tbody>
          </Table>
          {d.comparison.typical && (
            <p className="border-t px-4 py-2 text-[11px] text-brand-500">
              Typical ranking page: {d.comparison.typical.wordCount?.toLocaleString() ?? "—"} words; search words in the title on {d.comparison.typical.keywordInTitle}, in the main heading on{" "}
              {d.comparison.typical.keywordInHeading}.
            </p>
          )}
        </Panel>
      )}

      {d.results.top.length > 0 && (
        <Panel title="Google's top results" subtitle={d.results.features.length ? `Also on the page: ${d.results.features.map((f) => f.label).join(", ")}` : undefined}>
          <Table minWidth={640}>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Page</Th>
                <Th>Kind</Th>
              </tr>
            </thead>
            <tbody>
              {d.results.top.map((r) => (
                <Tr key={r.url}>
                  <Td><Mono>{r.position}</Mono></Td>
                  <Td>
                    <a href={r.url} target="_blank" rel="noreferrer" className="block text-[12.5px] font-medium text-brand-950 hover:underline">
                      {r.title ?? r.url}
                    </a>
                    <span className="font-mono text-[10.5px] text-brand-400">{r.domain}</span>
                    {r.yours && <span className="ml-2"><Pill tone="good">you</Pill></span>}
                  </Td>
                  <Td><span className="text-[11.5px] text-brand-600">{r.formatLabel}</span></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
