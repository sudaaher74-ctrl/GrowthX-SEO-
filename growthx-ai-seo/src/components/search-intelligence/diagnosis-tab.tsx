"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { ActionButton, Mono, Panel, Pill, Table, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import type { ComparedPage, KeywordDiagnosis } from "@/lib/search-intelligence";
import { ErrorNote, Field, GoogleResultsNotConnected, ReasonCard, inputClass, pathOf } from "./shared";

const CONFIDENCE_TONE = { HIGH: "good", MEDIUM: "warn", LOW: "bad" } as const;

export function DiagnosisTab({ projectId, connected }: { projectId: string; connected: boolean }) {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [shown, setShown] = useState<KeywordDiagnosis | null>(null);

  const history = useQuery({
    queryKey: ["si-diagnoses", projectId],
    queryFn: () => api.searchIntelligence.diagnoses(projectId),
  });

  const run = useMutation({
    mutationFn: () => api.searchIntelligence.diagnose(projectId, { keyword: keyword.trim(), pageUrl: pageUrl.trim() || undefined }),
    onSuccess: (result) => {
      setShown(result);
      queryClient.invalidateQueries({ queryKey: ["si-diagnoses", projectId] });
      queryClient.invalidateQueries({ queryKey: ["si-rankings", projectId] });
    },
  });

  const open = useMutation({
    mutationFn: (id: string) => api.searchIntelligence.diagnosis(projectId, id),
    onSuccess: setShown,
  });

  if (!connected) return <GoogleResultsNotConnected />;

  return (
    <div className="space-y-4">
      <Panel title="Why isn't my page ranking?" subtitle="Checks Google's live results and reads your page next to the pages that beat it" padded>
        <form
          className="grid gap-3 md:grid-cols-[1fr_1.2fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (keyword.trim().length >= 2) run.mutate();
          }}
        >
          <Field label="What do people search for?">
            <input className={inputClass} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="a2 cow milk delivery pune" />
          </Field>
          <Field label="Your page" hint="optional: we use the page Google already shows">
            <input className={inputClass} value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://yoursite.com/a2-milk" />
          </Field>
          <ActionButton type="submit" variant="primary" icon={<Search size={12} />} disabled={run.isPending || keyword.trim().length < 2}>
            {run.isPending ? "Checking Google…" : "Diagnose"}
          </ActionButton>
        </form>
        {run.isPending && <p className="mt-3 text-[11.5px] text-brand-500">Reading Google&apos;s results and the top pages. This takes up to a minute.</p>}
        {run.error && <div className="mt-3"><ErrorNote message={errorMessage(run.error)} /></div>}
      </Panel>

      {shown && <DiagnosisView d={shown} />}

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

function DiagnosisView({ d }: { d: KeywordDiagnosis }) {
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

  return (
    <div className="space-y-4">
      <Panel padded>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-semibold text-brand-950">&ldquo;{d.keyword}&rdquo;</h2>
          <Pill tone={d.verdict === "TOP_3" ? "good" : d.verdict === "NOT_IN_TOP_20" ? "bad" : "warn"}>
            {d.results.position ? `#${d.results.position}` : "not in top 20"}
          </Pill>
          <Pill tone={CONFIDENCE_TONE[d.confidence.level]}>{d.confidence.level.toLowerCase()} confidence</Pill>
          <span className="ml-auto text-[11px] text-brand-400">Google {d.market.country}, checked {relativeTime(d.checkedAt)}</span>
        </div>
        <p className="mt-1 break-all font-mono text-[11px] text-brand-500">{d.pageUrl}</p>
        <p className="mt-2 text-[13px] text-brand-700">{d.verdictText}</p>
        {d.results.otherPageOfYours && (
          <p className="mt-1 text-[12px] text-warning-700">
            Google ranks a different page of yours here: {d.results.otherPageOfYours.url} at #{d.results.otherPageOfYours.position}.
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
        <Panel title="What Google wants for this search" padded>
          <p className="text-[13px] text-brand-950">
            The searcher <strong>{d.results.intent.primaryLabel}</strong>
            {d.results.dominantFormat && (
              <>
                , and Google mostly shows <strong>{d.results.dominantFormat.label}</strong> ({d.results.dominantFormat.count} of the top {d.results.dominantFormat.of}).
              </>
            )}
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12px] text-brand-600">
            {d.results.intent.evidence.map((e) => <li key={e}>{e}</li>)}
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

        <Panel title="Google's own numbers for this search" subtitle="Search Console, last 28 days" padded>
          {d.searchConsole ? (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="font-mono text-[18px] font-bold text-brand-950">{d.searchConsole.clicks}</p><p className="text-[10.5px] text-brand-400">clicks</p></div>
                <div><p className="font-mono text-[18px] font-bold text-brand-950">{d.searchConsole.impressions.toLocaleString()}</p><p className="text-[10.5px] text-brand-400">times shown</p></div>
                <div><p className="font-mono text-[18px] font-bold text-brand-950">{d.searchConsole.position ?? "—"}</p><p className="text-[10.5px] text-brand-400">avg position</p></div>
              </div>
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
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-semibold text-brand-950">
          {d.reasons.length === 0 ? "No problems found against the pages that rank" : `Why it is not ranking higher (${d.reasons.length})`}
        </h3>
        <div className="space-y-2">
          {d.reasons.map((r, i) => <ReasonCard key={`${r.code}-${i}`} reason={r} index={i} />)}
        </div>
      </div>

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
                  <Td key={p.page.url}>{p.page.read || row.label === "Kind of page" || row.label === "Search words in the address" ? row.cell(p.page) : <span className="text-[11px] text-brand-400">could not read</span>}</Td>
                ))}
              </Tr>
            ))}
          </tbody>
        </Table>
        <p className="border-t px-4 py-2 text-[11px] text-brand-500">
          Typical ranking page: {d.comparison.typical.wordCount?.toLocaleString() ?? "—"} words; search words in the title on {d.comparison.typical.keywordInTitle}, in the main heading on{" "}
          {d.comparison.typical.keywordInHeading}.
        </p>
      </Panel>

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
    </div>
  );
}
