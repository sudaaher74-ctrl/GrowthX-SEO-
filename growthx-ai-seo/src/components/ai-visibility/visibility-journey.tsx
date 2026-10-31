"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowRightLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Globe,
  LayoutGrid,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-growthx";
import { api, visibilityJourneyApi } from "@/lib/api-client";
import {
  journeyRunning,
  providerName,
  type BuyerQuestion,
  type VisibilityAnswer,
  type VisibilityAssessment,
  type VisibilityBrief,
  type VisibilityContext,
} from "@/lib/visibility-workflow";
import { ActionButton, PageHeader, Panel, Pill, StatusNote, Table, Th, Tr, Td } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { EvidenceLinks, AnswerResults, GapResults } from "./visibility-journey-results";
import { GapPlanModal } from "./gap-plan-modal";

export function VisibilityJourneyPage() {
  const workspace = useWorkspace();
  return <QueryState isLoading={workspace.isLoading} error={workspace.error} isEmpty={!workspace.projectId} emptyTitle="Choose a business" emptyBody="Select a workspace to check its AI visibility.">
    {workspace.projectId && <Journey key={workspace.projectId} projectId={workspace.projectId} />}
  </QueryState>;
}

function Journey({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ["visibility-journey", projectId];
  const query = useQuery({ queryKey: key, queryFn: () => visibilityJourneyApi.read(projectId), retry: false,
    refetchInterval: (q) => journeyRunning(q.state.data?.journey?.status) ? 4000 : false });
  const data = query.data;
  const run = data?.journey;
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const prepare = useMutation({ mutationFn: () => visibilityJourneyApi.prepare(projectId), retry: false,
    onSuccess: () => { void refresh(); }, onError: () => { void refresh(); } });
  const check = useMutation({ mutationFn: ({ id, brief }: { id: string; brief?: VisibilityBrief }) => visibilityJourneyApi.check(projectId, id, brief), retry: false,
    onSuccess: () => { void refresh(); }, onError: () => { void refresh(); } });
  const busy = journeyRunning(run?.status) || prepare.isPending || check.isPending;
  const configured = data?.providers.filter((p) => p.configured && !p.unavailableReason) ?? [];
  const assistantNames = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(configured.map((p) => providerName(p.provider)));
  const error = prepare.error || check.error;

  return <div className="space-y-5 pb-12">
    <PageHeader title="AI Visibility" subtitle="Find out whether AI recommends your business — and what to improve next." actions={<>
      {run && <ActionButton disabled={busy || !configured.length || query.isLoading} icon={<Sparkles size={14} />} onClick={() => prepare.mutate()}>Start a new analysis</ActionButton>}
      <ActionButton aria-label="Refresh AI Visibility status" icon={<RefreshCw size={14} />} onClick={() => void refresh()}>Refresh</ActionButton>
    </>} />
    <QueryState isLoading={query.isLoading} error={query.error}>
      {error && <StatusNote tone="bad">{error.message}</StatusNote>}
      {data && !configured.length && <StatusNote tone="bad">AI checks are temporarily unavailable. Please contact support.</StatusNote>}
      {!run && <Panel padded>
        <div className="mx-auto max-w-xl space-y-4 py-8 text-center">
          <Sparkles className="mx-auto text-primary-600" size={28} />
          <h2 className="text-xl font-semibold text-brand-950">See your business through your buyers’ prompts</h2>
          <p className="text-sm leading-6 text-brand-600">We use your website audit to draft relevant buyer prompts. You review them, we ask the available AI assistants, and you get real answers showing where your business is recommended.</p>
          <ActionButton variant="primary" disabled={busy || !configured.length || query.isLoading} onClick={() => prepare.mutate()}>{prepare.isPending ? "Preparing your prompts…" : "Prepare my prompts"}</ActionButton>
          <p className="text-xs text-brand-500">Your Website Audit is the starting point. Connected Google data and audited competitors add context.</p>
        </div>
      </Panel>}
      {run && <>
        {busy && <Panel padded><div role="status" aria-live="polite" className="space-y-3">
          <div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-brand-950">{run.phase === "PREPARE" ? "Understanding your business and preparing prompts" : run.status === "QUEUED" ? "Starting your AI checks" : run.status === "CHECKING" ? `Asking ${assistantNames} your buyer prompts` : "Analysing saved answers"}</span><span>{run.progress}%</span></div>
          <progress aria-label="AI Visibility progress" max={100} value={run.progress} className="h-2 w-full accent-primary-600" />
          <p className="text-xs text-brand-500">Progress is saved. You can leave and return without starting again.</p>
        </div></Panel>}
        {run.status === "FAILED" && <StatusNote tone="bad">This analysis needs attention. Open Analysis details below to see what happened and retry.</StatusNote>}
        {run.brief ? (
          <PromptsSection
            projectId={projectId}
            key={`${run.id}-${run.updatedAt}`}
            brief={run.brief}
            locked={busy || !!run.scanId}
            checks={configured.length * run.brief.questions.length}
            pending={check.isPending}
            onRun={(brief) => check.mutate({ id: run.id, brief })}
            answers={data?.answers ?? []}
            hasScan={!!run.scanId}
          />
        ) : (
          <Panel title="Review before you run" subtitle="Check your products, service areas and buyer prompts. Then confirm to start the AI checks." padded>
            <p className="text-sm text-brand-500">{busy ? "Your business details and prompts will appear here when ready." : "Your business details are not ready. Start a new analysis to retry."}</p>
          </Panel>
        )}
        {data && data.answers.length > 0 && <>
          <AnswerResults data={data} />
          <GapResults data={data} />
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

function ClaudeIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Claude" role="img">
      <path d="M12 2l1.6 5.8L19.4 9.4l-5.8 1.6L12 16.8l-1.6-5.8L4.6 9.4l5.8-1.6L12 2zm6 12l.9 3.3L22.2 18.2l-3.3.9L18 22.4l-.9-3.3-3.3-.9 3.3-.9L18 14zm-12 0l.9 3.3L10.2 18.2l-3.3.9L6 22.4l-.9-3.3-3.3-.9 3.3-.9L6 14z" />
    </svg>
  );
}

function PerplexityIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Perplexity" role="img">
      <path d="M12 2a1 1 0 0 1 1 1v4.06a7.02 7.02 0 0 1 2.93 1.21l2.87-2.87a1 1 0 1 1 1.41 1.41l-2.87 2.87A7.02 7.02 0 0 1 18.55 12.6H22a1 1 0 1 1 0 2h-3.45a7.02 7.02 0 0 1-1.21 2.93l2.87 2.87a1 1 0 0 1-1.41 1.41l-2.87-2.87A7.02 7.02 0 0 1 13 20.06V23a1 1 0 1 1-2 0v-2.94a7.02 7.02 0 0 1-2.93-1.21l-2.87 2.87a1 1 0 0 1-1.41-1.41l2.87-2.87A7.02 7.02 0 0 1 5.45 14.6H2a1 1 0 1 1 0-2h3.45a7.02 7.02 0 0 1 1.21-2.93L3.79 6.8a1 1 0 0 1 1.41-1.41l2.87 2.87A7.02 7.02 0 0 1 11 7.06V3a1 1 0 0 1 1-1zm0 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    </svg>
  );
}

type PromptCategory = "best-of" | "jobs-to-be-done" | "competitor" | "branded";

function categorizePrompt(q: BuyerQuestion, businessName: string): PromptCategory {
  const intent = (q.intent || "").toLowerCase().trim();
  if (intent === "branded" || intent === "brand") return "branded";
  if (intent === "competitor" || intent === "comparison") return "competitor";
  if (intent === "problem" || intent === "action" || intent === "jobs-to-be-done" || intent === "job") return "jobs-to-be-done";
  if (intent === "best-of" || intent === "best of" || intent === "recommendation") return "best-of";

  const text = (q.text || "").toLowerCase();
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

export type SupportedEngine = "ChatGPT" | "Google AI" | "Claude" | "Perplexity";

interface EngineCitation {
  engine: SupportedEngine;
  status: "recommended" | "competitor" | "not_cited" | "pending";
  label: string;
  competitor?: string | null;
  quote?: string | null;
}

const ENGINES: {
  key: "chatGpt" | "googleAi" | "claude" | "perplexity";
  name: SupportedEngine;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "chatGpt", name: "ChatGPT", icon: ChatGptIcon },
  { key: "googleAi", name: "Google AI", icon: GoogleAiIcon },
  { key: "claude", name: "Claude", icon: ClaudeIcon },
  { key: "perplexity", name: "Perplexity", icon: PerplexityIcon },
];

function getEngineCitation(
  promptText: string,
  engine: SupportedEngine,
  answers: VisibilityAnswer[],
  businessName: string,
): EngineCitation {
  const matchingAnswer = answers.find((a) => {
    if (!matchPrompt(promptText, a.promptText)) return false;
    const p = (a.provider || "").toUpperCase();
    const m = (a.model || "").toUpperCase();

    switch (engine) {
      case "ChatGPT":
        return (
          p.includes("OPENAI") ||
          p.includes("CHATGPT") ||
          p.includes("GPT") ||
          m.includes("GPT") ||
          m.includes("OPENAI")
        );
      case "Google AI":
        return (
          p.includes("GEMINI") ||
          p.includes("GOOGLE") ||
          m.includes("GEMINI") ||
          m.includes("GOOGLE")
        );
      case "Claude":
        return (
          p.includes("ANTHROPIC") ||
          p.includes("CLAUDE") ||
          m.includes("CLAUDE") ||
          m.includes("ANTHROPIC")
        );
      case "Perplexity":
        return (
          p.includes("PERPLEXITY") ||
          m.includes("PERPLEXITY") ||
          m.includes("SONAR")
        );
    }
  });

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

  if (!matchingAnswer.rawResponse?.trim()) return { engine, status: "pending", label: "No saved answer" };

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
    label: matchingAnswer.analysis?.brandMentioned ? "Mentioned only" : "Not mentioned in answer",
    quote: matchingAnswer.analysis?.parsedJson?.recommendationQuote || null,
  };
}

function PromptsSection({
  projectId,
  brief,
  locked,
  checks,
  pending,
  onRun,
  answers = [],
  hasScan,
  onViewResults,
}: {
  projectId: string;
  brief: VisibilityBrief;
  locked: boolean;
  checks: number;
  pending: boolean;
  onRun: (brief: VisibilityBrief) => void;
  answers?: VisibilityAnswer[];
  hasScan?: boolean;
  onViewResults?: () => void;
}) {
  const [draft, setDraft] = useState(brief);
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [expandedPrompt, setExpandedPrompt] = useState<number | null>(0);
  const [expandedGap, setExpandedGap] = useState<number | null>(0);
  const [filterCategory, setFilterCategory] = useState<PromptCategory | "ALL">("ALL");
  const [cmoToast, setCmoToast] = useState<string | null>(null);
  const [activePlanGap, setActivePlanGap] = useState<{
    id: string;
    comp: { domain: string; name: string; count: number };
    promptText: string;
    priority: string;
  } | null>(null);

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
      !a.errorMessage && !!a.rawResponse?.trim() && !!a.analysis && promptsInCat.some((q) => matchPrompt(q.text, a.promptText)),
    );

    const total = answersForCat.length;
    const cited = answersForCat.filter(
      (a) => a.analysis?.recommended || a.analysis?.brandMentioned,
    ).length;

    const pct = total > 0 ? Math.round((cited / total) * 100) : null;
    const subtext =
      total > 0
        ? `mentioned in ${cited} of ${total} measured answers`
        : "Not measured — no successfully classified answers";

    return {
      ...cat,
      count: promptsInCat.length,
      pct,
      subtext,
    };
  });

  // 2. Filtered prompts
  const buildPromptItem = (q: BuyerQuestion, originalIndex: number) => ({
    q,
    originalIndex,
    category: categorizePrompt(q, draft.businessName),
    citations: {
      chatGpt: getEngineCitation(q.text, "ChatGPT", answers, draft.businessName),
      googleAi: getEngineCitation(q.text, "Google AI", answers, draft.businessName),
      claude: getEngineCitation(q.text, "Claude", answers, draft.businessName),
      perplexity: getEngineCitation(q.text, "Perplexity", answers, draft.businessName),
    },
  });

  const displayedPrompts = draft.questions
    .map(buildPromptItem)
    .filter(
      (item) => filterCategory === "ALL" || item.category === filterCategory,
    );

  const promptsToDisplay = isEditing
    ? draft.questions.map(buildPromptItem)
    : displayedPrompts;

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
    const qAnswers = answers.filter((a) => !a.errorMessage && !!a.rawResponse?.trim() && matchPrompt(q.text, a.promptText));
    const competitorsCited = new Map<string, { count: number; domain: string }>();

    for (const a of qAnswers) {
      if (!a.analysis?.recommended) {
        for (const m of a.mentions || []) {
          if (!m.isCustomer && m.brandName) {
            const existing = competitorsCited.get(m.brandName);
            competitorsCited.set(m.brandName, { count: (existing?.count ?? 0) + 1, domain: existing?.domain ?? "" });
          }
        }
        for (const c of a.citations || []) {
          const dom = c.domain?.toLowerCase() || "";
          const bClean = draft.businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (dom && !dom.includes(bClean)) {
            competitorsCited.set(dom, { count: (competitorsCited.get(dom)?.count ?? 0) + 1, domain: dom });
          }
        }
      }
    }

    if (competitorsCited.size > 0) {
      // Only a saved citation supplies a website address, even for dotted brand names.
      const topCompetitors = [...competitorsCited.entries()].map(([name, evidence]) => ({ name, ...evidence }));
      const display = topCompetitors.length > 1
        ? `${topCompetitors[0].domain || topCompetitors[0].name} +${topCompetitors.length - 1}`
        : topCompetitors[0]?.domain || topCompetitors[0]?.name || "";

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

      {/* 4 Category Metric Cards (Refined Day & Night Theme) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {categoryStats.map((cat) => {
          const isSelected = filterCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() =>
                setFilterCategory(filterCategory === cat.key ? "ALL" : cat.key)
              }
              className={cn(
                "flex flex-col rounded-2xl border p-4 text-left shadow-card transition-all",
                "bg-brand-50/70 dark:bg-brand-900/40",
                isSelected
                  ? "border-brand-950 dark:border-brand-100 ring-2 ring-brand-950/10 dark:ring-brand-100/10"
                  : "border-brand-200/60 dark:border-brand-800/80 hover:border-brand-300 dark:hover:border-brand-700",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">{cat.label}</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      cat.key === "best-of" || cat.key === "jobs-to-be-done"
                        ? "bg-warning-500"
                        : cat.key === "competitor"
                          ? "bg-primary-500"
                          : "bg-success-500",
                    )}
                  />
                  {isSelected && (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-brand-950 dark:text-brand-100">
                      Active
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 font-mono text-3xl font-extrabold tracking-tight text-brand-950 dark:text-brand-50">
                {cat.pct == null ? "—" : `${cat.pct}%`}
              </div>
              <div className="mt-1 text-xs text-brand-400 dark:text-brand-500">{cat.subtext}</div>
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

      {/* Section 1: Tracked Prompts Panel (Okara style, Screenshot 1 & 2) */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-card">
        <div className="flex flex-col justify-between gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-brand-700">
              <LayoutGrid size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-950">Tracked prompts</h3>
              <p className="text-xs text-brand-500">
                {isEditing
                  ? "Edits are included when you confirm the next check."
                  : "Saved answer references from each AI engine. Open a row for details."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-800 dark:bg-white dark:text-brand-950 dark:hover:bg-brand-100"
              >
                <Check size={14} />
                Done
              </button>
            ) : (
              <>
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
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-xs transition-colors hover:bg-surface-2 hover:text-brand-950"
                >
                  <Pencil size={13} />
                  Edit
                </button>
                {hasScan && onViewResults && (
                  <ActionButton
                    variant="secondary"
                    onClick={onViewResults}
                    icon={<ArrowRight size={14} />}
                  >
                    View answers
                  </ActionButton>
                )}
              </>
            )}
          </div>
        </div>

        {/* Table container with horizontal scroll for smaller screens */}
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            {/* Table column headers */}
            <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-500">
              <div className="flex-1">Prompt</div>
              {ENGINES.map((engine) => {
                const Icon = engine.icon;
                return (
                  <div key={engine.name} className="flex w-20 items-center justify-center gap-1.5 sm:w-28">
                    <Icon className="h-3.5 w-3.5 text-brand-600" />
                    <span className="normal-case font-medium text-brand-700">{engine.name}</span>
                  </div>
                );
              })}
            </div>

            {/* Prompts list */}
            <div className="divide-y divide-line">
              {promptsToDisplay.map(({ q, originalIndex, category, citations }) => {
                if (isEditing) {
                  return (
                    <div
                      key={originalIndex}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/20"
                    >
                      {/* Left: Input, Category select, Trash */}
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <input
                          type="text"
                          aria-label={`Buyer question ${originalIndex + 1}`}
                          value={q.text}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraft((d) => ({
                              ...d,
                              questions: d.questions.map((item, i) =>
                                i === originalIndex ? { ...item, text: val } : item,
                              ),
                            }));
                          }}
                          placeholder="Enter prompt wording..."
                          className="flex-1 rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-brand-950 placeholder:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <div className="w-36 shrink-0">
                          <select
                            value={
                              category === "jobs-to-be-done"
                                ? "Problem"
                                : category === "best-of"
                                  ? "Best Of"
                                  : category === "competitor"
                                    ? "Competitor"
                                    : "Branded"
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              const newIntent =
                                val === "Problem"
                                  ? "problem"
                                  : val === "Best Of"
                                    ? "best-of"
                                    : val === "Competitor"
                                      ? "competitor"
                                      : "branded";
                              setDraft((d) => ({
                                ...d,
                                questions: d.questions.map((item, i) =>
                                  i === originalIndex ? { ...item, intent: newIntent } : item,
                                ),
                              }));
                            }}
                            className="w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm font-medium text-brand-950 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="Problem">Problem</option>
                            <option value="Best Of">Best Of</option>
                            <option value="Competitor">Competitor</option>
                            <option value="Branded">Branded</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDraft((d) => ({
                              ...d,
                              questions: d.questions.filter((_, i) => i !== originalIndex),
                            }));
                          }}
                          className="rounded-lg p-2 text-brand-400 transition-colors hover:bg-surface-2 hover:text-error-600"
                          title="Delete prompt"
                          aria-label="Delete prompt"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Right: Engine Indicators */}
                      <div className="hidden shrink-0 items-center sm:flex">
                        {ENGINES.map((engine) => {
                          const c = citations[engine.key];
                          return (
                            <div key={engine.name} className="flex w-20 items-center justify-center sm:w-28">
                              {c.status === "recommended" ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full border border-success-500/30 bg-success-500/10 px-2 py-0.5 text-[11px] font-semibold text-success-600 dark:border-success-400/30 dark:bg-success-400/10 dark:text-success-400"
                                  title={`${engine.name}: Recommended your business`}
                                >
                                  <Check size={11} className="stroke-[2.5]" />
                                  <span>Recommended</span>
                                </span>
                              ) : c.status === "competitor" ? (
                                <span
                                  className="inline-flex max-w-[95px] sm:max-w-[105px] items-center gap-1.5 rounded-full border border-warning-500/25 bg-warning-500/10 px-2 py-0.5 text-[11px] font-medium text-warning-700 dark:border-warning-400/25 dark:bg-warning-400/10 dark:text-warning-300 truncate shadow-xs"
                                  title={`Other reference: ${c.competitor}`}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-warning-500 dark:bg-warning-400 shrink-0" />
                                  <span className="truncate">{c.competitor || "Rival"}</span>
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-brand-300 dark:text-brand-600">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // Normal expandable row
                const isExpanded = expandedPrompt === originalIndex;
                const categoryBadgeTone =
                  category === "competitor"
                    ? "warn"
                    : category === "branded"
                      ? "good"
                      : "default";

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
                      <div className="flex flex-1 items-start gap-2.5 min-w-0">
                        <button
                          type="button"
                          aria-label={isExpanded ? "Collapse row" : "Expand row"}
                          className="mt-0.5 text-brand-400 hover:text-brand-600"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm font-semibold leading-snug text-brand-950 truncate">
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
                      <div className="flex items-center shrink-0">
                        {ENGINES.map((engine) => {
                          const c = citations[engine.key];
                          return (
                            <div key={engine.name} className="flex w-20 items-center justify-center sm:w-28">
                              {c.status === "recommended" ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full border border-success-500/30 bg-success-500/10 px-2 py-0.5 text-[11px] font-semibold text-success-600 dark:border-success-400/30 dark:bg-success-400/10 dark:text-success-400"
                                  title={`${engine.name}: Recommended your business`}
                                >
                                  <Check size={11} className="stroke-[2.5]" />
                                  <span>Recommended</span>
                                </span>
                              ) : c.status === "competitor" ? (
                                <span
                                  className="inline-flex max-w-[95px] sm:max-w-[105px] items-center gap-1.5 rounded-full border border-warning-500/25 bg-warning-500/10 px-2 py-0.5 text-[11px] font-medium text-warning-700 dark:border-warning-400/25 dark:bg-warning-400/10 dark:text-warning-300 truncate shadow-xs"
                                  title={`Other reference: ${c.competitor}`}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-warning-500 dark:bg-warning-400 shrink-0" />
                                  <span className="truncate">{c.competitor || "Rival"}</span>
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-brand-300 dark:text-brand-600">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-line bg-surface-2/40 p-4 space-y-4">
                        {/* Side-by-side comparison cards for all 4 models */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {ENGINES.map((engine) => {
                            const c = citations[engine.key];
                            const Icon = engine.icon;
                            return (
                              <div
                                key={engine.name}
                                className="flex flex-col justify-between rounded-xl border border-brand-200/60 bg-brand-50/70 p-3.5 space-y-3 shadow-card dark:border-brand-800/80 dark:bg-brand-900/50"
                              >
                                <div className="space-y-2.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                                      <span className="text-xs font-bold text-brand-950 dark:text-brand-100">{engine.name}</span>
                                    </div>
                                    {c.status === "recommended" ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-success-500/30 bg-success-500/10 px-2 py-0.5 text-[11px] font-semibold text-success-600 dark:border-success-400/30 dark:bg-success-400/10 dark:text-success-400">
                                        <Check size={11} className="stroke-[2.5]" /> Recommended
                                      </span>
                                    ) : c.status === "competitor" ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-warning-500/25 bg-warning-500/10 px-2 py-0.5 text-[11px] font-semibold text-warning-700 dark:border-warning-400/25 dark:bg-warning-400/10 dark:text-warning-300">
                                        <ArrowRightLeft size={10} /> Rival reference
                                      </span>
                                    ) : c.status === "pending" ? (
                                      <span className="rounded-full border border-brand-200/60 bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-500 dark:border-brand-800 dark:bg-brand-800 dark:text-brand-400">
                                        Pending
                                      </span>
                                    ) : (
                                      <span className="rounded-full border border-brand-200/60 bg-brand-100/70 px-2 py-0.5 text-[11px] font-medium text-brand-400 dark:border-brand-800 dark:bg-brand-800/60 dark:text-brand-400">
                                        {c.label === "Check failed" ? "Check failed" : "Not mentioned"}
                                      </span>
                                    )}
                                  </div>

                                  {c.status === "competitor" && c.competitor && (
                                    <div className="rounded-lg border border-warning-500/20 bg-warning-500/5 p-2.5 dark:border-warning-400/20 dark:bg-warning-400/5">
                                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-warning-700 dark:text-warning-400">
                                        <ArrowRightLeft size={10} />
                                        <span>Other reference</span>
                                      </div>
                                      <p className="mt-1 text-xs font-bold text-brand-950 dark:text-brand-100 break-words" title={c.competitor}>
                                        {c.competitor}
                                      </p>
                                    </div>
                                  )}

                                  {c.quote ? (
                                    <blockquote className="rounded-lg border-l-2 border-primary-500 bg-brand-100/50 p-2.5 text-xs italic text-brand-700 dark:bg-brand-800/40 dark:text-brand-300">
                                      &ldquo;{c.quote}&rdquo;
                                    </blockquote>
                                  ) : (
                                    <p className="text-xs text-brand-400 dark:text-brand-500">
                                      {c.status === "pending"
                                        ? `Prompt will be sent to ${engine.name} during the check.`
                                        : c.status === "competitor"
                                          ? "No direct quote snippet recorded."
                                          : "No quote saved for this answer."}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add prompt button in edit mode */}
            {isEditing && (
              <div className="border-t border-line bg-surface-2/20 px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setDraft((d) => ({
                      ...d,
                      questions: [
                        ...d.questions,
                        {
                          text: "",
                          offering: "",
                          location: "",
                          intent: "best-of",
                          rationale: "",
                          evidenceIds: [],
                        },
                      ],
                    }));
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
                >
                  <Plus size={14} />
                  Add another prompt
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Gap Tasks (Okara style, Screenshots 3, 4, 5) */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-card">
        <div className="flex flex-col justify-between gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-warning-500/25 bg-warning-500/10 text-warning-700 dark:border-warning-400/25 dark:bg-warning-400/10 dark:text-warning-300">
              <Target size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-950">Gap tasks</h3>
              <p className="text-xs text-brand-500">
                {gapItems.length} prompts with other brand or source references · {highPriorityGapsCount} high priority · {totalActionsCount} review candidates
              </p>
            </div>
          </div>
        </div>

        {/* Table column headers */}
        <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-500">
          <div className="flex-1">Prompt</div>
          <div className="w-36 text-center sm:w-48">Other references</div>
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
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          item.priority === "High"
                            ? "border-error-500/25 bg-error-500/10 text-error-600 dark:border-error-400/25 dark:bg-error-400/10 dark:text-error-400"
                            : "border-warning-500/25 bg-warning-500/10 text-warning-700 dark:border-warning-400/25 dark:bg-warning-400/10 dark:text-warning-300",
                        )}
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
                              <span className="text-xs font-bold text-brand-950">{comp.domain || comp.name}</span>
                              <span className="text-xs text-brand-400">· Content Gap</span>
                            </div>
                            <p className="text-xs text-brand-600">
                              {comp.name} appears in {comp.count} saved mention or citation reference{comp.count === 1 ? "" : "s"}. Consider a verified comparison:{" "}
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
                            setActivePlanGap({
                              id: crypto.randomUUID(),
                              comp,
                              promptText: item.promptText,
                              priority: item.priority,
                            });
                          }}
                        >
                          Get a plan
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

      {/* AI Strategy Plan Modal for Competitor Gaps */}
      {activePlanGap && (
        <GapPlanModal
          businessName={draft.businessName}
          competitor={activePlanGap.comp}
          promptText={activePlanGap.promptText}
          priority={activePlanGap.priority}
          onClose={() => setActivePlanGap(null)}
          onSaveToFixEngine={async (plan) => {
            await api.savedPlans.save(projectId, {
              id: activePlanGap.id, projectId,
              title: `Review ${activePlanGap.comp.name} for ${activePlanGap.promptText}`,
              category: "CONTENT", source: "AI_VISIBILITY",
              priority: activePlanGap.priority === "High" ? "HIGH" : "MEDIUM",
              impact: "Proposed review based on saved answer references; performance lift is not measured.",
              effortHours: 0, deliverable: plan,
              evidence: `${activePlanGap.comp.count} saved mention or citation references. Website address: ${activePlanGap.comp.domain || "not verified"}.`,
              stagedAt: new Date().toISOString(), status: "STAGED",
            });
            void queryClient.invalidateQueries({ queryKey: ["saved-plans", projectId] });
            setCmoToast("Review task saved to Fix Engine.");
            setActivePlanGap(null);
          }}
        />
      )}
    </div>
  );
}
