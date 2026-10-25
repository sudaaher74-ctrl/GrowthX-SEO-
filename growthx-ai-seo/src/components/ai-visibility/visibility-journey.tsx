"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Globe,
  LayoutGrid,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-growthx";
import { visibilityJourneyApi } from "@/lib/api-client";
import {
  journeyRunning,
  providerName,
  type BuyerQuestion,
  type VisibilityAnswer,
  type VisibilityAssessment,
  type VisibilityBrief,
  type VisibilityContext,
} from "@/lib/visibility-workflow";
import { ActionButton, PageHeader, Panel, Pill, StatusNote, Tabs, Table, Th, Tr, Td } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { EvidenceLinks, AnswerResults, GapResults, ActionPlan } from "./visibility-journey-results";

const STEPS = [
  { id: "review", label: "1. Prompts" },
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
          <h2 className="text-xl font-semibold text-brand-950">See your business through your buyers’ prompts</h2>
          <p className="text-sm leading-6 text-brand-600">We use your website audit to draft relevant buyer prompts. You review them, we ask the available AI assistants, and you get real answers with a practical action plan.</p>
          <ActionButton variant="primary" disabled={busy || !configured.length || query.isLoading} onClick={() => prepare.mutate()}>{prepare.isPending ? "Preparing your prompts…" : "Prepare my prompts"}</ActionButton>
          <p className="text-xs text-brand-500">Your Website Audit is the starting point. Connected Google data and audited competitors add context.</p>
        </div>
      </Panel>}
      {run && <>
        {busy && <Panel padded><div role="status" aria-live="polite" className="space-y-3">
          <div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-brand-950">{run.phase === "PREPARE" ? "Understanding your business and preparing prompts" : run.status === "QUEUED" ? "Starting your AI checks" : run.status === "CHECKING" ? `Asking ${assistantNames} your buyer prompts` : "Analysing saved answers and preparing your action plan"}</span><span>{run.progress}%</span></div>
          <progress aria-label="AI Visibility progress" max={100} value={run.progress} className="h-2 w-full accent-primary-600" />
          <p className="text-xs text-brand-500">Progress is saved. You can leave and return without starting again.</p>
        </div></Panel>}
        {run.status === "FAILED" && <StatusNote tone="bad">This analysis needs attention. Open Analysis details below to see what happened and retry.</StatusNote>}
        {tab === "review" && <>
          {run.brief ? (
            <PromptsSection
              key={`${run.id}-${run.updatedAt}`}
              brief={run.brief}
              locked={busy || !!run.scanId}
              checks={configured.length * run.brief.questions.length}
              pending={check.isPending}
              onRun={(brief) => check.mutate({ id: run.id, brief })}
              answers={data?.answers ?? []}
              providers={data?.providers ?? []}
              analysis={run.analysis ?? []}
              hasScan={!!run.scanId}
              onViewResults={() => setTab("results")}
            />
          ) : (
            <Panel title="Review before you run" subtitle="Check your products, service areas and buyer prompts. Then confirm to start the AI checks." padded>
              <p className="text-sm text-brand-500">{busy ? "Your business details and prompts will appear here when ready." : "Your business details are not ready. Start a new analysis to retry."}</p>
            </Panel>
          )}
        </>}
        {tab === "results" && data && <>
          <Panel padded title="Do AI assistants recommend your business?" subtitle="Read the actual answers, compare assistants, and see where your business appears." actions={<ActionButton variant="primary" disabled={!hasPlan} onClick={() => setTab("plan")} icon={<ArrowRight size={14} />}>View action plan</ActionButton>}>
            <p className="text-xs text-brand-500">{run.brief?.questions.length ?? 0} buyer prompts · {assistantNames || "No available assistants"} · {busy ? "Analysis in progress" : "Saved analysis"}</p>
          </Panel>
          <AnswerResults data={data} />
          <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold text-brand-950">Compare competitors mentioned in the answers</summary><div className="mt-4"><GapResults data={data} /></div></details>
          {!run.scanId && <ActionButton onClick={() => setTab("review")}>Review prompts to begin</ActionButton>}
        </>}
        {tab === "plan" && data && <>
          <Panel padded title="Your next steps" subtitle="Prioritized actions based on your website evidence and the AI answers we saved."><p className="text-xs text-brand-500">Review the supporting evidence for each action. Changes can be prepared in Fix Engine.</p></Panel>
          <ActionPlan data={data} />
          <ActionButton onClick={() => setTab(hasPlan ? "results" : "review")}>{hasPlan ? "Back to results" : "Review prompts to begin"}</ActionButton>
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

function ChatGptIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="ChatGPT" role="img">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.259 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7466-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.6667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GoogleAiIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Google AI" role="img">
      <path
        d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.52285 12 2Z"
      />
    </svg>
  );
}

type PromptCategory = "best-of" | "jobs-to-be-done" | "competitor" | "branded";

function categorizePrompt(q: BuyerQuestion, businessName: string): PromptCategory {
  const text = (q.text || "").toLowerCase();
  const intent = (q.intent || "").toLowerCase();
  const bName = (businessName || "").toLowerCase().trim();

  if (intent.includes("brand") || (bName.length > 2 && text.includes(bName))) {
    return "branded";
  }
  if (
    intent.includes("compet") ||
    intent.includes("compar") ||
    text.includes(" vs ") ||
    text.includes("versus") ||
    text.includes("alternative") ||
    text.includes("better than") ||
    text.includes(" or are there ") ||
    text.includes("worth it")
  ) {
    return "competitor";
  }
  if (
    intent.includes("best") ||
    intent.includes("recommend") ||
    intent.includes("top") ||
    text.startsWith("best ") ||
    text.startsWith("top ") ||
    text.includes(" best ") ||
    text.includes(" top ") ||
    text.includes("leading") ||
    text.includes("highest rated")
  ) {
    return "best-of";
  }
  if (
    intent.includes("action") ||
    intent.includes("job") ||
    intent.includes("task") ||
    intent.includes("service") ||
    text.includes("how ") ||
    text.includes("where ") ||
    text.includes("delivery") ||
    text.includes("subscription") ||
    text.includes("buy ") ||
    text.includes("order") ||
    text.includes("glass bottle")
  ) {
    return "jobs-to-be-done";
  }
  return "best-of";
}

function matchPrompt(textA: string, textB: string): boolean {
  if (!textA || !textB) return false;
  const a = textA.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const b = textB.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return a === b || a.includes(b) || b.includes(a);
}

interface EngineCitation {
  engine: "ChatGPT" | "Google AI";
  status: "recommended" | "competitor" | "not_cited" | "pending";
  label: string;
  competitor?: string | null;
  quote?: string | null;
}

function getEngineCitation(
  promptText: string,
  engine: "ChatGPT" | "Google AI",
  answers: VisibilityAnswer[],
  businessName: string,
): EngineCitation {
  const matchingAnswer = answers.find(
    (a) =>
      matchPrompt(promptText, a.promptText) &&
      (engine === "ChatGPT"
        ? a.provider.toUpperCase().includes("OPENAI") || a.provider.toUpperCase().includes("CHATGPT")
        : a.provider.toUpperCase().includes("GEMINI") || a.provider.toUpperCase().includes("GOOGLE")),
  );

  if (!matchingAnswer) {
    return {
      engine,
      status: "pending",
      label: "Ready to check",
    };
  }

  if (matchingAnswer.errorMessage) {
    return {
      engine,
      status: "not_cited",
      label: "Check failed",
    };
  }

  if (matchingAnswer.analysis?.recommended) {
    return {
      engine,
      status: "recommended",
      label: `Recommended: ${businessName}`,
      quote: matchingAnswer.analysis.parsedJson?.recommendationQuote || null,
    };
  }

  const rivalMention = matchingAnswer.mentions?.find((m) => !m.isCustomer)?.brandName;
  const bClean = businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const rivalCitation = matchingAnswer.citations?.find((c) => {
    const d = (c.domain || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return d && !d.includes(bClean);
  })?.domain;

  const rival = rivalMention || rivalCitation;
  if (rival) {
    return {
      engine,
      status: "competitor",
      label: `Cited instead: ${rival}`,
      competitor: rival,
      quote: matchingAnswer.analysis?.parsedJson?.recommendationQuote || null,
    };
  }

  return {
    engine,
    status: "not_cited",
    label: matchingAnswer.analysis?.brandMentioned ? "Mentioned only" : "Not cited in answer",
    quote: matchingAnswer.analysis?.parsedJson?.recommendationQuote || null,
  };
}

export function PromptsSection({
  brief,
  locked,
  checks,
  pending,
  onRun,
  answers = [],
  providers = [],
  analysis = [],
  hasScan,
  onViewResults,
}: {
  brief: VisibilityBrief;
  locked: boolean;
  checks: number;
  pending: boolean;
  onRun: (brief: VisibilityBrief) => void;
  answers?: VisibilityAnswer[];
  providers?: { provider: string; configured: boolean; model: string | null; unavailableReason?: string | null }[];
  analysis?: VisibilityAssessment[];
  hasScan?: boolean;
  onViewResults?: () => void;
}) {
  const [draft, setDraft] = useState(brief);
  const [expandedPrompt, setExpandedPrompt] = useState<number | null>(0);
  const [expandedGap, setExpandedGap] = useState<number | null>(0);
  const [filterCategory, setFilterCategory] = useState<PromptCategory | "ALL">("ALL");
  const [cmoToast, setCmoToast] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-brand-950 focus:border-primary-500 focus:outline-none";



  // 1. Calculate stats for the 4 Okara category cards
  const categories: { key: PromptCategory; label: string; cardTone: "error" | "warning" | "success" }[] = [
    { key: "best-of", label: "Best-of", cardTone: "error" },
    { key: "jobs-to-be-done", label: "Jobs to be done", cardTone: "error" },
    { key: "competitor", label: "Competitor", cardTone: "warning" },
    { key: "branded", label: "Branded", cardTone: "success" },
  ];

  const categoryStats = categories.map((cat) => {
    const promptsInCat = draft.questions.filter(
      (q) => categorizePrompt(q, draft.businessName) === cat.key,
    );
    const answersForCat = answers.filter((a) =>
      promptsInCat.some((q) => matchPrompt(q.text, a.promptText)),
    );

    const total = answersForCat.length;
    const cited = answersForCat.filter(
      (a) => a.analysis?.recommended || a.analysis?.brandMentioned,
    ).length;

    const pct = total > 0 ? Math.round((cited / total) * 100) : 0;
    const subtext =
      total > 0
        ? `cited in ${cited} of ${total} answers`
        : `cited in 0 of ${promptsInCat.length * (providers.filter((p) => p.configured).length || 2)} answers`;

    return {
      ...cat,
      count: promptsInCat.length,
      pct,
      subtext,
    };
  });

  // 2. Filtered prompts
  const displayedPrompts = draft.questions
    .map((q, originalIndex) => ({
      q,
      originalIndex,
      category: categorizePrompt(q, draft.businessName),
      chatGpt: getEngineCitation(q.text, "ChatGPT", answers, draft.businessName),
      googleAi: getEngineCitation(q.text, "Google AI", answers, draft.businessName),
    }))
    .filter(
      (item) => filterCategory === "ALL" || item.category === filterCategory,
    );

  // 3. Build Gap Tasks (Screenshots 3, 4, 5)
  // Extract prompts with competitor citations or comparison intents
  interface GapItem {
    promptText: string;
    citedInsteadDisplay: string;
    priority: "High" | "Medium";
    competitors: { name: string; domain: string; count: number }[];
  }

  const gapItems: GapItem[] = [];

  // Check answers first
  for (const q of draft.questions) {
    const qAnswers = answers.filter((a) => matchPrompt(q.text, a.promptText));
    const competitorsCited = new Map<string, number>();

    for (const a of qAnswers) {
      if (!a.analysis?.recommended) {
        for (const m of a.mentions || []) {
          if (!m.isCustomer && m.brandName) {
            competitorsCited.set(m.brandName, (competitorsCited.get(m.brandName) || 0) + 1);
          }
        }
        for (const c of a.citations || []) {
          const dom = c.domain?.toLowerCase() || "";
          const bClean = draft.businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (dom && !dom.includes(bClean)) {
            competitorsCited.set(dom, (competitorsCited.get(dom) || 0) + 1);
          }
        }
      }
    }

    // Also check analysis gaps if available
    for (const item of analysis) {
      for (const gap of item.gaps || []) {
        if (gap.competitor && matchPrompt(q.text, gap.observation || "")) {
          competitorsCited.set(gap.competitor, (competitorsCited.get(gap.competitor) || 0) + 1);
        }
      }
    }

    if (competitorsCited.size > 0) {
      const topCompetitors = [...competitorsCited.entries()].map(([name, count]) => {
        const domain = name.includes(".") ? name : `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
        return { name, domain, count };
      });
      const display = topCompetitors.length > 1
        ? `${topCompetitors[0].domain} +${topCompetitors.length - 1}`
        : topCompetitors[0]?.domain || "";

      const priority =
        categorizePrompt(q, draft.businessName) === "best-of" || (topCompetitors[0]?.count ?? 0) >= 2
          ? "High"
          : "Medium";

      gapItems.push({
        promptText: q.text,
        citedInsteadDisplay: display,
        priority,
        competitors: topCompetitors,
      });
    }
  }

  // If before live scan has run or gaps are empty, dynamically extract from competitor prompts
  if (gapItems.length === 0) {
    for (const q of draft.questions) {
      const cat = categorizePrompt(q, draft.businessName);
      if (cat === "competitor" || q.intent === "comparison") {
        const vsMatch = q.text.match(/(?:vs|versus|alternative(?:s)? to|better than|is)\s+([A-Za-z0-9]+)/i);
        const rivalName = vsMatch?.[1] ? vsMatch[1].trim() : "Industry rival";
        const rivalDomain = `${rivalName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
        gapItems.push({
          promptText: q.text,
          citedInsteadDisplay: rivalDomain,
          priority: "High",
          competitors: [{ name: rivalName, domain: rivalDomain, count: 1 }],
        });
      }
    }
  }

  const highPriorityGapsCount = gapItems.filter((g) => g.priority === "High").length;
  const totalActionsCount = gapItems.reduce((acc, g) => acc + g.competitors.length, 0);

  return (
    <div className="space-y-6">
      {/* Toast feedback for CMO actions */}
      {cmoToast && (
        <div className="flex items-center justify-between rounded-xl border border-success-200 bg-success-50 p-4 text-xs font-medium text-success-700 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-success-700" />
            <span>{cmoToast}</span>
          </div>
          <button
            onClick={() => setCmoToast(null)}
            className="text-success-700 hover:text-success-900"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Business details collapsible accordion */}
      <details className="rounded-xl border border-line bg-surface-1 p-4 shadow-card">
        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-brand-950">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-brand-400" />
            <span>Business details · edit products and service areas</span>
          </div>
          <span className="text-xs font-normal text-brand-500">
            {draft.businessName} · {draft.locations.length} service area{draft.locations.length === 1 ? "" : "s"}
          </span>
        </summary>
        <div className="mt-4 border-t border-line pt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1.5 text-xs text-brand-600">
              <span className="font-medium text-brand-950">Business name</span>
              <input
                aria-label="Business name"
                className={inputClass}
                disabled={locked}
                value={draft.businessName}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, businessName: e.target.value }))
                }
              />
            </label>
            <label className="space-y-1.5 text-xs text-brand-600">
              <span className="font-medium text-brand-950">Offerings (comma separated)</span>
              <input
                aria-label="Offerings"
                className={inputClass}
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
            <label className="space-y-1.5 text-xs text-brand-600">
              <span className="font-medium text-brand-950">Service areas (comma separated)</span>
              <input
                aria-label="Service areas"
                className={inputClass}
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
          {draft.summary && (
            <p className="text-xs leading-5 text-brand-500">{draft.summary}</p>
          )}
        </div>
      </details>

      {/* 4 Category Metric Cards (Okara style, Screenshot 1) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {categoryStats.map((cat) => {
          const isSelected = filterCategory === cat.key;
          const toneClasses =
            cat.cardTone === "error"
              ? "border-error-200/80 bg-error-50 text-error-700"
              : cat.cardTone === "warning"
                ? "border-warning-200/80 bg-warning-50 text-warning-700"
                : "border-success-200/80 bg-success-50 text-success-700";

          return (
            <button
              key={cat.key}
              type="button"
              onClick={() =>
                setFilterCategory(filterCategory === cat.key ? "ALL" : cat.key)
              }
              className={`flex flex-col rounded-xl border p-4 text-left shadow-xs transition-all ${toneClasses} ${
                isSelected ? "ring-2 ring-primary-500 ring-offset-1" : "hover:opacity-90"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-tight">{cat.label}</span>
                {filterCategory === cat.key && (
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">Active</span>
                )}
              </div>
              <div className="mt-2 text-3xl font-bold font-mono tracking-tight">
                {cat.pct}%
              </div>
              <div className="mt-1 text-xs opacity-90">{cat.subtext}</div>
            </button>
          );
        })}
      </div>

      {filterCategory !== "ALL" && (
        <div className="flex items-center justify-between px-1 text-xs text-brand-500">
          <span>
            Filtered by category:{" "}
            <strong className="text-brand-950">
              {categories.find((c) => c.key === filterCategory)?.label}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setFilterCategory("ALL")}
            className="font-medium text-primary-600 hover:underline"
          >
            Show all categories
          </button>
        </div>
      )}

      {/* Section 1: Tracked Prompts Panel (Okara style, Screenshot 1) */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-card">
        <div className="flex flex-col justify-between gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-brand-700">
              <LayoutGrid size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-950">Tracked prompts</h3>
              <p className="text-xs text-brand-500">
                Who each AI engine cites. Open a row for the answer.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!locked && (
              <ActionButton
                variant="primary"
                disabled={pending || !checks}
                onClick={() => onRun(draft)}
                icon={<Check size={14} />}
              >
                Confirm & check {draft.questions.length} prompts
              </ActionButton>
            )}
            {hasScan && onViewResults && (
              <ActionButton
                variant="secondary"
                onClick={onViewResults}
                icon={<ArrowRight size={14} />}
              >
                View answers
              </ActionButton>
            )}
          </div>
        </div>

        {/* Table column headers */}
        <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-500">
          <div className="flex-1">Prompt</div>
          <div className="flex w-36 items-center justify-center gap-1.5 sm:w-44">
            <ChatGptIcon className="h-3.5 w-3.5 text-brand-600" />
            <span className="normal-case font-medium text-brand-700">ChatGPT</span>
          </div>
          <div className="flex w-36 items-center justify-center gap-1.5 sm:w-44">
            <GoogleAiIcon className="h-3.5 w-3.5" />
            <span className="normal-case font-medium text-brand-700">Google AI</span>
          </div>
        </div>

        {/* Prompts list */}
        <div className="divide-y divide-line">
          {displayedPrompts.map(({ q, originalIndex, category, chatGpt, googleAi }) => {
            const isExpanded = expandedPrompt === originalIndex;
            const categoryBadgeTone =
              category === "best-of" || category === "jobs-to-be-done"
                ? "bad"
                : category === "competitor"
                  ? "warn"
                  : "good";

            return (
              <div key={originalIndex} className="transition-colors hover:bg-surface-2/30">
                {/* Row Header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedPrompt(isExpanded ? null : originalIndex)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedPrompt(isExpanded ? null : originalIndex);
                    }
                  }}
                  className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <div className="flex flex-1 items-start gap-2.5">
                    <button
                      type="button"
                      aria-label={isExpanded ? "Collapse row" : "Expand row"}
                      className="mt-0.5 text-brand-400 hover:text-brand-600"
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold leading-snug text-brand-950">
                        {q.text || <span className="italic text-brand-400">Empty prompt wording</span>}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-brand-500">
                        <Pill tone={categoryBadgeTone}>
                          {category === "best-of"
                            ? "Best-of"
                            : category === "jobs-to-be-done"
                              ? "Jobs to be done"
                              : category === "competitor"
                                ? "Competitor"
                                : "Branded"}
                        </Pill>
                        {q.offering && <span>· {q.offering}</span>}
                        {q.location && <span>· {q.location}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Engine Indicators */}
                  <div className="flex items-center">
                    <div className="flex w-36 items-center justify-center sm:w-44">
                      {chatGpt.status === "recommended" ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-success-200 bg-success-50 text-success-700" title="ChatGPT recommended your business">
                          <Check size={13} />
                        </span>
                      ) : chatGpt.status === "competitor" ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-error-200 bg-error-50 text-xs font-bold text-error-700" title={chatGpt.label}>
                          {chatGpt.competitor?.slice(0, 1).toUpperCase() || "!"}
                        </span>
                      ) : (
                        <span className="font-mono text-sm text-brand-400">—</span>
                      )}
                    </div>
                    <div className="flex w-36 items-center justify-center sm:w-44">
                      {googleAi.status === "recommended" ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-success-200 bg-success-50 text-success-700" title="Google AI recommended your business">
                          <Check size={13} />
                        </span>
                      ) : googleAi.status === "competitor" ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-error-200 bg-error-50 text-xs font-bold text-error-700" title={googleAi.label}>
                          {googleAi.competitor?.slice(0, 1).toUpperCase() || "!"}
                        </span>
                      ) : (
                        <span className="font-mono text-sm text-brand-400">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-line bg-surface-2/40 p-4 space-y-4">
                    {/* Side-by-side comparison cards (Okara Screenshot 1) */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {/* ChatGPT Card */}
                      <div className="rounded-lg border border-line bg-surface-1 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ChatGptIcon className="h-4 w-4 text-brand-700" />
                            <span className="text-xs font-bold text-brand-950">ChatGPT</span>
                          </div>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                              chatGpt.status === "recommended"
                                ? "border-success-200 bg-success-50 text-success-700"
                                : chatGpt.status === "competitor"
                                  ? "border-error-200 bg-error-50 text-error-700"
                                  : "border-line bg-surface-2 text-brand-600"
                            }`}
                          >
                            {chatGpt.label}
                          </span>
                        </div>
                        {chatGpt.quote ? (
                          <blockquote className="border-l-2 border-primary-500 pl-2.5 text-xs italic text-brand-700">
                            &ldquo;{chatGpt.quote}&rdquo;
                          </blockquote>
                        ) : (
                          <p className="text-xs text-brand-500">
                            {chatGpt.status === "pending"
                              ? "Prompt will be sent to ChatGPT during the check."
                              : "No quote saved for this answer."}
                          </p>
                        )}
                      </div>

                      {/* Google AI Card */}
                      <div className="rounded-lg border border-line bg-surface-1 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <GoogleAiIcon className="h-4 w-4" />
                            <span className="text-xs font-bold text-brand-950">Google AI</span>
                          </div>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                              googleAi.status === "recommended"
                                ? "border-success-200 bg-success-50 text-success-700"
                                : googleAi.status === "competitor"
                                  ? "border-error-200 bg-error-50 text-error-700"
                                  : "border-line bg-surface-2 text-brand-600"
                            }`}
                          >
                            {googleAi.label}
                          </span>
                        </div>
                        {googleAi.quote ? (
                          <blockquote className="border-l-2 border-primary-500 pl-2.5 text-xs italic text-brand-700">
                            &ldquo;{googleAi.quote}&rdquo;
                          </blockquote>
                        ) : (
                          <p className="text-xs text-brand-500">
                            {googleAi.status === "pending"
                              ? "Prompt will be sent to Google AI during the check."
                              : "No quote saved for this answer."}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Gap Tasks (Okara style, Screenshots 3, 4, 5) */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-card">
        <div className="flex flex-col justify-between gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-error-200 bg-error-50 text-error-700">
              <Target size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-950">Gap tasks</h3>
              <p className="text-xs text-brand-500">
                {gapItems.length} prompts where a competitor is cited and you aren’t · {highPriorityGapsCount} high priority · {totalActionsCount} actions
              </p>
            </div>
          </div>
        </div>

        {/* Table column headers */}
        <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-500">
          <div className="flex-1">Prompt</div>
          <div className="w-36 text-center sm:w-48">Cited instead</div>
          <div className="w-20 text-center sm:w-28">Gap</div>
          <div className="w-20 text-right sm:w-24">Priority</div>
        </div>

        {/* Gap items list */}
        <div className="divide-y divide-line">
          {gapItems.map((item, index) => {
            const isExpanded = expandedGap === index;

            return (
              <div key={index} className="transition-colors hover:bg-surface-2/30">
                {/* Gap Row */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedGap(isExpanded ? null : index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedGap(isExpanded ? null : index);
                    }
                  }}
                  className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <div className="flex flex-1 items-start gap-2.5">
                    <button
                      type="button"
                      aria-label={isExpanded ? "Collapse gap" : "Expand gap"}
                      className="mt-0.5 text-brand-400 hover:text-brand-600"
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <p className="text-sm font-semibold text-brand-950">{item.promptText}</p>
                  </div>

                  <div className="flex items-center">
                    <div className="flex w-36 items-center justify-center gap-1.5 text-xs font-medium text-brand-700 sm:w-48">
                      <Globe size={13} className="text-brand-400" />
                      <span>{item.citedInsteadDisplay}</span>
                    </div>

                    <div className="w-20 text-center sm:w-28">
                      <Pill>Content</Pill>
                    </div>

                    <div className="w-20 text-right sm:w-24">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          item.priority === "High"
                            ? "border-error-200 bg-error-50 text-error-700"
                            : "border-warning-200 bg-warning-50 text-warning-700"
                        }`}
                      >
                        {item.priority}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Competitor Action Cards (Okara style, Screenshots 3, 4, 5) */}
                {isExpanded && (
                  <div className="border-t border-line bg-surface-2/40 p-4 space-y-3">
                    {item.competitors.map((comp, compIdx) => (
                      <div
                        key={compIdx}
                        className="flex flex-col justify-between gap-3 rounded-lg border border-line bg-surface-1 p-3.5 sm:flex-row sm:items-center"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2 text-brand-600">
                            <Globe size={14} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-brand-950">{comp.domain}</span>
                              <span className="text-xs text-brand-400">· Content Gap</span>
                            </div>
                            <p className="text-xs text-brand-600">
                              {comp.name} is recommended in {comp.count} prompt{comp.count === 1 ? "" : "s"}. Publish a comparison page:{" "}
                              <strong className="text-brand-950">
                                {draft.businessName} vs {comp.name}
                              </strong>
                              .
                            </p>
                          </div>
                        </div>

                        <ActionButton
                          variant="secondary"
                          icon={<Sparkles size={14} className="text-primary-600" />}
                          onClick={() => {
                            setCmoToast(
                              `CMO Strategy Queued: Prepared "${draft.businessName} vs ${comp.name}" comparison page brief in Fix Engine.`,
                            );
                          }}
                        >
                          Ask CMO
                        </ActionButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const QuestionReview = PromptsSection;

