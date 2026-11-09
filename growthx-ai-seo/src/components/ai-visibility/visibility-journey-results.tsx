"use client";

import { useState, useMemo, type ReactNode } from "react";
import { Bot, Code2, Layers, ShieldCheck, Zap } from "lucide-react";
import { ActionButton, Kpi, Panel, Pill } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { AnswerDocument, FormattedAnswer } from "./formatted-answer";
import {
  providerName,
  type VisibilityAnswer,
  type VisibilityContext,
  type VisibilityJourneyResponse,
  type VisibilityFact,
} from "@/lib/visibility-workflow";

const safeUrl = (value: string) => {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};
const label = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (s) => s.toUpperCase());

const objectValue = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
const textValue = (value: unknown) => typeof value === "string" ? value : "";
function factValue(fact: VisibilityFact): unknown {
  try { return JSON.parse(fact.text); } catch { return fact.text; }
}

const issueNames: Record<string, string> = {
  ORPHAN_PAGE: "No incoming internal links",
  THIN_CONTENT: "Limited page content",
  MULTIPLE_H1: "Multiple main headings",
  SHORT_TITLE: "Short page title",
  SCHEMA_PRODUCT_OFFERS: "Product offer information missing",
  SCHEMA_PRODUCT_AGGREGATERATING: "Optional product reviews or ratings missing",
};

function WebsiteEvidence({ value }: { value: Record<string, unknown> }) {
  const issues = Array.isArray(value.issues) ? value.issues : [];
  return (
    <div className="space-y-3">
      {textValue(value.title) && <h4 className="text-sm font-semibold text-brand-950">{textValue(value.title)}</h4>}
      {textValue(value.description) && <p className="text-sm leading-6 text-brand-600">{textValue(value.description)}</p>}
      {issues.length > 0 ? <div>
        <p className="mb-2 text-xs font-semibold text-brand-950">Recorded page findings</p>
        <ul className="space-y-3">
          {issues.map((item, i) => {
            const issue = objectValue(item);
            if (!issue) return null;
            const code = textValue(issue.issueType);
            const severity = textValue(issue.severity).toLowerCase();
            return <li key={i} className="border-l-2 pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-brand-950">{issueNames[code] || label(code) || "Page finding"}</span>
                {severity && <Pill tone={severity === "high" || severity === "critical" ? "warn" : "default"}>{label(severity)} severity</Pill>}
              </div>
              {textValue(issue.description) && <p className="mt-1 text-xs leading-5 text-brand-600">{textValue(issue.description)}</p>}
            </li>;
          })}
        </ul>
      </div> : <p className="text-xs text-brand-500">No page findings were included in this saved source.</p>}
    </div>
  );
}

function FactValue({
  value,
  depth = 0,
}: {
  value: unknown;
  depth?: number;
}): ReactNode {
  if (value == null) return <span>Not measured</span>;
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  if (typeof value !== "object")
    return <span className="break-words">{String(value)}</span>;
  if (depth > 4) return <span>See source for further detail.</span>;
  if (Array.isArray(value))
    return value.length ? (
      <ul className="list-disc space-y-1 pl-4">
        {value.slice(0, 25).map((v, i) => (
          <li key={i}>
            <FactValue value={v} depth={depth + 1} />
          </li>
        ))}
      </ul>
    ) : (
      <span>No rows recorded</span>
    );
  return (
    <dl className="space-y-1">
      {Object.entries(value).map(([k, v]) => (
        <div key={k}>
          <dt className="inline font-semibold">{label(k)}: </dt>
          <dd className="inline">
            <FactValue value={v} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EvidenceLinks({
  ids,
  context,
  answers,
}: {
  ids: string[];
  context: VisibilityContext | null;
  answers: VisibilityAnswer[];
}) {
  const evidenceIds = [...new Set(ids)];
  if (!evidenceIds.length) return <p className="mt-3 text-xs text-brand-500">No supporting sources were linked to this item.</p>;
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer font-semibold text-primary-700">
        Supporting evidence ({evidenceIds.length})
      </summary>
      <div className="mt-2 space-y-3">
        {evidenceIds.map((id) => {
          if (id === "owner")
            return (
              <p key={id} className="text-brand-600">
                Business details and questions reviewed by the workspace
                operator.
              </p>
            );
          const fact = context?.facts.find((f) => f.id === id);
          const answer = answers.find((a) => a.id === id);
          if (!fact && !answer) return <p key={id} className="text-brand-500">This referenced source is unavailable in the saved analysis.</p>;
          const value = fact ? factValue(fact) : null;
          const page = fact?.source === "website" ? objectValue(value) : null;
          const isPage = page && (typeof page.title === "string" || Array.isArray(page.issues));
          const url = fact?.url ? safeUrl(fact.url) : null;
          return (
            <Panel key={id} padded>
              <p className="mb-1 font-semibold text-brand-950">
                {fact
                  ? context?.sources.find((s) => s.id === fact.source)?.label ||
                    "Business profile"
                  : `${providerName(answer!.provider, answer!.model)} answer`}
              </p>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-2 block break-all text-primary-700"
                >
                  {url}
                </a>
              )}
              {fact ? (
                isPage ? <>
                  <WebsiteEvidence value={page!} />
                  <details className="mt-4 border-t pt-3 text-xs text-brand-500">
                    <summary className="cursor-pointer font-semibold">Technical details · original source</summary>
                    <div className="mt-3 max-h-80 overflow-auto pr-2"><FactValue value={value} /></div>
                  </details>
                </> : typeof value === "string" ? <FormattedAnswer text={value} /> : <FactValue value={value} />
              ) : (
                <>
                  <p className="mb-2 text-sm font-semibold text-brand-950">{answer!.promptText}</p>
                  <Pill>Answer result: {answer!.errorMessage ? "Check failed" : !answer!.analysis ? "Awaiting analysis" : answer!.analysis.recommended ? "Recommended" : answer!.analysis.brandMentioned ? "Mentioned only" : "Not mentioned"}</Pill>
                  {answer!.rawResponse ? <div className="mt-3"><FormattedAnswer text={answer!.rawResponse} /></div> : <p className="mt-2 text-brand-500">No answer text was saved.</p>}
                </>
              )}
            </Panel>
          );
        })}
      </div>
    </details>
  );
}

export function AnswerResults({ data }: { data: VisibilityJourneyResponse }) {
  const [filter, setFilter] = useState("ALL");
  const [showAll, setShowAll] = useState(false);
  const assistants = [...new Set([...data.providers.map((p) => p.provider), ...data.answers.map((a) => a.provider)])];
  const measured = data.answers.filter((a) => !a.errorMessage && a.analysis);
  const mentions = measured.filter((a) => a.analysis?.brandMentioned).length;
  const recommended = measured.filter((a) => a.analysis?.recommended).length;
  const failed = data.answers.filter((a) => a.errorMessage).length;
  const visible = data.answers.filter(
    (a) => filter === "ALL" || a.provider === filter,
  );

  const assistantStats = useMemo(() => {
    return assistants.map((p) => {
      const providerAnswers = data.answers.filter((a) => a.provider === p);
      const valid = providerAnswers.filter((a) => !a.errorMessage && a.analysis);
      const pMentions = valid.filter((a) => a.analysis?.brandMentioned).length;
      const pRecommended = valid.filter((a) => a.analysis?.recommended).length;
      const recRate = valid.length ? Math.round((pRecommended / valid.length) * 100) : 0;
      const sampleModel = providerAnswers[0]?.model || data.providers.find((pr) => pr.provider === p)?.model;
      const name = providerName(p, sampleModel);
      return {
        provider: p,
        name,
        model: sampleModel,
        total: providerAnswers.length,
        valid: valid.length,
        mentions: pMentions,
        recommended: pRecommended,
        recRate,
      };
    });
  }, [assistants, data.answers, data.providers]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Answers measured"
          value={measured.length ? String(measured.length) : "—"}
          sub={`${data.answers.length} responses saved · ${failed} failed`}
        />
        <Kpi
          label="Business mentioned"
          value={measured.length ? `${mentions} / ${measured.length}` : "—"}
          sub="Your name appears in the answer"
        />
        <Kpi
          label="Business recommended"
          value={measured.length ? `${recommended} / ${measured.length}` : "—"}
          sub="A positive recommendation with a matching quote"
        />
        <Kpi
          label="Recommendation rate"
          value={
            measured.length
              ? `${Math.round((recommended / measured.length) * 100)}%`
              : "—"
          }
          sub="Of successfully classified answers"
        />
      </div>

      {/* ── MULTI-LLM HEAD-TO-HEAD BREAKDOWN ── */}
      {assistantStats.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-400">
            AI Assistant Performance Breakdown
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {assistantStats.map((item) => (
              <div
                key={item.provider}
                className="rounded-xl border border-line bg-surface p-4 shadow-xs"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface-2 font-bold text-brand-950">
                      <Bot size={15} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-brand-950">{item.name}</p>
                      <p className="max-w-[120px] truncate font-mono text-[10px] text-brand-400">
                        {item.model || item.provider}
                      </p>
                    </div>
                  </div>
                  {item.valid > 0 ? (
                    item.recRate >= 50 ? (
                      <span className="inline-flex items-center gap-0.5 rounded border border-success-500/20 bg-success-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-success-700">
                        Strong
                      </span>
                    ) : item.recRate > 0 || item.mentions > 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded border border-warning-500/20 bg-warning-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning-700">
                        Moderate
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-brand-500">
                        Gap
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] font-medium text-brand-400">Pending</span>
                  )}
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-brand-500">Recommendation Rate</span>
                    <span className="font-mono font-bold text-brand-950">
                      {item.valid > 0 ? `${item.recRate}%` : "—"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.recRate >= 50
                          ? "bg-success-500"
                          : item.recRate > 0
                            ? "bg-warning-500"
                            : "bg-brand-300"
                      }`}
                      style={{ width: `${item.recRate}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between font-mono text-[10.5px] text-brand-400">
                    <span>
                      {item.recommended}/{item.valid} recommended
                    </span>
                    <span>{item.mentions} mentioned</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── GEO OPTIMIZATION PLAYBOOK ── */}
      <Panel
        title="Generative Engine Optimization (GEO) Playbook"
        subtitle="Actionable engineering patterns to get recommended by ChatGPT, Google Gemini, Perplexity, and Claude."
        padded
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-line bg-surface-2/30 p-3.5">
            <div className="flex items-center gap-2 text-primary-700">
              <Zap size={16} aria-hidden="true" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-950">
                Direct Answer Geometry
              </h4>
            </div>
            <p className="mt-2 text-xs leading-5 text-brand-600">
              Place direct, 40-50 word factual answers immediately below H2 question headings.
              Generative models extract these verbatim for synthesis snippets.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-surface-2/30 p-3.5">
            <div className="flex items-center gap-2 text-brand-700">
              <Code2 size={16} aria-hidden="true" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-950">
                Entity Schema Grounding
              </h4>
            </div>
            <p className="mt-2 text-xs leading-5 text-brand-600">
              Deploy{" "}
              <code className="rounded border border-line bg-surface px-1 py-0.5 font-mono text-[11px]">
                Organization
              </code>{" "}
              and{" "}
              <code className="rounded border border-line bg-surface px-1 py-0.5 font-mono text-[11px]">
                SameAs
              </code>{" "}
              schema linking official profiles to anchor your entity in LLM memory.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-surface-2/30 p-3.5">
            <div className="flex items-center gap-2 text-success-700">
              <ShieldCheck size={16} aria-hidden="true" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-950">
                AI Crawler Access
              </h4>
            </div>
            <p className="mt-2 text-xs leading-5 text-brand-600">
              Ensure your{" "}
              <code className="rounded border border-line bg-surface px-1 py-0.5 font-mono text-[11px]">
                robots.txt
              </code>{" "}
              allows{" "}
              <code className="rounded border border-line bg-surface px-1 py-0.5 font-mono text-[11px]">
                GPTBot
              </code>
              ,{" "}
              <code className="rounded border border-line bg-surface px-1 py-0.5 font-mono text-[11px]">
                PerplexityBot
              </code>
              , and{" "}
              <code className="rounded border border-line bg-surface px-1 py-0.5 font-mono text-[11px]">
                ClaudeBot
              </code>{" "}
              without blocking rules.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-surface-2/30 p-3.5">
            <div className="flex items-center gap-2 text-warning-700">
              <Layers size={16} aria-hidden="true" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-950">
                Third-Party Consensus
              </h4>
            </div>
            <p className="mt-2 text-xs leading-5 text-brand-600">
              LLMs weight unbiased third-party citations. Build verified profiles on industry
              directories, software review portals, and high-domain authority roundups.
            </p>
          </div>
        </div>
      </Panel>
      <Panel
        title="What did each assistant actually say?"
        subtitle="Saved API answers to your reviewed buyer questions. Consumer apps and Google AI Overviews are not measured here."
        padded
      >
        <label className="mb-4 flex flex-wrap items-center gap-3 text-xs text-brand-600">Assistant
          <select aria-label="Filter answers by assistant" value={filter} onChange={(e) => {setFilter(e.target.value); setShowAll(false);}} className="rounded-lg border bg-white px-3 py-2 text-sm text-brand-950">
            {["ALL", ...assistants].map((p) => {
              const sampleModel = data.answers.find((a) => a.provider === p)?.model || data.providers.find((pr) => pr.provider === p)?.model;
              return <option key={p} value={p}>{p === "ALL" ? "All assistants" : providerName(p, sampleModel)}</option>;
            })}
          </select><span>{visible.length} saved answer{visible.length === 1 ? "" : "s"}</span>
        </label>
        <QueryState
          isEmpty={!visible.length}
          emptyTitle="No answers saved yet"
          emptyBody="Review the buyer questions and start the checks. Answers appear here as they are saved."
        >
          <div className="divide-y">
            {(showAll ? visible : visible.slice(0, 5)).map((a) => (
              <article key={a.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>{providerName(a.provider, a.model)}</Pill>
                  <span className="text-xs text-brand-400">
                    {a.model} · {new Date(a.createdAt).toLocaleString()}
                  </span>
                  <Pill
                    tone={
                      a.errorMessage
                        ? "bad"
                        : !a.analysis
                          ? "warn"
                          : a.analysis.recommended
                            ? "good"
                            : "default"
                    }
                  >
                    {a.errorMessage
                      ? "Check failed"
                      : !a.analysis
                        ? "Awaiting analysis"
                        : a.analysis.recommended
                          ? "Recommended"
                          : a.analysis.brandMentioned
                            ? "Mentioned only"
                            : "Not mentioned"}
                  </Pill>
                </div>
                <h3 className="text-base font-semibold leading-7 text-brand-950">
                  {a.promptText}
                </h3>
                {a.errorMessage && (
                  <p className="text-sm text-error-700">{a.errorMessage}</p>
                )}
                {!!a.mentions.filter((m) => !m.isCustomer).length && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-brand-600">
                    <span>Other brands named:</span>
                    {a.mentions
                      .filter((m) => !m.isCustomer)
                      .map((m) => <Pill key={m.brandName}>{m.brandName}</Pill>)}
                  </div>
                )}
                {a.analysis?.parsedJson?.recommendationQuote && (
                  <blockquote className="border-l-2 pl-3 text-sm text-brand-700">
                    {a.analysis.parsedJson.recommendationQuote}
                  </blockquote>
                )}
                {a.rawResponse && (
                  <details>
                    <summary className="cursor-pointer rounded-sm py-1 text-sm font-semibold text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-4">
                      Read complete answer
                    </summary>
                    <AnswerDocument text={a.rawResponse} assistant={providerName(a.provider, a.model)} />
                  </details>
                )}
                {!!a.citations.length && (
                  <details className="space-y-1"><summary className="cursor-pointer text-xs text-brand-500">Sources in this answer ({a.citations.length}) · not independently verified</summary>
                    {a.citations.map(
                      (c) =>
                        safeUrl(c.url) && (
                          <a
                            key={c.url}
                            href={safeUrl(c.url)!}
                            target="_blank"
                            rel="noreferrer"
                            className="block break-all text-xs text-primary-700"
                          >
                            {c.url}
                          </a>
                        ),
                    )}
                  </details>
                )}
              </article>
            ))}
          </div>
          {visible.length > 5 && <ActionButton onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer answers" : `Show all ${visible.length} answers`}</ActionButton>}
        </QueryState>
      </Panel>
    </div>
  );
}

export function GapResults({ data }: { data: VisibilityJourneyResponse }) {
  const assessments = data.journey?.analysis ?? [];
  const assistants = [...new Set([...data.providers.map((p) => p.provider), ...data.answers.map((a) => a.provider)])];
  const measured = data.answers.filter((a) => a.analysis && !a.errorMessage);
  const rivals = new Map<string, number>();
  for (const a of measured)
    for (const name of new Set(
      a.mentions.filter((m) => !m.isCustomer).map((m) => m.brandName),
    ))
      rivals.set(name, (rivals.get(name) ?? 0) + 1);
  return (
    <div className="space-y-4">
      <Panel
        title="Who appears alongside you?"
        subtitle="Observed brand mentions across this run, including rivals you have not tracked yet."
        padded
      >
        {rivals.size ? (
          <div className="flex flex-wrap gap-3">
            {[...rivals]
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => (
                <Pill key={name}>
                  {name} · {count} / {measured.length} answers
                </Pill>
              ))}
          </div>
        ) : (
          <p className="text-sm text-brand-500">
            {measured.length
              ? "No other brand names were confirmed in the analysed answers."
              : "Run and analyse the buyer questions to see named competitors."}
          </p>
        )}
      </Panel>
      <Panel
        title="Observed differences and possible explanations"
        subtitle="These are assessments from your saved evidence. They do not reveal an AI model’s internal ranking reasons."
        padded
      >
        <QueryState
          isEmpty={!assessments.some((a) => a.gaps.length)}
          emptyTitle="No evidenced competitor gaps yet"
          emptyBody="A named rival needs answer evidence and a website comparison. Add or crawl it in Competitor Intelligence when evidence is missing."
        >
          <div className="space-y-5">
            {assessments.flatMap((a) =>
              a.gaps.map((g, i) => (
                <article
                  key={`${a.provider}-${i}`}
                  className="border-b pb-4 last:border-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-brand-950">
                      {g.competitor}
                    </h3>
                    <Pill>{providerName(a.provider, a.model)} assessment</Pill>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-brand-600">
                    <strong className="text-brand-950">Observation: </strong>
                    {g.observation}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-brand-600">
                    <strong className="text-brand-950">
                      Possible explanation:{" "}
                    </strong>
                    {g.hypothesis}
                  </p>
                  <EvidenceLinks
                    ids={g.evidenceIds}
                    context={data.journey?.context ?? null}
                    answers={data.answers}
                  />
                </article>
              )),
            )}
          </div>
        </QueryState>
      </Panel>
    </div>
  );
}
