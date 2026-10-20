"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Database,
  MapPin,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-growthx";
import { visibilityJourneyApi } from "@/lib/api-client";
import {
  journeyRunning,
  providerName,
  type VisibilityBrief,
  type VisibilityContext,
} from "@/lib/visibility-workflow";
import {
  ActionButton,
  PageHeader,
  Panel,
  Pill,
  StatusNote,
  Tabs,
  Table,
  Th,
  Tr,
  Td,
} from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import {
  EvidenceLinks,
  AnswerResults,
  GapResults,
  ActionPlan,
} from "./visibility-journey-results";

const TABS = [
  { id: "overview", label: "1. Business & evidence" },
  { id: "questions", label: "2. Buyer questions" },
  { id: "answers", label: "3. AI answers" },
  { id: "competitors", label: "4. Competitor gaps" },
  { id: "recommendations", label: "5. Lead action plan" },
];
const ALIASES: Record<string, string> = {
  insights: "recommendations",
  gaps: "competitors",
  citations: "answers",
  sandbox: "questions",
};

export function VisibilityJourneyPage() {
  const workspace = useWorkspace();
  return (
    <QueryState
      isLoading={workspace.isLoading}
      error={workspace.error}
      isEmpty={!workspace.projectId}
      emptyTitle="Choose a business"
      emptyBody="Select a workspace to build its AI Visibility plan."
    >
      {workspace.projectId && (
        <Journey key={workspace.projectId} projectId={workspace.projectId} />
      )}
    </QueryState>
  );
}

function Journey({ projectId }: { projectId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("tab") || "overview";
  const tab =
    ALIASES[requested] ||
    (TABS.some((t) => t.id === requested) ? requested : "overview");
  const setTab = (value: string) =>
    router.replace(`/ai-visibility/journey?tab=${value}`, { scroll: false });
  const qc = useQueryClient();
  const key = ["visibility-journey", projectId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => visibilityJourneyApi.read(projectId),
    retry: false,
    refetchInterval: (q) =>
      journeyRunning(q.state.data?.journey?.status) ? 4000 : false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const prepare = useMutation({
    mutationFn: () => visibilityJourneyApi.prepare(projectId),
    retry: false,
    onSuccess: () => {
      void refresh();
      setTab("overview");
    },
    onError: () => {
      void refresh();
    },
  });
  const check = useMutation({
    mutationFn: ({ id, brief }: { id: string; brief?: VisibilityBrief }) =>
      visibilityJourneyApi.check(projectId, id, brief),
    retry: false,
    onSuccess: () => {
      void refresh();
      setTab("answers");
    },
    onError: () => {
      void refresh();
    },
  });
  const data = query.data;
  const run = data?.journey;
  const busy =
    journeyRunning(run?.status) || prepare.isPending || check.isPending;
  const configured = data?.providers.filter((p) => p.configured && !p.unavailableReason) ?? [];
  const error = prepare.error || check.error;

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="AI Visibility"
        subtitle="Turn what we know about your business into questions buyers ask — and a plan to earn their next enquiry."
        actions={
          <>
            <ActionButton
              disabled={busy || !configured.length || query.isLoading}
              variant="primary"
              icon={<Sparkles size={14} />}
              onClick={() => prepare.mutate()}
            >
              {run ? "Refresh business & questions" : "Understand my business"}
            </ActionButton>
            <ActionButton
              aria-label="Refresh AI Visibility status"
              icon={<RefreshCw size={14} />}
              onClick={() => void refresh()}
            >
              Refresh
            </ActionButton>
          </>
        }
      />
      <QueryState isLoading={query.isLoading} error={query.error}>
        {error && <StatusNote tone="bad">{error.message}</StatusNote>}
        {data && !configured.length && (
          <StatusNote tone="bad">
            No monitoring model is configured. Add provider access in the
            server settings to begin.
          </StatusNote>
        )}
        {data && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-brand-500">
            {data.providers.map((p) => (
              <Pill key={p.provider} tone={p.configured && !p.unavailableReason ? "good" : "warn"}>
                {providerName(p.provider)} ·{" "}
                {p.unavailableReason || (p.configured ? p.model || "Configured" : "Not configured")}
              </Pill>
            ))}
            <span>
              Website + Google data + competitors → reviewed buyer questions → AI
              answers → your plan
            </span>
          </div>
        )}
        {!run && (
          <Panel padded>
            <div className="mx-auto max-w-2xl py-10 text-center">
              <Sparkles className="mx-auto mb-4 text-primary-600" size={32} />
              <h2 className="text-xl font-semibold text-brand-950">
                Start with the business behind the website
              </h2>
              <p className="mt-3 text-sm leading-6 text-brand-600">
                Gemini and Sarvam read your audit, search demand, visitor
                locations and competitor evidence. Then review ten questions
                tailored to your products and service areas before checking who
                AI recommends.
              </p>
              <p className="mt-3 text-xs text-brand-500">
                Uses your saved data and AI credits. Missing sources will be
                identified so you can connect them.
              </p>
            </div>
          </Panel>
        )}
        {run && (
          <>
            {busy && (
              <Panel padded>
                <div role="status" aria-live="polite" className="space-y-3">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-semibold text-brand-950">
                      {run.status === "QUEUED"
                        ? "Waiting for the background worker"
                        : run.status === "PREPARING"
                          ? "Understanding your business and drafting questions"
                          : run.status === "CHECKING"
                            ? "Asking Gemini and Sarvam your buyer questions"
                            : "Comparing answers and building your action plan"}
                    </span>
                    <span>{run.progress}%</span>
                  </div>
                  <progress
                    aria-label="AI Visibility progress"
                    max={100}
                    value={run.progress}
                    className="h-2 w-full accent-primary-600"
                  />
                  <p className="text-xs text-brand-500">
                    Your progress is saved. You can leave this page and return.
                  </p>
                </div>
              </Panel>
            )}
            {run.errors.length > 0 && (
              <Panel
                title={
                  run.status === "FAILED"
                    ? "This run needs attention"
                    : "Coverage notes"
                }
                padded
              >
                <ul className="list-disc space-y-1 pl-4 text-xs text-brand-600">
                  {run.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
                {["PARTIAL", "FAILED"].includes(run.status) && run.brief && (
                  <ActionButton
                    className="mt-3"
                    disabled={busy}
                    onClick={() => check.mutate({ id: run.id })}
                  >
                    Retry unfinished checks
                  </ActionButton>
                )}
              </Panel>
            )}
            {run.context && <SourceCards context={run.context} />}
            <Tabs tabs={TABS} active={tab} onChange={setTab} />
            {tab === "overview" && (
              <>
                {run.brief ? (
                  <Panel
                    title="What we understand about your business"
                    padded
                    actions={
                      <ActionButton
                        onClick={() => setTab("questions")}
                        icon={<ArrowRight size={13} />}
                      >
                        Review {run.brief.questions.length} questions
                      </ActionButton>
                    }
                  >
                    <h3 className="text-xl font-semibold text-brand-950">
                      {run.brief.businessName}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-600">
                      {run.brief.summary}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {run.brief.offerings.map((o) => (
                        <Pill key={o}>{o}</Pill>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-brand-600">
                      <MapPin size={15} />
                      {run.brief.locations.join(" · ") ||
                        "No local service areas identified; review before checking."}
                    </div>
                    <p className="mt-3 text-xs text-brand-500">
                      {run.brief.reviewed
                        ? "Business and question set reviewed for this run."
                        : "AI interpretation from saved evidence. Confirm offerings and service areas in Buyer questions."}
                    </p>
                    {run.brief.analysts.map((a) => (
                      <details key={a.provider} className="mt-4 border-t pt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-brand-700">
                          {providerName(a.provider)} business assessment ·{" "}
                          {a.model}
                        </summary>
                        <p className="mt-2 whitespace-pre-line text-sm text-brand-600">
                          {a.summary}
                        </p>
                      </details>
                    ))}
                  </Panel>
                ) : (
                  !busy && (
                    <QueryState
                      isEmpty
                      emptyTitle="Business context is not ready"
                      emptyBody="Complete the Website Audit, then refresh business and questions."
                    />
                  )
                )}
                {run.context && (
                  <>
                    <LocalDemand
                      context={run.context}
                      locations={run.brief?.locations ?? []}
                    />
                    <Panel title="Evidence and limits" padded>
                      <p className="mb-3 text-xs text-brand-500">
                        Snapshot created{" "}
                        {new Date(run.context.gatheredAt).toLocaleString()}.
                        Refresh business and questions after updating source
                        data.
                      </p>
                      <ul className="list-disc space-y-1 pl-4 text-xs text-brand-600">
                        {run.context.limitations.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                      <EvidenceLinks
                        ids={run.context.facts.map((f) => f.id)}
                        context={run.context}
                        answers={data?.answers ?? []}
                      />
                    </Panel>
                  </>
                )}
              </>
            )}
            {tab === "questions" &&
              (run.brief ? (
                <QuestionReview
                  key={`${run.id}-${run.updatedAt}`}
                  brief={run.brief}
                  locked={busy || !!run.scanId}
                  checks={configured.length * run.brief.questions.length}
                  pending={check.isPending}
                  onRun={(brief) => check.mutate({ id: run.id, brief })}
                />
              ) : (
                <QueryState
                  isEmpty
                  emptyTitle="Questions are not ready yet"
                  emptyBody="Start by understanding your business from the saved sources."
                />
              ))}
            {tab === "answers" && data && <AnswerResults data={data} />}
            {tab === "competitors" && data && <GapResults data={data} />}
            {tab === "recommendations" && data && <ActionPlan data={data} />}
          </>
        )}
      </QueryState>
    </div>
  );
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
      <Panel
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
      </Panel>
      <Panel
        title={`${draft.questions.length} questions a real buyer would ask`}
        subtitle="Use specific products and locations. Keep your brand name out of the question."
      >
        <ol className="divide-y">
          {draft.questions.map((q, index) => (
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
                  <p className="mt-1 text-xs leading-5 text-brand-500">
                    {q.rationale}
                  </p>
                </div>
              </div>
              <div className="ml-7 flex flex-wrap items-center gap-2">
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
            </li>
          ))}
        </ol>
        {!locked && (
          <div className="space-y-3 border-t p-4">
            <p className="text-xs text-brand-500">
              Runs {checks} provider answers, then analyses the results to
              create a plan. Uses AI credits. Verify the service areas and
              questions before starting.
            </p>
            <ActionButton
              variant="primary"
              disabled={pending || !checks}
              icon={<ArrowRight size={14} />}
              onClick={() => onRun(draft)}
            >
              Confirm & check {draft.questions.length} questions
            </ActionButton>
          </div>
        )}
      </Panel>
    </div>
  );
}
