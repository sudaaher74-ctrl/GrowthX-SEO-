"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react";
import {
  PageHeader,
  ActionButton,
  Panel,
  Tabs,
  Pill,
  relativeTime,
} from "@/components/ui/console";
import { LoadingState, NoDataState, FailedState } from "@/components/ui/truthful-state";
import { api, ActionPriorityValue, ActionStatusValue, StrategyActionRow } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";

type TabKey = "overview" | "strategy" | "evidence";

const TABS: Array<{ id: TabKey; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "strategy", label: "30-Day Strategy" },
  { id: "evidence", label: "Evidence" },
];

/** Priority colours, borrowed from the existing status vocabulary. */
const PRIORITY_TONE: Record<ActionPriorityValue, string> = {
  CRITICAL: "bg-red-50 text-red-700",
  HIGH: "bg-amber-50 text-amber-700",
  MEDIUM: "bg-blue-50 text-blue-700",
  LOW: "bg-gray-100 text-gray-600",
};

const CATEGORY_LABEL: Record<string, string> = {
  TECHNICAL_SEO: "Technical SEO",
  CONTENT_GAP: "Content",
  LOCAL_SEO: "Local SEO",
  GOOGLE_BUSINESS_PROFILE: "Google Business Profile",
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  AI_SEARCH: "AI search",
};

export default function ActionEnginePage() {
  return (
    <Suspense fallback={<LoadingState title="Loading" />}>
      <ActionEngineClient />
    </Suspense>
  );
}

function ActionEngineClient() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("overview");

  const overview = useQuery({
    queryKey: ["action-engine-overview", projectId],
    queryFn: () => api.actionEngineOverview(projectId!),
    enabled: Boolean(projectId),
  });

  const strategy = useQuery({
    queryKey: ["action-engine-strategy", projectId],
    queryFn: () => api.actionEngineStrategy(projectId!),
    enabled: Boolean(projectId) && tab !== "evidence",
  });

  const evidence = useQuery({
    queryKey: ["action-engine-findings", projectId],
    queryFn: () => api.actionEngineFindings(projectId!),
    enabled: Boolean(projectId) && tab === "evidence",
  });

  const generate = useMutation({
    mutationFn: () => api.actionEngineGenerate(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["action-engine-overview", projectId] });
      qc.invalidateQueries({ queryKey: ["action-engine-strategy", projectId] });
      qc.invalidateQueries({ queryKey: ["action-engine-findings", projectId] });
    },
  });

  if (!projectId) return <NoDataState title="Select a project" missing="No project is selected." actionRequired="Choose a project from the workspace switcher." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Competitor-to-Action Engine"
        subtitle="What to do next, why, and the competitor evidence behind it."
        actions={
          <ActionButton
            variant="primary"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            icon={generate.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
          >
            {generate.isPending ? "Generating…" : "Generate plan"}
          </ActionButton>
        }
      />

      {generate.isError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-[12px] leading-relaxed text-red-800">{errorMessage(generate.error)}</p>
        </div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && <Overview query={overview} />}
      {tab === "strategy" && <Strategy query={strategy} projectId={projectId} />}
      {tab === "evidence" && <Evidence query={evidence} />}

      <PrivacyNotice />
    </div>
  );
}

function Overview({ query }: { query: ReturnType<typeof useQuery<any>> }) {
  if (query.isLoading) return <LoadingState title="Reading what has been collected" />;
  if (query.isError) return <FailedState title="Overview unavailable" error={errorMessage(query.error)} />;

  const data = query.data;
  if (!data || data.needsData) {
    return (
      <NoDataState
        title="Nothing to compare yet"
        missing={data?.reason ?? "No plan has been generated for this project."}
        whyItMatters="Every recommendation here is built from observed competitor evidence, so there is nothing to show until some has been collected."
        actionRequired="Add competitors, then choose Generate plan."
        action={undefined}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Panel
        title="Who is outperforming you"
        subtitle={`From ${data.findingsUsed ?? 0} observations, last refreshed ${relativeTime(data.lastRefreshedAt)}.`}
      >
        {!data.outperformingYou?.length ? (
          // Not the same as "you are winning": say which.
          <p className="px-1 py-3 text-[13px] text-[var(--text-secondary)]">
            No competitor was measured ahead of you on any signal collected so far. That reflects what has been
            crawled, not a verdict on the whole market.
          </p>
        ) : (
          <div className="space-y-2 py-1">
            {data.outperformingYou.map((rival: any) => (
              <div
                key={rival.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2.5"
              >
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">{rival.name}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {rival.areas.map((area: string) => (
                    <Pill key={area}>{CATEGORY_LABEL[area] ?? area}</Pill>
                  ))}
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {rival.findingCount} observation{rival.findingCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Do these three this week" subtitle="Highest opportunity score, not yet done.">
        {!data.thisWeek?.length ? (
          <p className="px-1 py-3 text-[13px] text-[var(--text-secondary)]">
            No open actions. Generate a plan to create some.
          </p>
        ) : (
          <ol className="space-y-3 py-1">
            {data.thisWeek.map((action: any, index: number) => (
              <li key={action.id} className="rounded-lg border border-[var(--border-color)] px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-bold text-[var(--text-muted)]">{index + 1}</span>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">{action.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PRIORITY_TONE[action.priority as ActionPriorityValue]}`}>
                    {action.priority}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                    {action.opportunityScore}/100
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  {action.scoreExplanation}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      {data.coverageGaps?.length > 0 && <CoverageGaps gaps={data.coverageGaps} />}
    </div>
  );
}

function Strategy({
  query,
  projectId,
}: {
  query: ReturnType<typeof useQuery<any>>;
  projectId: string;
}) {
  const qc = useQueryClient();
  const setStatus = useMutation({
    mutationFn: ({ actionId, status }: { actionId: string; status: ActionStatusValue }) =>
      api.actionEngineSetStatus(projectId, actionId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["action-engine-strategy", projectId] });
      qc.invalidateQueries({ queryKey: ["action-engine-overview", projectId] });
    },
  });

  if (query.isLoading) return <LoadingState title="Loading the plan" />;
  if (query.isError) return <FailedState title="Plan unavailable" error={errorMessage(query.error)} />;

  const data = query.data;
  if (!data || data.needsData) {
    return (
      <NoDataState
        title="No plan yet"
        missing={data?.reason ?? "No plan has been generated for this project."}
        whyItMatters="The plan is written from stored evidence; without a run there is nothing to write from."
        actionRequired="Choose Generate plan above."
        action={undefined}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Panel
        title="Your 30-day plan"
        subtitle={`Generated ${relativeTime(data.generatedAt)} from ${data.findingsUsed} observations${
          data.businessGoal ? `, ranked for ${data.businessGoal.toLowerCase().replace(/_/g, " ")}` : ""
        }.`}
      >
        <div className="space-y-3 py-1">
          {data.actions.map((action: StrategyActionRow) => (
            <ActionCard
              key={action.id}
              action={action}
              onStatus={(status) => setStatus.mutate({ actionId: action.id, status })}
              busy={setStatus.isPending}
            />
          ))}
        </div>
      </Panel>

      {data.coverageGaps?.length > 0 && <CoverageGaps gaps={data.coverageGaps} />}
    </div>
  );
}

function ActionCard({
  action,
  onStatus,
  busy,
}: {
  action: StrategyActionRow;
  onStatus: (status: ActionStatusValue) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border-color)] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PRIORITY_TONE[action.priority]}`}>
              {action.priority}
            </span>
            <Pill>{CATEGORY_LABEL[action.category] ?? action.category}</Pill>
            <span className="text-[11px] text-[var(--text-muted)]">
              {action.opportunityScore}/100 · ~{action.effortHours}h · {action.owner.toLowerCase().replace(/_/g, " ")}
            </span>
          </div>
          <h3 className="mt-1.5 text-[13px] font-semibold text-[var(--text-primary)]">{action.title}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">{action.expectedImpact}</p>
        </div>

        <StatusControl status={action.status} onChange={onStatus} disabled={busy} />
      </div>

      <button
        onClick={() => setOpen((value) => !value)}
        className="mt-2 text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
      >
        {open ? "Hide" : "Show"} steps, evidence and scoring
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-[var(--border-color)] pt-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Steps</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              {action.steps.map((step, i) => (
                <li key={i} className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Evidence this rests on
            </p>
            <ul className="mt-1 space-y-1">
              {action.evidence.map((item) => (
                <li key={item.id} className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  <ShieldCheck size={11} className="mr-1 inline text-emerald-600" />
                  {item.summary}
                  <span className="ml-1 text-[var(--text-muted)]">
                    ({item.sourcePlatform}, {new Date(item.observedAt).toISOString().slice(0, 10)})
                  </span>
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="ml-1 inline-flex items-center text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <ExternalLink size={10} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Why this score</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">{action.scoreExplanation}</p>
          </div>

          {action.dueDate && (
            <p className="text-[11px] text-[var(--text-muted)]">
              <Clock size={10} className="mr-1 inline" />
              Suggested by {new Date(action.dueDate).toISOString().slice(0, 10)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusControl({
  status,
  onChange,
  disabled,
}: {
  status: ActionStatusValue;
  onChange: (status: ActionStatusValue) => void;
  disabled: boolean;
}) {
  const options: Array<{ value: ActionStatusValue; label: string; icon: React.ReactNode }> = [
    { value: "NOT_STARTED", label: "Not started", icon: <Circle size={11} /> },
    { value: "IN_PROGRESS", label: "In progress", icon: <Clock size={11} /> },
    { value: "DONE", label: "Done", icon: <CheckCircle2 size={11} /> },
  ];

  return (
    <div className="flex shrink-0 gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          title={option.label}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition ${
            status === option.value
              ? "bg-[var(--text-primary)] text-white"
              : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Evidence({ query }: { query: ReturnType<typeof useQuery<any>> }) {
  if (query.isLoading) return <LoadingState title="Loading evidence" />;
  if (query.isError) return <FailedState title="Evidence unavailable" error={errorMessage(query.error)} />;

  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <NoDataState
        title="No evidence collected yet"
        missing="No findings are stored for this project."
        whyItMatters="Findings are what every recommendation is built on, and each one records where and when it was read."
        actionRequired="Choose Generate plan, which collects evidence from your crawls and connected platforms."
        action={undefined}
      />
    );
  }

  return (
    <Panel title="Everything observed" subtitle="Each row links to where it was read and when.">
      <div className="space-y-2 py-1">
        {rows.map((finding: any) => (
          <div key={finding.id} className="rounded-lg border border-[var(--border-color)] px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Pill>{CATEGORY_LABEL[finding.category] ?? finding.category}</Pill>
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">{finding.summary}</span>
              <span
                title="How far this can be trusted"
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  finding.confidence === "HIGH"
                    ? "bg-emerald-50 text-emerald-700"
                    : finding.confidence === "MEDIUM"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {finding.confidence}
              </span>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">{finding.detail}</p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              {finding.source.competitor} · {finding.source.platform} ·{" "}
              {new Date(finding.source.observedAt).toISOString().slice(0, 10)}
              {finding.source.url && (
                <a
                  href={finding.source.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="ml-1 inline-flex items-center text-blue-600 hover:underline dark:text-blue-400"
                >
                  view <ExternalLink size={10} className="ml-0.5" />
                </a>
              )}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** What the plan could not see. Stated, never quietly omitted. */
function CoverageGaps({ gaps }: { gaps: string[] }) {
  return (
    <Panel title="What this plan could not see">
      <ul className="space-y-1.5 py-1">
        {gaps.map((gap, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            <Info size={13} className="mt-0.5 shrink-0 text-amber-500" />
            {gap}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function PrivacyNotice() {
  return (
    <p className="px-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
      GrowthX uses publicly available website data and approved platform APIs. It does not access private competitor
      accounts, private analytics, password-protected content, or restricted data.
    </p>
  );
}
