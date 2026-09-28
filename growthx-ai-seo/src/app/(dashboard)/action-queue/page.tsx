"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Lightbulb,
  Loader2,
  RotateCcw,
  User,
  Wrench,
} from "lucide-react";
import { ActionButton, PageHeader, Panel, Pill, StatusNote, Tabs, relativeTime } from "@/components/ui/console";
import {
  useWorkspace,
  usePortfolio,
  useIssueCounts,
  useIssueGroups,
  useAiVisibilityRoadmapTasks,
} from "@/hooks/use-growthx";
import type { IssueGroup } from "@/lib/api-client";
import { SEVERITY_PLAIN, asSentence, pagePath, whoCanFix } from "@/lib/plain-language";

/**
 * The action plan, for someone who has never heard the word "SEO".
 *
 * It used to be an "SEO Action Roadmap" of "directives" with impact scores,
 * severity and source filters, "Copy Brief" and a block of developer
 * instructions about Lighthouse and schema validators. The customers reading
 * it run a dairy or a shop. So each problem is now a numbered step: what is
 * wrong in everyday words, why it costs them customers, what to do, whether
 * they can do it themselves, and a message ready to send to whoever built
 * their website when they cannot.
 *
 * "I've done this" was React state, so every step reset to "To Do" on reload.
 * It is now remembered per project in this browser, and honest about it: a
 * step marked done that the next check of the website still finds comes back
 * to the list with a note saying so, rather than sitting under "Done".
 */

type View = "todo" | "done";

/** When each step was marked done, by group key, for one project. */
type DoneMap = Record<string, string>;

function storageKey(projectId: string) {
  return `growthx.actionPlan.done.${projectId}`;
}

function readDone(projectId: string | null): DoneMap {
  if (!projectId) return {};
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    return raw ? (JSON.parse(raw) as DoneMap) : {};
  } catch {
    return {};
  }
}

function writeDone(projectId: string, map: DoneMap) {
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(map));
  } catch {
    // A per-browser convenience; the plan still works without it.
  }
}

export default function ActionPlanPage() {
  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const domain =
    portfolio.data?.clients.find((c) => c.projectId === projectId)?.domain ?? portfolio.data?.clients[0]?.domain ?? null;

  const countsQuery = useIssueCounts(projectId);
  const groupsQuery = useIssueGroups(projectId, {});
  const aiTasksQuery = useAiVisibilityRoadmapTasks(projectId);

  const [view, setView] = useState<View>("todo");
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // What this browser remembers for the project, read when the project is
  // known, and held in state only once the customer changes it. The shell
  // renders nothing on the server, so this never reads storage there.
  const stored = useMemo(() => readDone(projectId), [projectId]);
  const [changed, setChanged] = useState<{ projectId: string; map: DoneMap } | null>(null);
  const done: DoneMap = changed && changed.projectId === projectId ? changed.map : stored;

  // Most important first: the server ranks by impact, and AI answer tasks
  // are merged into the same order.
  const steps = useMemo(
    () =>
      [...(groupsQuery.data?.groups ?? []), ...(aiTasksQuery.data?.groups ?? [])].sort((a, b) => b.impact - a.impact),
    [groupsQuery.data?.groups, aiTasksQuery.data?.groups],
  );

  const lastCheck = countsQuery.data?.crawledAt ?? null;
  /** Marked done, and no check of the website has run since to say otherwise. */
  const isDone = (g: IssueGroup) => {
    const at = done[g.groupKey];
    return Boolean(at) && !(lastCheck && new Date(lastCheck) > new Date(at));
  };
  /** Marked done, but the latest check still found it. */
  const stillThere = (g: IssueGroup) => {
    const at = done[g.groupKey];
    return Boolean(at && lastCheck && new Date(lastCheck) > new Date(at));
  };

  const todo = steps.filter((g) => !isDone(g));
  const finished = steps.filter(isDone);
  const shown = view === "todo" ? todo : finished;

  const setStepDone = (g: IssueGroup, value: boolean) => {
    if (!projectId) return;
    const next = { ...done };
    if (value) next[g.groupKey] = new Date().toISOString();
    else delete next[g.groupKey];
    setChanged({ projectId, map: next });
    writeDone(projectId, next);
    setNote(
      value
        ? `Nice work. "${g.title}" is marked as done. We'll confirm it the next time we check your website.`
        : `"${g.title}" is back on your to-do list.`,
    );
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2500);
    } catch {
      setNote("Couldn't copy automatically. Select the text and copy it yourself.");
    }
  };

  const loading = groupsQuery.isLoading || countsQuery.isLoading;

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-12">
      <PageHeader
        title="Your action plan"
        subtitle={
          domain
            ? `Simple steps to help more customers find ${domain} on Google. Start at the top: the most important come first.`
            : "Simple steps to help more customers find you on Google. Start at the top: the most important come first."
        }
        actions={
          steps.length > 0 ? (
            <ActionButton
              icon={copied === "plan" ? <Check size={13} className="text-success-600" /> : <Copy size={13} />}
              onClick={() => copy("plan", planText(todo, domain))}
            >
              {copied === "plan" ? "Copied" : "Copy the whole plan"}
            </ActionButton>
          ) : undefined
        }
      />

      {!projectId ? (
        <Empty
          title="Add your website first"
          body="Your action plan is made from a check of your website. Add it on the dashboard and we'll write your plan."
          href="/dashboard"
          cta="Go to the dashboard"
        />
      ) : loading ? (
        <Panel>
          <p className="flex items-center justify-center gap-2 py-12 text-[13px] text-brand-500">
            <Loader2 size={15} className="animate-spin" /> Getting your plan ready…
          </p>
        </Panel>
      ) : !lastCheck && steps.length === 0 ? (
        <Empty
          title="We haven't checked your website yet"
          body="Your plan is made from a check of your website. Run one and your steps will appear here."
          href="/website"
          cta="Check my website"
        />
      ) : (
        <>
          <HowItWorks />

          <Progress
            done={finished.length}
            total={steps.length}
            next={todo[0] ?? null}
            fixedRecently={countsQuery.data?.resolvedThisPeriod ?? 0}
          />

          {note && <StatusNote>{note}</StatusNote>}

          <Tabs
            tabs={[
              { id: "todo" as const, label: "To do", tag: String(todo.length) },
              { id: "done" as const, label: "Done", tag: String(finished.length) },
            ]}
            active={view}
            onChange={setView}
          />

          {shown.length === 0 ? (
            <Panel padded>
              <div className="flex flex-col items-center py-8 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success-50 text-success-600">
                  <CheckCircle2 size={22} />
                </div>
                <p className="mt-3 text-[14px] font-semibold text-brand-950">
                  {view === "todo" ? "Nothing left to do right now" : "Nothing marked as done yet"}
                </p>
                <p className="mt-1 max-w-md text-[12.5px] text-brand-600">
                  {view === "todo"
                    ? "Every step is done. We check your website regularly and will add new steps here if we find anything."
                    : "When you finish a step, press “I've done this” and it moves here."}
                </p>
              </div>
            </Panel>
          ) : (
            <ol className="space-y-3">
              {shown.map((g) => (
                <StepCard
                  key={g.groupKey}
                  step={g}
                  number={steps.indexOf(g) + 1}
                  domain={domain}
                  doneAt={isDone(g) ? done[g.groupKey] : null}
                  stillThereSince={stillThere(g) ? lastCheck : null}
                  copied={copied === g.groupKey}
                  onCopy={() => copy(g.groupKey, developerMessage(g, domain))}
                  onDone={(value) => setStepDone(g, value)}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

/* ── Explainer and progress ─────────────────────────────────────── */

function HowItWorks() {
  return (
    <Panel>
      <details className="group px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-semibold text-brand-950 [&::-webkit-details-marker]:hidden">
          <Lightbulb size={15} className="text-warning-500" />
          New to this? How your plan works
          <ChevronDown size={14} className="ml-auto text-brand-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-brand-600">
          <p>
            When someone searches on Google, Google shows the websites it can read easily and trusts most. We checked every
            page of your website and found things that make that harder.
          </p>
          <p>
            Each step below fixes one of them. Many you can do yourself in the tool you use to edit your website. For the
            others, press <strong>Copy message for your developer</strong> and send it to whoever built your website.
          </p>
          <p>When you&apos;ve finished a step, press <strong>I&apos;ve done this</strong>. We&apos;ll confirm it the next time we check your website.</p>
        </div>
      </details>
    </Panel>
  );
}

function Progress({
  done,
  total,
  next,
  fixedRecently,
}: {
  done: number;
  total: number;
  next: IssueGroup | null;
  fixedRecently: number;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <Panel padded>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[15px] font-semibold text-brand-950">
            {done} of {total} step{total === 1 ? "" : "s"} done
          </p>
          <p className="mt-0.5 text-[12.5px] text-brand-600">
            {next ? (
              <>
                Next up: <span className="font-medium text-brand-950">{next.title}</span>
              </>
            ) : (
              "You've done everything on your plan."
            )}
          </p>
        </div>
        {fixedRecently > 0 && (
          <Pill tone="good">
            {fixedRecently} fix{fixedRecently === 1 ? "" : "es"} confirmed by our checks recently
          </Pill>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100">
        <div className="h-full rounded-full bg-success-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </Panel>
  );
}

/* ── One step ───────────────────────────────────────────────────── */

function StepCard({
  step,
  number,
  domain,
  doneAt,
  stillThereSince,
  copied,
  onCopy,
  onDone,
}: {
  step: IssueGroup;
  number: number;
  domain: string | null;
  doneAt: string | null;
  stillThereSince: string | null;
  copied: boolean;
  onCopy: () => void;
  onDone: (done: boolean) => void;
}) {
  const sev = SEVERITY_PLAIN[step.severity] ?? SEVERITY_PLAIN.LOW;
  const who = whoCanFix(step.action);
  const pages = step.affectedCount;

  if (doneAt) {
    return (
      <li>
        <Panel>
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-600 text-white">
              <Check size={14} strokeWidth={3} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-brand-950">{step.title}</p>
              <p className="text-[11.5px] text-brand-500">
                Marked done {relativeTime(doneAt)}. We&apos;ll confirm it the next time we check {domain ?? "your website"}.
              </p>
            </div>
            <ActionButton icon={<RotateCcw size={12} />} onClick={() => onDone(false)}>
              Undo
            </ActionButton>
          </div>
        </Panel>
      </li>
    );
  }

  return (
    <li>
      <Panel>
        <div className="flex gap-3 p-4 sm:p-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[13px] font-bold text-primary-700">
            {number}
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone={sev.tone}>{sev.label}</Pill>
                {who === "yourself" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-success-50 px-1.5 py-0.5 text-[11px] font-medium text-success-700">
                    <User size={11} /> You can do this yourself
                  </span>
                )}
                {who === "developer" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-1.5 py-0.5 text-[11px] font-medium text-accent-700">
                    <Wrench size={11} /> Needs your web developer
                  </span>
                )}
                {pages > 0 && (
                  <span className="text-[11.5px] text-brand-500">
                    On {pages} page{pages === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-brand-950">{step.title}</h3>
            </div>

            {stillThereSince && (
              <div className="flex items-start gap-2 rounded-lg bg-warning-50 px-3 py-2 text-[12px] text-warning-700">
                <AlertTriangle size={14} className="mt-px shrink-0" />
                <span>
                  You marked this done, but our check {relativeTime(stillThereSince)} still found it. It may not be fully
                  fixed yet.
                </span>
              </div>
            )}

            {step.summary && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-400">Why it matters</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-brand-700">{asSentence(step.summary)}</p>
              </div>
            )}

            {step.action && (
              <div className="rounded-lg bg-brand-50 px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-400">What to do</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-brand-950">{asSentence(step.action)}</p>
              </div>
            )}

            {step.sampleUrls.length > 0 && <WhichPages urls={step.sampleUrls} total={pages} />}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ActionButton variant="primary" icon={<Check size={13} />} onClick={() => onDone(true)}>
                I&apos;ve done this
              </ActionButton>
              <ActionButton
                icon={copied ? <Check size={13} className="text-success-600" /> : <Copy size={13} />}
                onClick={onCopy}
              >
                {copied
                ? "Copied. Paste it into an email or WhatsApp"
                : who === "yourself"
                  ? "Copy these steps"
                  : "Copy message for your developer"}
              </ActionButton>
            </div>
          </div>
        </div>
      </Panel>
    </li>
  );
}

function WhichPages({ urls, total }: { urls: string[]; total: number }) {
  const more = Math.max(0, total - urls.length);
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-[12.5px] font-semibold text-accent-700 hover:underline [&::-webkit-details-marker]:hidden">
        Which pages?
        <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-1.5 space-y-1">
        {urls.map((url) => (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 text-[12.5px] text-brand-700 hover:text-primary-700 hover:underline"
            >
              <span className="truncate">{pagePath(url)}</span>
              <ExternalLink size={11} className="shrink-0" />
            </a>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <Link href="/website?tab=issues" className="mt-1 inline-flex items-center gap-1 text-[12px] text-brand-500 hover:underline">
          and {more} more. See them all <ArrowRight size={11} />
        </Link>
      )}
    </details>
  );
}

function Empty({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <Panel padded>
      <div className="flex flex-col items-center py-8 text-center">
        <p className="text-[15px] font-semibold text-brand-950">{title}</p>
        <p className="mt-1 max-w-md text-[12.5px] text-brand-600">{body}</p>
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-primary-700"
        >
          {cta} <ArrowRight size={13} />
        </Link>
      </div>
    </Panel>
  );
}

/* ── Text to share ──────────────────────────────────────────────── */

/** A message a business owner can paste into an email or WhatsApp as it is. */
function developerMessage(g: IssueGroup, domain: string | null): string {
  const pages = g.sampleUrls.slice(0, 5);
  const more = Math.max(0, g.affectedCount - pages.length);
  return [
    `Hi, could you please help me fix this on ${domain ?? "our website"}?`,
    "",
    g.title,
    g.summary ? `Why it matters: ${asSentence(g.summary)}` : null,
    g.action ? `What to do: ${asSentence(forTheDeveloper(g.action))}` : null,
    pages.length ? "" : null,
    pages.length ? "Pages:" : null,
    ...pages.map((u) => `- ${u}`),
    more > 0 ? `- and ${more} more` : null,
    "",
    "Thank you!",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

/**
 * The instruction as the developer should read it. The audit writes it to the
 * business owner ("Ask your web developer to tell Google…"); the message goes
 * to the developer, so it starts at the instruction itself.
 */
function forTheDeveloper(action: string): string {
  const trimmed = action.replace(/^ask your (web )?developer to\s+/i, "");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Every step still to do, numbered, for sending to whoever looks after the website. */
function planText(steps: IssueGroup[], domain: string | null): string {
  const lines = [`Website action plan${domain ? ` for ${domain}` : ""}`, ""];
  steps.forEach((g, i) => {
    lines.push(`${i + 1}. ${g.title}`);
    if (g.action) lines.push(`   What to do: ${asSentence(g.action)}`);
    if (g.affectedCount > 0) lines.push(`   On ${g.affectedCount} page${g.affectedCount === 1 ? "" : "s"}, for example: ${g.sampleUrls[0] ?? ""}`);
    lines.push("");
  });
  return lines.join("\n").trimEnd();
}
