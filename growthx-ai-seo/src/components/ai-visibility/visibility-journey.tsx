"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Database, RefreshCw, Sparkles } from "lucide-react";
import { useWorkspace } from "@/hooks/use-growthx";
import { visibilityJourneyApi } from "@/lib/api-client";
import { journeyRunning, providerName, type VisibilityBrief, type VisibilityContext } from "@/lib/visibility-workflow";
import { ActionButton, PageHeader, Panel, Pill, StatusNote, Tabs, Table, Th, Tr, Td } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { EvidenceLinks, AnswerResults, GapResults, ActionPlan } from "./visibility-journey-results";

const STEPS = [
  { id: "review", label: "1. Review questions" },
  { id: "results", label: "2. See results" },
  { id: "plan", label: "3. Take action" },
];
const ALIASES: Record<string, string> = {
  overview: "review", questions: "review", prompts: "review", sandbox: "review", settings: "review", unified: "review",
  answers: "results", citations: "results", models: "results", history: "results", competitors: "results", "competitor-intelligence": "results", "competitor-comparison": "results",
  recommendations: "plan", insights: "plan", actions: "plan", gaps: "plan", "root-cause": "plan", "root-cause-analysis": "plan",
};

export function VisibilityJourneyPage() {
  const workspace = useWorkspace();
  return <QueryState isLoading={workspace.isLoading} error={workspace.error} isEmpty={!workspace.projectId} emptyTitle="Choose a business" emptyBody="Select a workspace to check its AI visibility.">
    {workspace.projectId && <Journey key={workspace.projectId} projectId={workspace.projectId} />}
  </QueryState>;
}

function Journey({ projectId }: { projectId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const key = ["visibility-journey", projectId];
  const query = useQuery({ queryKey: key, queryFn: () => visibilityJourneyApi.read(projectId), retry: false,
    refetchInterval: (q) => journeyRunning(q.state.data?.journey?.status) ? 4000 : false });
  const data = query.data;
  const run = data?.journey;
  const requested = params.get("tab");
  const tab = requested ? ALIASES[requested] || (STEPS.some((s) => s.id === requested) ? requested : "review") : run?.scanId ? "results" : "review";
  const setTab = (value: string) => router.replace(`/ai-visibility?tab=${value}`, { scroll: false });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const prepare = useMutation({ mutationFn: () => visibilityJourneyApi.prepare(projectId), retry: false,
    onSuccess: () => { void refresh(); setTab("review"); }, onError: () => { void refresh(); } });
  const check = useMutation({ mutationFn: ({ id, brief }: { id: string; brief?: VisibilityBrief }) => visibilityJourneyApi.check(projectId, id, brief), retry: false,
    onSuccess: () => { void refresh(); setTab("results"); }, onError: () => { void refresh(); } });
  const busy = journeyRunning(run?.status) || prepare.isPending || check.isPending;
  const configured = data?.providers.filter((p) => p.configured && !p.unavailableReason) ?? [];
  const assistantNames = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(configured.map((p) => providerName(p.provider)));
  const error = prepare.error || check.error;
  const hasPlan = Boolean(run?.analysis?.length);

  return <div className="space-y-5 pb-12">
    <PageHeader title="AI Visibility" subtitle="Find out whether AI recommends your business — and what to improve next." actions={<>
      {run && <ActionButton disabled={busy || !configured.length || query.isLoading} icon={<Sparkles size={14} />} onClick={() => prepare.mutate()}>Start a new analysis</ActionButton>}
      <ActionButton aria-label="Refresh AI Visibility status" icon={<RefreshCw size={14} />} onClick={() => void refresh()}>Refresh</ActionButton>
    </>} />
    <QueryState isLoading={query.isLoading} error={query.error}>
      {error && <StatusNote tone="bad">{error.message}</StatusNote>}
      {data && !configured.length && <StatusNote tone="bad">AI checks are temporarily unavailable. Please contact support.</StatusNote>}
      <Tabs tabs={STEPS} active={tab} onChange={setTab} />
      {!run && <Panel padded>
        <div className="mx-auto max-w-xl space-y-4 py-8 text-center">
          <Sparkles className="mx-auto text-primary-600" size={28} />
          <h2 className="text-xl font-semibold text-brand-950">See your business through your buyers’ questions</h2>
          <p className="text-sm leading-6 text-brand-600">We use your website audit to draft relevant questions. You review them, we ask the available AI assistants, and you get real answers with a practical action plan.</p>
          <ActionButton variant="primary" disabled={busy || !configured.length || query.isLoading} onClick={() => prepare.mutate()}>{prepare.isPending ? "Preparing your questions…" : "Prepare my questions"}</ActionButton>
          <p className="text-xs text-brand-500">Your Website Audit is the starting point. Connected Google data and audited competitors add context.</p>
        </div>
      </Panel>}
      {run && <>
        {busy && <Panel padded><div role="status" aria-live="polite" className="space-y-3">
          <div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-brand-950">{run.status === "PREPARING" || (run.phase === "PREPARE" && run.status === "QUEUED") ? "Understanding your business and preparing questions" : run.status === "CHECKING" ? `Asking ${assistantNames} your buyer questions` : "Analysing saved answers and preparing your action plan"}</span><span>{run.progress}%</span></div>
          <progress aria-label="AI Visibility progress" max={100} value={run.progress} className="h-2 w-full accent-primary-600" />
          <p className="text-xs text-brand-500">Progress is saved. You can leave and return without starting again.</p>
        </div></Panel>}
        {run.status === "FAILED" && <StatusNote tone="bad">This analysis needs attention. Open Analysis details below to see what happened and retry.</StatusNote>}
        {tab === "review" && <>
          <Panel title={run.scanId ? "Questions used in this analysis" : "Review before you run"} subtitle={run.scanId ? "These questions are saved with the answers. Start a new analysis to change them." : "Check your products, service areas and buyer questions. Then confirm to start the AI checks."} padded>
            {run.brief ? <><p className="font-semibold text-brand-950">{run.brief.businessName}</p><p className="mt-2 text-sm leading-6 text-brand-600">{run.brief.summary}</p>{run.scanId && <ActionButton className="mt-4" onClick={() => setTab("results")} icon={<ArrowRight size={14} />}>View saved results</ActionButton>}</> : <p className="text-sm text-brand-500">{busy ? "Your business details and questions will appear here when ready." : "Your business details are not ready. Start a new analysis to retry."}</p>}
          </Panel>
          {run.brief && <QuestionReview key={`${run.id}-${run.updatedAt}`} brief={run.brief} locked={busy || !!run.scanId} checks={configured.length * run.brief.questions.length} pending={check.isPending} onRun={(brief) => check.mutate({ id: run.id, brief })} />}
        </>}
        {tab === "results" && data && <>
          <Panel padded title="Do AI assistants recommend your business?" subtitle="Read the actual answers, compare assistants, and see where your business appears." actions={<ActionButton variant="primary" disabled={!hasPlan} onClick={() => setTab("plan")} icon={<ArrowRight size={14} />}>View action plan</ActionButton>}>
            <p className="text-xs text-brand-500">{run.brief?.questions.length ?? 0} buyer questions · {assistantNames || "No available assistants"} · {busy ? "Analysis in progress" : "Saved analysis"}</p>
          </Panel>
          <AnswerResults data={data} />
          <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold text-brand-950">Compare competitors mentioned in the answers</summary><div className="mt-4"><GapResults data={data} /></div></details>
          {!run.scanId && <ActionButton onClick={() => setTab("review")}>Review questions to begin</ActionButton>}
        </>}
        {tab === "plan" && data && <>
          <Panel padded title="Your next steps" subtitle="Prioritized actions based on your website evidence and the AI answers we saved."><p className="text-xs text-brand-500">Review the supporting evidence for each action. Changes can be prepared in Fix Engine.</p></Panel>
          <ActionPlan data={data} />
          <ActionButton onClick={() => setTab(hasPlan ? "results" : "review")}>{hasPlan ? "Back to results" : "Review questions to begin"}</ActionButton>
        </>}
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">Analysis details{run.errors.length ? ` · ${run.errors.length} coverage note${run.errors.length === 1 ? "" : "s"}` : " · sources and assistants"}</summary>
          <div className="mt-4 space-y-4">
            <p className="text-xs text-brand-500">Saved {new Date(run.createdAt).toLocaleString()}. API answers do not measure consumer apps or Google AI Overviews.</p>
            <div className="flex flex-wrap gap-2">{data?.providers.map((p) => <Pill key={p.provider} tone={p.configured && !p.unavailableReason ? "good" : "warn"}>{providerName(p.provider)} · {p.unavailableReason || (p.configured ? p.model : "Not connected")}</Pill>)}</div>
            {run.errors.length > 0 && <ul className="list-disc space-y-1 pl-4 text-xs text-brand-600">{run.errors.map((e,i) => <li key={i}>{e}</li>)}</ul>}
            {["PARTIAL", "FAILED"].includes(run.status) && run.brief && <ActionButton disabled={busy} onClick={() => check.mutate({id:run.id})}>Retry unfinished checks</ActionButton>}
            {run.context && <><SourceCards context={run.context} /><LocalDemand context={run.context} locations={run.brief?.locations ?? []} /><ul className="list-disc space-y-1 pl-4 text-xs text-brand-500">{run.context.limitations.map((s,i)=><li key={i}>{s}</li>)}</ul><EvidenceLinks ids={run.context.facts.map((f)=>f.id)} context={run.context} answers={data?.answers ?? []} /></>}
          </div>
        </details>
      </>}
    </QueryState>
  </div>;
}

function SourceCards({ context }: { context: VisibilityContext }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {context.sources.map((s) => (
        <Panel key={s.id} padded>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-brand-950">
              {s.label}
            </span>
            {s.available ? (
              <Check size={15} className="text-success-600" />
            ) : (
              <Database size={15} className="text-warning-600" />
            )}
          </div>
          <p className="mt-2 text-xs leading-5 text-brand-600">{s.detail}</p>
          <p className="mt-2 text-[11px] text-brand-400">
            {s.updatedAt
              ? `Source updated ${new Date(s.updatedAt).toLocaleDateString()}`
              : "No saved source date"}
          </p>
          <Link
            className="mt-3 inline-block text-xs font-semibold text-primary-700"
            href={s.href}
          >
            {s.available ? "Open source" : "Complete this source"} →
          </Link>
        </Panel>
      ))}
    </div>
  );
}

function LocalDemand({
  context,
  locations,
}: {
  context: VisibilityContext;
  locations: string[];
}) {
  return (
    <Panel
      title="Are visits coming from your service areas?"
      subtitle="GA4 visitor cities · last 28 days · reported top-city sample"
    >
      {context.cities.length ? (
        <Table minWidth={500}>
          <thead>
            <tr>
              <Th>Reported city</Th>
              <Th>Sessions</Th>
              <Th>Service-area match</Th>
            </tr>
          </thead>
          <tbody>
            {context.cities.map((c, i) => (
              <Tr key={`${c.city}-${i}`}>
                <Td>
                  {c.city}, {c.country}
                </Td>
                <Td>{c.sessions.toLocaleString()}</Td>
                <Td>
                  <Pill
                    tone={
                      locations.some(
                        (l) => l.toLowerCase() === c.city.toLowerCase(),
                      )
                        ? "good"
                        : "default"
                    }
                  >
                    {locations.some(
                      (l) => l.toLowerCase() === c.city.toLowerCase(),
                    )
                      ? "Named service area"
                      : "Review location"}
                  </Pill>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="p-4 text-sm text-brand-500">
          City traffic is not available. Sync GA4 to compare visits with your
          service areas.
        </p>
      )}
      <p className="border-t p-4 text-xs leading-5 text-brand-500">
        Nearby neighbourhoods can be reported under a larger city. Unmatched
        cities need review; this sample does not establish the share of all
        traffic outside your area.{" "}
        {context.keyEvents === null
          ? "Lead measurement is unknown because key-event data is unavailable."
          : `${context.keyEvents.toLocaleString()} key events recorded; check that they represent qualified leads.`}
      </p>
    </Panel>
  );
}

function QuestionReview({
  brief,
  locked,
  checks,
  pending,
  onRun,
}: {
  brief: VisibilityBrief;
  locked: boolean;
  checks: number;
  pending: boolean;
  onRun: (brief: VisibilityBrief) => void;
}) {
  const [draft, setDraft] = useState(brief);
  const [showAll, setShowAll] = useState(false);
  const input =
    "w-full rounded-lg border bg-white px-3 py-2 text-sm text-brand-950 disabled:bg-brand-50";
  const changeQuestion = (
    index: number,
    field: "text" | "offering" | "location",
    value: string,
  ) =>
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q, i) =>
        i === index ? { ...q, [field]: value } : q,
      ),
    }));
  return (
    <div className="space-y-4">
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-semibold text-brand-700">Business details · edit products and service areas</summary>
      <div className="mt-4"><Panel
        title="Confirm your business and service areas"
        subtitle="These details guide the plan. Buyer questions are asked independently, without supplying your brand."
        padded
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-xs text-brand-600">
            Business name
            <input
              aria-label="Business name"
              className={input}
              disabled={locked}
              value={draft.businessName}
              onChange={(e) =>
                setDraft((d) => ({ ...d, businessName: e.target.value }))
              }
            />
          </label>
          <label className="space-y-2 text-xs text-brand-600">
            Offerings, separated by commas
            <input
              aria-label="Offerings"
              className={input}
              disabled={locked}
              value={draft.offerings.join(", ")}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  offerings: e.target.value.split(",").map((s) => s.trim()),
                }))
              }
            />
          </label>
          <label className="space-y-2 text-xs text-brand-600">
            Service areas, separated by commas
            <input
              aria-label="Service areas"
              className={input}
              disabled={locked}
              value={draft.locations.join(", ")}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  locations: e.target.value.split(",").map((s) => s.trim()),
                }))
              }
            />
          </label>
        </div>
      </Panel></div>
      </details>
      <Panel
        title={`${draft.questions.length} questions a real buyer would ask`}
        subtitle="Review the questions below. You can edit the wording before starting."
        actions={!locked && <ActionButton variant="primary" disabled={pending || !checks} onClick={() => onRun(draft)}>Confirm & check {draft.questions.length} questions</ActionButton>}
      >
        <ol className="divide-y">
          {(showAll ? draft.questions : draft.questions.slice(0, 5)).map((q, index) => (
            <li key={index} className="space-y-3 p-4">
              <div className="flex gap-3">
                <span className="mt-2 font-mono text-xs text-brand-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <textarea
                    aria-label={`Buyer question ${index + 1}`}
                    className={input}
                    rows={2}
                    disabled={locked}
                    value={q.text}
                    onChange={(e) =>
                      changeQuestion(index, "text", e.target.value)
                    }
                  />
                </div>
              </div>
              <details className="ml-7 text-xs text-brand-500"><summary className="cursor-pointer">{q.offering}{q.location ? ` · ${q.location}` : ""} · Edit details</summary>
              <p className="mt-2 leading-5">{q.rationale}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Offering for question ${index + 1}`}
                  className="rounded border p-1.5 text-xs"
                  disabled={locked}
                  value={q.offering}
                  onChange={(e) =>
                    changeQuestion(index, "offering", e.target.value)
                  }
                >
                  {draft.offerings.map((o, i) => (
                    <option key={`${o}-${i}`} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Location for question ${index + 1}`}
                  className="rounded border p-1.5 text-xs"
                  disabled={locked}
                  value={q.location}
                  onChange={(e) =>
                    changeQuestion(index, "location", e.target.value)
                  }
                >
                  <option value="">No local area</option>
                  {draft.locations.map((l, i) => (
                    <option key={`${l}-${i}`} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <Pill>{q.intent}</Pill>
              </div>
              </details>
            </li>
          ))}
        </ol>
        {draft.questions.length > 5 && <div className="border-t p-4"><ActionButton onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer questions" : `Show all ${draft.questions.length} questions`}</ActionButton></div>}
        {!locked && (
          <div className="space-y-3 border-t p-4">
            <p className="text-xs text-brand-500">
              We will collect {checks} AI answers and create your action plan.
              Questions are asked without supplying your business name.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
