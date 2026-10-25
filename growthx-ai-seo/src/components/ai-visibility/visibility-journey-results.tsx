"use client";

import { useState, type ReactNode } from "react";
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
                  : `${providerName(answer!.provider)} answer`}
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
  return (
    <div className="space-y-4">
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
      <Panel
        title="What did each assistant actually say?"
        subtitle="Saved API answers to your reviewed buyer questions. Consumer apps and Google AI Overviews are not measured here."
        padded
      >
        <label className="mb-4 flex flex-wrap items-center gap-3 text-xs text-brand-600">Assistant
          <select aria-label="Filter answers by assistant" value={filter} onChange={(e) => {setFilter(e.target.value); setShowAll(false);}} className="rounded-lg border bg-white px-3 py-2 text-sm text-brand-950">
            {["ALL", ...assistants].map((p) => <option key={p} value={p}>{p === "ALL" ? "All assistants" : providerName(p)}</option>)}
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
                  <Pill>{providerName(a.provider)}</Pill>
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
                    <AnswerDocument text={a.rawResponse} assistant={providerName(a.provider)} />
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
                    <Pill>{providerName(a.provider)} assessment</Pill>
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

export function ActionPlan({ data }: { data: VisibilityJourneyResponse }) {
  const assessments = data.journey?.analysis ?? [];
  const measured = data.answers.filter((answer) => !answer.errorMessage && answer.analysis);
  const mentioned = measured.filter((answer) => answer.analysis!.brandMentioned).length;
  const recommended = measured.filter((answer) => answer.analysis!.recommended).length;
  const context = data.journey?.context ?? null;
  return (
    <QueryState
      isEmpty={!assessments.length}
      emptyTitle="Your action plan follows the AI checks"
      emptyBody="The plan combines your service areas, Google performance, website gaps and actual AI answers. Missing data will be stated."
    >
      <div className="space-y-5">
        {assessments.length > 0 && <Panel padded title="What the saved answers show" subtitle="Uses the same classified answers as your reviewed buyer prompts.">
          <p className="text-sm font-semibold leading-6 text-brand-950">
            {measured.length ? `${recommended} ${recommended === 1 ? "recommendation" : "recommendations"} across ${measured.length} measured ${measured.length === 1 ? "answer" : "answers"}. Your business was mentioned ${mentioned} ${mentioned === 1 ? "time" : "times"}.` : "No successfully classified answers are available yet."}
          </p>
          <p className="mt-2 text-xs leading-5 text-brand-600">These results measure saved AI answers. They do not establish search demand, enquiries, or sales.</p>
          {context && <p className="mt-2 text-xs text-brand-500">{context.keyEvents == null ? "Lead measurement is unavailable in this run." : `${context.keyEvents} key events recorded in the saved analytics data; these are not necessarily leads.`}</p>}
        </Panel>}
        {assessments.map((a) => (
          <Panel
            key={a.provider}
            title={`${providerName(a.provider)} · Action plan`}
            subtitle={`${a.actions.length} suggested actions · Review evidence before making changes`}
            padded
          >
            <details className="mb-5 border-b pb-4 text-sm">
              <summary className="cursor-pointer font-semibold text-primary-700">Original assistant commentary · unverified interpretation</summary>
              <p className="my-3 text-xs leading-5 text-brand-600">The measured results above take precedence over this generated interpretation. Verify any recommendation or demand claim against its saved evidence.</p>
              <FormattedAnswer text={a.summary} />
              {a.localDemand && <div className="mt-4"><h3 className="mb-2 text-sm font-semibold text-brand-950">Assistant view on local opportunity</h3><FormattedAnswer text={a.localDemand} /></div>}
              <p className="mt-3 break-words text-xs text-brand-500">Model: {a.model}</p>
            </details>
            {a.actions.length === 0 && <p className="text-sm text-brand-600">No actions were included in this assistant’s saved plan.</p>}
            <ol className="space-y-5">
              {a.actions.map((action, i) => {
                const pages = [...new Set(action.evidenceIds)].flatMap((id) => {
                  const fact = context?.facts.find((item) => item.id === id);
                  if (!fact || fact.source !== "website" || !fact.url) return [];
                  const value = objectValue(factValue(fact));
                  const url = safeUrl(fact.url);
                  return url && value && (typeof value.title === "string" || Array.isArray(value.issues)) ? [{ url, title: textValue(value.title) || url }] : [];
                });
                return <li key={i} className="border-t pt-5 first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-brand-400">
                      Action {i + 1}
                    </span>
                    <Pill
                      tone={action.priority === "high" ? "warn" : "default"}
                    >
                      {label(action.priority)} priority
                    </Pill>
                    <span className="text-xs text-brand-500">
                      {label(action.timeframe).replace(/-/g, " ")}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold leading-7 text-brand-950">{action.title}</h3>
                  <div className="mt-4">
                    <h4 className="mb-2 text-xs font-semibold text-brand-950">Pages in supporting evidence</h4>
                    {pages.length ? <ul className="space-y-2">{pages.map((page) => <li key={page.url}><a href={page.url} target="_blank" rel="noopener noreferrer" className="block break-words text-sm text-primary-700 underline underline-offset-4">{page.title}</a><span className="block break-all text-xs text-brand-500">{page.url}</span></li>)}</ul> : <p className="text-xs text-brand-500">No specific website page was linked to this action. Review the evidence to choose where it applies.</p>}
                  </div>
                  <h4 className="mt-5 text-xs font-semibold text-brand-950">What to do</h4>
                  <ol className="mt-2 list-decimal space-y-3 pl-5 text-sm text-brand-600">
                    {action.steps.map((step, j) => (
                      <li key={j}><FormattedAnswer text={step} /></li>
                    ))}
                  </ol>
                  {action.steps.length === 0 && <p className="mt-2 text-xs text-brand-500">No implementation steps were included in this saved action.</p>}
                  <div className="mt-4 border-l-2 pl-3">
                    <h4 className="mb-1 text-xs font-semibold text-brand-950">How to measure progress</h4>
                    <FormattedAnswer text={action.measureBy || "No progress measure was provided. Define one before starting."} />
                  </div>
                  <EvidenceLinks
                    ids={action.evidenceIds}
                    context={data.journey?.context ?? null}
                    answers={data.answers}
                  />
                </li>;
              })}
            </ol>
            <div className="mt-5 border-t pt-4"><a href="/fix-engine" className="text-sm font-semibold text-primary-700 underline underline-offset-4">Review the improvement plan in Fix Engine →</a></div>
          </Panel>
        ))}
      </div>
    </QueryState>
  );
}
