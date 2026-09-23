"use client";

import React, { useMemo } from "react";
import { CheckCircle2, XCircle, MinusCircle, AlertTriangle, ExternalLink } from "lucide-react";
import type { TrackedPromptRow, VisibilityReport } from "@/lib/api-client";
import { assistantLabel, assistantList } from "@/lib/ai-assistants";

type LatestCheck = TrackedPromptRow["latestChecks"][number];

/** Latest check per assistant for a prompt (rows arrive newest first). */
function latestByAssistant(row: TrackedPromptRow): Map<string, LatestCheck> {
  const map = new Map<string, LatestCheck>();
  for (const check of row.latestChecks ?? []) {
    if (!map.has(check.assistant)) map.set(check.assistant, check);
  }
  return map;
}

function CheckCell({ check }: { check?: LatestCheck }) {
  if (!check) {
    return (
      <span className="inline-flex items-center gap-1 text-brand-400 text-[11px]">
        <MinusCircle size={12} />
        <span>Not asked yet</span>
      </span>
    );
  }
  if (check.error) {
    return (
      <span title={check.error} className="inline-flex items-center gap-1 text-warning-700 text-[11px]">
        <AlertTriangle size={12} />
        <span>Could not ask</span>
      </span>
    );
  }
  return check.cited ? (
    <span className="inline-flex items-center gap-1 text-success-700 font-semibold text-[11px] bg-success-50 px-2 py-0.5 rounded-full border">
      <CheckCircle2 size={12} className="text-success-500" />
      <span>Cited{check.position ? ` · #${check.position}` : ""}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-error-700 font-semibold text-[11px] bg-error-50 px-2 py-0.5 rounded-full border">
      <XCircle size={12} className="text-error-500" />
      <span>Not cited</span>
    </span>
  );
}

// ── Citations Tab ──────────────────────────────────────────────────────────────
export function CitationsTabContent({
  promptList,
  report,
  onAddQuery,
}: {
  promptList: TrackedPromptRow[];
  report?: VisibilityReport | null;
  onAddQuery: () => void;
}) {
  const assistants = report?.measurableAssistants?.length ? report.measurableAssistants : ["SARVAM"];

  // Domains named in the latest measured answers, counted per answer.
  const citedSources = useMemo(() => {
    const domainMap = new Map<string, { count: number; assistants: Set<string> }>();
    const add = (domain: string, assistant: string) => {
      if (!domain) return;
      const item = domainMap.get(domain) ?? { count: 0, assistants: new Set<string>() };
      item.count += 1;
      item.assistants.add(assistant);
      domainMap.set(domain, item);
    };

    for (const row of promptList) {
      for (const check of latestByAssistant(row).values()) {
        if (check.error) continue;
        if (check.citedUrl) {
          try {
            add(new URL(check.citedUrl).hostname.replace(/^www\./, ""), check.assistant);
          } catch {
            // Not a URL; the brand was cited by name only.
          }
        }
        for (const c of check.competitorsCited ?? []) {
          add(c.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0], check.assistant);
        }
      }
    }

    return Array.from(domainMap.entries())
      .map(([domain, data]) => ({ domain, answers: data.count, assistants: Array.from(data.assistants) }))
      .sort((a, b) => b.answers - a.answers);
  }, [promptList]);

  const checked = report?.summary?.checked ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400">Domains Named</span>
          <p className="mt-2 text-[26px] font-bold text-brand-950">{citedSources.length}</p>
          <p className="mt-1 text-[11.5px] text-brand-500">In the latest answers to {promptList.length} tracked questions</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400">Answers Checked</span>
          <p className="mt-2 text-[26px] font-bold text-brand-950">{checked > 0 ? checked : "—"}</p>
          <p className="mt-1 text-[11.5px] text-brand-500">From {assistantList(assistants)}, last 28 days</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400">Your Brand Cited</span>
          <p className="mt-2 text-[26px] font-bold text-success-600">
            {checked > 0 ? `${report?.summary?.cited ?? 0} of ${checked}` : "—"}
          </p>
          <p className="mt-1 text-[11.5px] text-brand-500">
            {checked > 0 ? "Answers that named your domain or brand" : "Run AI Visibility to measure"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-xs">
        <div className="pb-3 border-b">
          <h3 className="text-[14.5px] font-bold text-brand-950">Domains Named in AI Answers</h3>
          <p className="mt-0.5 text-[11.5px] text-brand-500">
            Your site and tracked competitors, as they appeared in the latest answers from {assistantList(assistants)}.
          </p>
        </div>

        {citedSources.length === 0 ? (
          <div className="p-8 text-center text-brand-400 text-xs">
            No domains named yet. Run AI Visibility and add competitors to see who the answers mention.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b text-[11px] font-medium text-brand-400">
                  <th className="py-2.5 pl-2 font-medium">Domain</th>
                  <th className="py-2.5 font-medium">Answers naming it</th>
                  <th className="py-2.5 pr-2 font-medium">Named by</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {citedSources.map((source) => (
                  <tr key={source.domain} className="hover:bg-brand-50/70">
                    <td className="py-3 pl-2 font-bold text-brand-950">
                      <a
                        href={`https://${source.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 hover:underline"
                      >
                        {source.domain}
                        <ExternalLink size={11} className="text-brand-400" />
                      </a>
                    </td>
                    <td className="py-3 font-bold text-brand-950">{source.answers}</td>
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-1.5">
                        {source.assistants.map((a) => (
                          <span key={a} className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                            {assistantLabel(a)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h3 className="text-[14.5px] font-bold text-brand-950">Tracked Questions &amp; Latest Answers</h3>
            <p className="mt-0.5 text-[11.5px] text-brand-500">
              Each question as a buyer would ask it, and whether the latest answer cited you.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddQuery}
            className="rounded-lg border bg-white px-2.5 py-1 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
          >
            + Add Query
          </button>
        </div>

        {promptList.length === 0 ? (
          <div className="p-8 text-center text-brand-400 text-xs">
            No queries configured yet. Click &quot;+ Add Query&quot; above to begin monitoring.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b text-[11px] font-medium text-brand-400">
                  <th className="py-2.5 pl-2 font-medium">Query</th>
                  <th className="py-2.5 font-medium">Cluster</th>
                  {assistants.map((a) => (
                    <th key={a} className="py-2.5 font-medium">
                      {assistantLabel(a)}
                    </th>
                  ))}
                  <th className="py-2.5 pr-2 font-medium">Answer</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {promptList.map((row) => {
                  const checks = latestByAssistant(row);
                  const withAnswer = assistants.map((a) => checks.get(a)).find((c) => c?.answerExcerpt);
                  return (
                    <tr key={row.id} className="align-top hover:bg-brand-50/70">
                      <td className="py-3 pl-2 font-semibold text-brand-950">{row.text}</td>
                      <td className="py-3">
                        {row.cluster ? (
                          <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[10.5px] font-medium text-brand-700">
                            {row.cluster}
                          </span>
                        ) : (
                          <span className="text-brand-400">—</span>
                        )}
                      </td>
                      {assistants.map((a) => (
                        <td key={a} className="py-3">
                          <CheckCell check={checks.get(a)} />
                        </td>
                      ))}
                      <td className="py-3 pr-2 max-w-sm">
                        {withAnswer ? (
                          <details className="text-[11.5px] text-brand-600">
                            <summary className="cursor-pointer font-semibold text-accent-600">
                              View {assistantLabel(withAnswer.assistant)}&apos;s answer
                            </summary>
                            <p className="mt-1.5 whitespace-pre-line leading-relaxed">{withAnswer.answerExcerpt}</p>
                          </details>
                        ) : (
                          <span className="text-brand-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Content Gaps Tab ───────────────────────────────────────────────────────────
/**
 * Questions where the latest measured answer named a competitor but not you.
 * Every row is a real answer; nothing here is estimated.
 */
export function ContentGapsTabContent({
  promptList,
  onAddQuery,
}: {
  promptList: TrackedPromptRow[];
  onAddQuery: () => void;
}) {
  const gaps = useMemo(
    () =>
      promptList.flatMap((row) =>
        Array.from(latestByAssistant(row).values())
          .filter((c) => !c.error && !c.cited && (c.competitorsCited?.length ?? 0) > 0)
          .map((c) => ({ id: `${row.id}-${c.assistant}`, query: row.text, check: c })),
      ),
    [promptList],
  );

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b">
        <div>
          <h3 className="text-[14.5px] font-bold text-brand-950">AI Content Gaps</h3>
          <p className="mt-0.5 text-[11.5px] text-brand-500">
            Tracked questions where the AI answer named a competitor instead of you.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddQuery}
          className="rounded-lg border bg-white px-2.5 py-1 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
        >
          + Add Target Topic
        </button>
      </div>

      {gaps.length === 0 ? (
        <div className="p-8 text-center text-[12px] text-brand-500">
          No gaps found in the latest answers. A gap appears here when an answer names one of your tracked competitors
          but not you — add competitors and run AI Visibility to find them.
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b text-[11px] font-medium text-brand-400">
                <th className="py-2.5 pl-2 font-medium">Question</th>
                <th className="py-2.5 font-medium">Assistant</th>
                <th className="py-2.5 font-medium">Named instead of you</th>
                <th className="py-2.5 pr-2 font-medium">What it said</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {gaps.map((gap) => (
                <tr key={gap.id} className="align-top hover:bg-brand-50/70">
                  <td className="py-3.5 pl-2 font-bold text-brand-950 max-w-[220px]">{gap.query}</td>
                  <td className="py-3.5 text-brand-700">{assistantLabel(gap.check.assistant)}</td>
                  <td className="py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {gap.check.competitorsCited.map((c) => (
                        <span key={c} className="rounded-md bg-error-50 px-2 py-0.5 text-[10.5px] font-semibold text-error-700 border">
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 pr-2 text-brand-500 text-[11.5px] max-w-sm">
                    {gap.check.answerExcerpt ? (
                      <details>
                        <summary className="cursor-pointer font-semibold text-accent-600">View answer</summary>
                        <p className="mt-1.5 whitespace-pre-line leading-relaxed">{gap.check.answerExcerpt}</p>
                      </details>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
