"use client";

import { useState, type ReactNode } from "react";
import { ActionButton, Kpi, Panel, Pill } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import {
  providerName,
  type VisibilityAnswer,
  type VisibilityContext,
  type VisibilityJourneyResponse,
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
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase());

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
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer font-semibold text-primary-700">
        Supporting evidence ({ids.length})
      </summary>
      <div className="mt-2 space-y-3">
        {ids.map((id) => {
          if (id === "owner")
            return (
              <p key={id} className="text-brand-600">
                Business details and questions reviewed by the workspace
                operator.
              </p>
            );
          const fact = context?.facts.find((f) => f.id === id);
          const answer = answers.find((a) => a.id === id);
          if (!fact && !answer) return null;
          let value: unknown = fact?.text;
          try {
            if (fact) value = JSON.parse(fact.text);
          } catch {
            /* Plain-text facts remain readable. */
          }
          const url = fact?.url ? safeUrl(fact.url) : null;
          return (
            <div key={id} className="border-l-2 pl-3 text-brand-600">
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
                <FactValue value={value} />
              ) : (
                <p className="whitespace-pre-wrap">{answer?.rawResponse}</p>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

export function AnswerResults({ data }: { data: VisibilityJourneyResponse }) {
  const [filter, setFilter] = useState("ALL");
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
        subtitle="Fresh API answers to your reviewed buyer questions. Consumer apps and Google AI Overviews are not measured here."
        padded
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {["ALL", ...assistants].map((p) => (
            <ActionButton
              key={p}
              aria-pressed={filter === p}
              variant={filter === p ? "primary" : "secondary"}
              onClick={() => setFilter(p)}
            >
              {p === "ALL" ? "All answers" : providerName(p)}
            </ActionButton>
          ))}
        </div>
        <QueryState
          isEmpty={!visible.length}
          emptyTitle="No answers saved yet"
          emptyBody="Review the buyer questions and start the checks. Answers appear here as they are saved."
        >
          <div className="divide-y">
            {visible.map((a) => (
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
                <h3 className="text-sm font-semibold text-brand-950">
                  {a.promptText}
                </h3>
                {a.errorMessage && (
                  <p className="text-sm text-error-700">{a.errorMessage}</p>
                )}
                {!!a.mentions.filter((m) => !m.isCustomer).length && (
                  <p className="text-xs text-brand-600">
                    Other brands named:{" "}
                    {a.mentions
                      .filter((m) => !m.isCustomer)
                      .map((m) => m.brandName)
                      .join(", ")}
                  </p>
                )}
                {a.analysis?.parsedJson?.recommendationQuote && (
                  <blockquote className="border-l-2 pl-3 text-sm text-brand-700">
                    {a.analysis.parsedJson.recommendationQuote}
                  </blockquote>
                )}
                {a.rawResponse && (
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold text-primary-700">
                      Read complete answer
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-brand-600">
                      {a.rawResponse}
                    </p>
                  </details>
                )}
                {!!a.citations.length && (
                  <div className="space-y-1">
                    <p className="text-xs text-brand-500">
                      Links included in the answer (not independently verified)
                    </p>
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
                  </div>
                )}
              </article>
            ))}
          </div>
        </QueryState>
      </Panel>
    </div>
  );
}

export function GapResults({ data }: { data: VisibilityJourneyResponse }) {
  const assessments = data.journey?.analysis ?? [];
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
  return (
    <QueryState
      isEmpty={!assessments.length}
      emptyTitle="Your action plan follows the AI checks"
      emptyBody="The plan combines your service areas, Google performance, website gaps and actual AI answers. Missing data will be stated."
    >
      <div className="space-y-5">
        {assessments.map((a) => (
          <Panel
            key={a.provider}
            title={`${providerName(a.provider)} · Your lead and GEO plan`}
            subtitle={`Based on this run’s saved evidence · ${a.model}`}
            padded
          >
            <p className="text-sm leading-6 text-brand-700">{a.summary}</p>
            <div className="my-4 border-l-2 pl-4">
              <h3 className="text-xs font-semibold text-brand-950">
                Local demand and conversion opportunity
              </h3>
              <p className="mt-1 text-sm leading-6 text-brand-600">
                {a.localDemand ||
                  "No local-demand conclusion was available from this evidence."}
              </p>
            </div>
            <ol className="space-y-5">
              {a.actions.map((action, i) => (
                <li key={i} className="border-t pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-brand-400">
                      {i + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-brand-950">
                      {action.title}
                    </h3>
                    <Pill
                      tone={action.priority === "high" ? "warn" : "default"}
                    >
                      {action.priority} priority
                    </Pill>
                    <span className="text-xs text-brand-500">
                      {action.timeframe}
                    </span>
                  </div>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-brand-600">
                    {action.steps.map((step, j) => (
                      <li key={j}>{step}</li>
                    ))}
                  </ol>
                  <p className="mt-3 text-xs leading-5 text-brand-600">
                    <strong>How to measure progress: </strong>
                    {action.measureBy}
                  </p>
                  <EvidenceLinks
                    ids={action.evidenceIds}
                    context={data.journey?.context ?? null}
                    answers={data.answers}
                  />
                </li>
              ))}
            </ol>
          </Panel>
        ))}
      </div>
    </QueryState>
  );
}
