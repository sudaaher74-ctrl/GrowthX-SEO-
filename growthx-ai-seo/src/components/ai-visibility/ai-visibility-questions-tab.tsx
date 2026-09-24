"use client";

import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  ExternalLink,
  FileWarning,
  FilePlus2,
  FileCheck2,
  Lightbulb,
  Loader2,
  Plus,
  Quote,
} from "lucide-react";
import { useAddPrompts, useQuestionAnalysis, useQuestionSuggestions } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";
import { assistantLabel } from "@/lib/ai-assistants";
import type { QuestionAnalysis, QuestionSuggestion } from "@/lib/api-client";

const SOURCE_LABEL: Record<QuestionSuggestion["source"], string> = {
  OWN_PAGE: "Your page",
  RIVAL_PAGE: "Rival topic",
  CONTENT_GAP: "Content gap",
};

const SOURCE_CLUSTER: Record<QuestionSuggestion["source"], string> = {
  OWN_PAGE: "buyer · your page",
  RIVAL_PAGE: "buyer · rival topic",
  CONTENT_GAP: "buyer · content gap",
};

function pathOf(url: string) {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function Outcome({ q }: { q: QuestionAnalysis }) {
  if (q.outcome === "CITED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
        <CheckCircle2 size={12} /> Cited{q.answer?.position ? ` · #${q.answer.position}` : ""}
      </span>
    );
  }
  if (q.outcome === "NOT_CITED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-error-50 px-2 py-0.5 text-[11px] font-semibold text-error-700">
        <XCircle size={12} /> Not cited
      </span>
    );
  }
  if (q.outcome === "FAILED") {
    return (
      <span title={q.failure ?? undefined} className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-700">
        <AlertTriangle size={12} /> Could not ask
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-600">
      <MinusCircle size={12} /> Not asked yet
    </span>
  );
}

function OwnPage({ q, auditAvailable }: { q: QuestionAnalysis; auditAvailable: boolean }) {
  if (!auditAvailable) {
    return <p className="text-[12px] text-brand-500">Run a Website Audit to see which of your pages should answer this.</p>;
  }
  if (!q.ownPage) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-warning-50 p-3 text-[12px] text-warning-700">
        <FilePlus2 size={14} className="mt-0.5 shrink-0" />
        <span>
          <strong>No page on your site answers this.</strong> That is a content gap: an assistant has nothing of yours to cite.
        </span>
      </div>
    );
  }
  const page = q.ownPage;
  return (
    <div className="space-y-2">
      <a href={page.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-700 hover:underline">
        {page.issues.length > 0 ? <FileWarning size={14} className="text-warning-600" /> : <FileCheck2 size={14} className="text-success-600" />}
        {pathOf(page.url)}
        <ExternalLink size={11} />
      </a>
      {page.title && <p className="text-[11.5px] text-brand-500">{page.title}</p>}
      {page.issues.length > 0 ? (
        <ul className="space-y-1">
          {page.issues.slice(0, 5).map((issue) => (
            <li key={issue.issueType} className="text-[11.5px] text-brand-700">
              <span className="mr-1.5 rounded bg-warning-50 px-1.5 py-0.5 text-[10px] font-bold text-warning-700">{issue.severity}</span>
              {issue.description}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11.5px] text-brand-500">The latest audit found no open issues on this page.</p>
      )}
      {page.signals.missingTerms.length > 0 && (
        <p className="text-[11.5px] text-brand-500">
          Never uses: {page.signals.missingTerms.map((t) => `"${t}"`).join(", ")}
        </p>
      )}
    </div>
  );
}

function RivalComparison({ q }: { q: QuestionAnalysis }) {
  const uncrawled = q.rivals.filter((r) => !r.crawled);
  const noMatch = q.rivals.filter((r) => r.crawled && !r.page);
  if (q.rivals.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-brand-400">Why the rival was named — from both crawls</p>
      {q.comparison.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-[11.5px]">
            <thead className="bg-brand-50 text-[10.5px] uppercase tracking-wider text-brand-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Signal</th>
                <th className="px-3 py-2 font-semibold">You</th>
                <th className="px-3 py-2 font-semibold">Rival</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {q.comparison.map((row) => (
                <tr key={`${row.rivalDomain}-${row.signal}`} className={row.rivalAhead ? "bg-error-50/40" : undefined}>
                  <td className="px-3 py-2 text-brand-700">
                    {row.label}
                    <span className="block text-[10px] text-brand-400">{row.rivalDomain}</span>
                  </td>
                  <td className="px-3 py-2 font-semibold text-brand-950">{row.you}</td>
                  <td className={`px-3 py-2 font-semibold ${row.rivalAhead ? "text-error-700" : "text-brand-950"}`}>{row.rival}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {q.rivals
        .filter((r) => r.page)
        .map((r) => (
          <a key={r.domain} href={r.page!.url} target="_blank" rel="noopener noreferrer" className="mr-3 inline-flex items-center gap-1 text-[11.5px] text-accent-700 hover:underline">
            {r.label}: {pathOf(r.page!.url)} <ExternalLink size={10} />
          </a>
        ))}
      {uncrawled.length > 0 && (
        <p className="text-[11.5px] text-brand-500">
          {uncrawled.map((r) => r.label).join(", ")} {uncrawled.length === 1 ? "has" : "have"} not been crawled yet, so there is no page to compare.
          Add {uncrawled.length === 1 ? "it" : "them"} in Competitor Intelligence to crawl.
        </p>
      )}
      {noMatch.length > 0 && (
        <p className="text-[11.5px] text-brand-500">
          No page on {noMatch.map((r) => r.domain).join(", ")} matched this question in the latest crawl.
        </p>
      )}
    </div>
  );
}

function QuestionCard({ q, auditAvailable }: { q: QuestionAnalysis; auditAvailable: boolean }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-[13.5px] font-bold text-brand-950">&ldquo;{q.text}&rdquo;</p>
        <Outcome q={q} />
      </div>
      {q.answer && (
        <p className="mt-1 text-[11.5px] text-brand-500">
          {assistantLabel(q.answer.assistant)}
          {q.answer.competitorsCited.length > 0 ? ` named ${q.answer.competitorsCited.join(", ")}` : " named no tracked competitor"}
          {" · "}
          {new Date(q.answer.checkedAt).toLocaleDateString()}
        </p>
      )}

      {q.group === "BUYER" ? (
        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-400">Your page for this question</p>
            <OwnPage q={q} auditAvailable={auditAvailable} />
          </div>
          <RivalComparison q={q} />
        </div>
      ) : null}

      {q.answer?.answerExcerpt && (
        <details className="mt-3 text-[11.5px] text-brand-600">
          <summary className="cursor-pointer font-semibold text-accent-700">
            <Quote size={11} className="mr-1 inline" />
            What {assistantLabel(q.answer.assistant)} said
          </summary>
          <p className="mt-1.5 whitespace-pre-line leading-relaxed">{q.answer.answerExcerpt}</p>
        </details>
      )}
    </div>
  );
}

function Suggestions({ projectId }: { projectId: string | null }) {
  const suggestionsQuery = useQuestionSuggestions(projectId);
  const addPrompts = useAddPrompts(projectId);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const data = suggestionsQuery.data;

  if (suggestionsQuery.isLoading) return null;
  if (!data) return null;

  const toggle = (text: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      return next;
    });

  const track = async () => {
    setError(null);
    try {
      const chosen = data.suggestions.filter((s) => picked.has(s.text));
      await addPrompts.mutateAsync(chosen.map((s) => ({ text: s.text, cluster: SOURCE_CLUSTER[s.source] })));
      setPicked(new Set());
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div className="flex items-start gap-2">
          <Lightbulb size={16} className="mt-0.5 text-warning-600" />
          <div>
            <h3 className="text-[14px] font-bold text-brand-950">Suggested buyer questions</h3>
            <p className="text-[11.5px] text-brand-500">
              From {data.basedOn.ownPages} of your audited pages, {data.basedOn.rivalPages} crawled rival pages and{" "}
              {data.basedOn.contentGaps} open content gaps. Questions that name your brand are never suggested.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={track}
          disabled={picked.size === 0 || addPrompts.isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-950 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {addPrompts.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Track {picked.size > 0 ? picked.size : ""} selected
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-error-700">{error}</p>}
      {data.suggestions.length === 0 ? (
        <p className="mt-3 text-[12px] text-brand-500">
          {data.basedOn.ownPages === 0
            ? "Run a Website Audit first: suggestions come from your own pages and your competitors' pages."
            : "No new suggestions — every question we could draw from your pages and competitors is already tracked."}
        </p>
      ) : (
        <ul className="mt-3 divide-y">
          {data.suggestions.map((s) => (
            <li key={s.text} className="flex items-start gap-3 py-2.5">
              <input
                type="checkbox"
                checked={picked.has(s.text)}
                onChange={() => toggle(s.text)}
                className="mt-1"
                aria-label={`Track "${s.text}"`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-brand-950">{s.text}</p>
                <p className="text-[11px] text-brand-500">
                  <span className="mr-1.5 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">{SOURCE_LABEL[s.source]}</span>
                  {s.evidence}{" "}
                  {s.evidenceUrl && (
                    <a href={s.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:underline">
                      {pathOf(s.evidenceUrl)}
                    </a>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AiVisibilityQuestionsTab({ projectId }: { projectId: string | null }) {
  const analysisQuery = useQuestionAnalysis(projectId);
  const report = analysisQuery.data;

  const { buyer, reputation } = useMemo(() => {
    const qs = report?.questions ?? [];
    return { buyer: qs.filter((q) => q.group === "BUYER"), reputation: qs.filter((q) => q.group === "REPUTATION") };
  }, [report?.questions]);

  return (
    <div className="space-y-6">
      <Suggestions projectId={projectId} />

      {analysisQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border bg-white p-6 text-[12.5px] text-brand-500 shadow-xs">
          <Loader2 size={15} className="animate-spin" /> Joining your questions to the audit and competitor crawls…
        </div>
      ) : analysisQuery.isError ? (
        <div className="rounded-2xl border bg-error-50 p-5 text-[12.5px] text-error-700">
          Could not load the question analysis: {errorMessage(analysisQuery.error)}
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Buyer questions", value: buyer.length, sub: "Count toward citation share" },
              { label: "Reputation questions", value: reputation.length, sub: "Name your brand; tracked apart" },
              { label: "Your audited pages", value: report.auditedPages, sub: report.auditAvailable ? "From the latest Website Audit" : "No audit yet" },
              { label: "Competitors crawled", value: `${report.competitorsCrawled} / ${report.competitorsTracked}`, sub: "Needed to explain why a rival won" },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border bg-white p-4 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400">{k.label}</span>
                <p className="mt-1.5 text-[22px] font-bold text-brand-950">{k.value}</p>
                <p className="text-[11px] text-brand-500">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-[14px] font-bold text-brand-950">Buyer questions</h3>
            {buyer.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-brand-50/50 p-6 text-center text-[12.5px] text-brand-500">
                No buyer questions tracked yet. Pick some from the suggestions above — citation share is measured only on these.
              </p>
            ) : (
              buyer.map((q) => <QuestionCard key={q.id} q={q} auditAvailable={report.auditAvailable} />)
            )}
          </div>

          {reputation.length > 0 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-[14px] font-bold text-brand-950">Reputation questions</h3>
                <p className="text-[11.5px] text-brand-500">
                  These name your brand, so the answer almost always repeats it. They show how you are described, not whether new buyers find you.
                </p>
              </div>
              {reputation.map((q) => (
                <QuestionCard key={q.id} q={q} auditAvailable={report.auditAvailable} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
