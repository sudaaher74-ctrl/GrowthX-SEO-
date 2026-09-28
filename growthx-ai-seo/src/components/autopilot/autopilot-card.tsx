"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Circle, Loader2, Plus, Sparkles, X } from "lucide-react";
import { ActionButton } from "@/components/ui/console";
import { useAiva } from "@/components/voice/aiva-provider";
import { useWorkspace } from "@/hooks/use-growthx";
import { api, type AutopilotRun } from "@/lib/api-client";

const ACTIVE: AutopilotRun["status"][] = ["DISCOVERING", "AWAITING_CONFIRMATION", "RUNNING"];
const DISMISSED_KEY = "growthx.autopilot.dismissed";
/** Five are suggested; the customer keeps two or three. Mirrors PICK_LIMIT on the server. */
const PICK_MIN = 2;
const PICK_MAX = 3;

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function listNames(names: string[]) {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

type StepState = "done" | "active" | "todo" | "waiting";

/**
 * The autopilot's progress, wherever the user is in the app: what it has
 * done, the one question it needs answered (which competitors are real), and
 * a way to the report when it is finished.
 */
export function AutopilotCard() {
  const { projectId } = useWorkspace();
  const { say, isOpen } = useAiva();
  const router = useRouter();
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  // When the card was drawn: a run finished long before that is not shown.
  const [openedAt] = useState(() => Date.now());
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [extra, setExtra] = useState("");
  const lastStatus = useRef<string | null>(null);

  const run = useQuery({
    queryKey: ["autopilot", projectId],
    queryFn: () => api.autopilot.latest(projectId!),
    enabled: Boolean(projectId),
    // With no run yet, check now and then: the first website audit finishing
    // starts one on the server, and the picker should appear without a reload.
    refetchInterval: (q) => (q.state.data == null ? 30_000 : ACTIVE.includes(q.state.data.status) ? 5000 : false),
    retry: false,
  });
  const data = run.data ?? null;

  // Spoken updates when the run reaches a point the user needs to know about.
  useEffect(() => {
    if (!data) return;
    const key = `${data.id}:${data.status}`;
    if (lastStatus.current === null) {
      lastStatus.current = key;
      return;
    }
    if (lastStatus.current === key) return;
    lastStatus.current = key;
    if (data.status === "AWAITING_CONFIRMATION") {
      say(
        data.suggestions.length
          ? `I found ${listNames(data.suggestions.map((s) => s.name))}. Which two or three do you really compete with? Pick them here, or say yes to keep the top three.`
          : "I couldn't find your competitors on my own. Tell me their websites and I'll carry on.",
      );
    } else if (data.status === "DONE") {
      say("Your competitor report is ready.");
      qc.invalidateQueries({ queryKey: ["competitor-report-latest"] });
    }
  }, [data, say, qc]);

  const confirm = useMutation({
    mutationFn: (domains: string[]) => api.autopilot.confirm(data!.id, domains),
    onSuccess: (next) => {
      qc.setQueryData(["autopilot", projectId], next);
      if (isOpen) say(`Done. I've added ${listNames(next.competitors.map((c) => c.name))} and started reading their websites.`);
    },
  });
  const cancel = useMutation({
    mutationFn: () => api.autopilot.cancel(data!.id),
    onSuccess: (next) => qc.setQueryData(["autopilot", projectId], next),
  });

  if (!data || dismissed.includes(data.id) || data.status === "CANCELLED") return null;
  if (!ACTIVE.includes(data.status) && data.finishedAt && openedAt - new Date(data.finishedAt).getTime() > 24 * 3600e3) return null;

  // Nothing is ticked for you: the point is that the customer, not the model,
  // says which of these they actually lose sales to.
  const selected = chosen ?? new Set<string>();
  const full = selected.size >= PICK_MAX;
  const toggle = (domain: string) => {
    const next = new Set(selected);
    if (next.has(domain)) next.delete(domain);
    else if (!full) next.add(domain);
    setChosen(next);
  };
  const addExtra = () => {
    const d = extra.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (full || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return;
    setChosen(new Set([...selected, d]));
    setExtra("");
  };
  const extras = [...selected].filter((d) => !data.suggestions.some((s) => s.domain === d));
  // Two is the ask, unless fewer than two were found and none added.
  const pickMin = Math.min(PICK_MIN, data.suggestions.length + extras.length) || 1;
  const canConfirm = selected.size >= pickMin && selected.size <= PICK_MAX;
  const finders = [...new Set(data.suggestions.map((s) => s.foundBy).filter(Boolean))];

  const openReport = () => {
    const url = "/competitor-intelligence?tab=report";
    // On that page already, a router transition to a new ?tab is undone by the
    // page; a history entry updates its search params, as its own tabs do.
    if (window.location.pathname === "/competitor-intelligence") window.history.pushState(null, "", url);
    else router.push(url);
  };

  const dismiss = () => {
    const next = [...dismissed, data.id];
    setDismissed(next);
    try {
      window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next.slice(-20)));
    } catch {
      // Per-browser convenience only.
    }
  };

  const crawlingSite = (s: AutopilotRun["sites"][number]) => s.crawl === "PENDING" || s.crawl === "RUNNING";
  const stepState = (step: number): StepState => {
    const order = { FIND_COMPETITORS: 1, CONFIRM: 2, CRAWL_SITES: 3, REPORT: 4, DONE: 5, SETUP: 0 }[data.step];
    if (data.status === "DONE") return "done";
    if (step < order) return "done";
    if (step === order) return data.status === "AWAITING_CONFIRMATION" ? "waiting" : "active";
    return "todo";
  };
  const own = data.sites.find((s) => s.role === "you");

  const steps: Array<{ label: string; detail?: React.ReactNode }> = [
    {
      label: "Set up your website",
      detail: own ? (crawlingSite(own) ? `Reading ${data.domain}: ${own.pagesCrawled} pages so far` : `${data.domain}: ${own.pagesCrawled} pages read`) : data.domain,
    },
    { label: "Find your competitors" },
    { label: `Pick ${PICK_MIN} or ${PICK_MAX} competitors` },
    {
      label: "Read their websites",
      detail:
        data.competitors.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {data.sites
              .filter((s) => s.role === "competitor")
              .map((s) => (
                <li key={s.domain} className="flex items-center gap-1.5">
                  {crawlingSite(s) ? <Loader2 size={10} className="animate-spin" /> : s.crawl === "FAILED" ? <X size={10} /> : <Check size={10} />}
                  {s.name}: {crawlingSite(s) ? `reading… ${s.pagesCrawled} pages` : s.crawl === "FAILED" ? "couldn't be read" : `${s.pagesCrawled} pages read`}
                </li>
              ))}
          </ul>
        ) : undefined,
    },
    { label: "Write your full report" },
  ];

  return (
    <div className="fixed bottom-5 left-5 z-40 w-[380px] max-w-[calc(100vw-2.5rem)] rounded-2xl border bg-white shadow-xl md:left-[252px]" role="region" aria-label="Autopilot">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles size={14} className="text-primary-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-brand-950">Autopilot · {data.domain}</p>
          <p className="text-[11px] text-brand-500">
            {data.status === "DONE"
              ? "Finished. Your report is ready."
              : data.status === "FAILED"
                ? "Stopped."
                : "Working automatically. You can keep using the app."}
          </p>
        </div>
        <button type="button" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand" : "Collapse"} className="rounded p-1 text-brand-400 hover:bg-brand-100">
          <ChevronDown size={14} className={collapsed ? "rotate-180" : ""} />
        </button>
        {!ACTIVE.includes(data.status) && (
          <button type="button" onClick={dismiss} aria-label="Close" className="rounded p-1 text-brand-400 hover:bg-brand-100">
            <X size={14} />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          <ol className="space-y-2">
            {steps.map((step, i) => {
              const st = stepState(i);
              return (
                <li key={step.label} className="flex gap-2.5">
                  <span className="mt-0.5">
                    {st === "done" ? (
                      <Check size={14} className="text-success-600" />
                    ) : st === "active" ? (
                      <Loader2 size={14} className="animate-spin text-primary-600" />
                    ) : st === "waiting" ? (
                      <Circle size={14} className="fill-warning-500 text-warning-500" />
                    ) : (
                      <Circle size={14} className="text-brand-300" />
                    )}
                  </span>
                  <div className="min-w-0 text-[12px]">
                    <p className={st === "todo" ? "text-brand-400" : "font-medium text-brand-950"}>{step.label}</p>
                    {step.detail && <div className="text-[11px] text-brand-500">{step.detail}</div>}
                  </div>
                </li>
              );
            })}
          </ol>

          {data.status === "AWAITING_CONFIRMATION" && (
            <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50 p-3">
              <p className="text-[12.5px] font-semibold text-brand-950">
                {data.suggestions.length
                  ? `We found ${data.suggestions.length} likely competitor${data.suggestions.length === 1 ? "" : "s"}. Pick ${PICK_MIN} or ${PICK_MAX}.`
                  : "Tell us who your competitors are"}
              </p>
              <p className="mt-0.5 text-[11px] text-brand-600">
                Choose the ones you really compete with. We&apos;ll read their websites and compare them with yours.
              </p>
              {finders.length === 1 && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-primary-700">
                  <Sparkles size={10} /> Suggested by {finders[0]} after your website audit
                </p>
              )}
              <ul className="mt-2 space-y-1">
                {data.suggestions.map((s) => {
                  const on = selected.has(s.domain);
                  const locked = !on && full;
                  return (
                    <li key={s.domain}>
                      <label
                        className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[12px] transition-colors ${
                          on ? "border-primary-300 bg-white" : "border-transparent"
                        } ${locked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-white"}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-primary-600"
                          checked={on}
                          disabled={locked}
                          onChange={() => toggle(s.domain)}
                        />
                        <span className="min-w-0">
                          <span className="font-medium text-brand-950">{s.name}</span>{" "}
                          <span className="text-brand-400">{s.domain}</span>
                          {s.reason && <span className="block text-[11px] text-brand-500">{s.reason}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
                {extras.map((d) => (
                  <li key={d}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary-300 bg-white px-2.5 py-2 text-[12px]">
                      <input type="checkbox" className="accent-primary-600" checked onChange={() => toggle(d)} />
                      <span className="font-medium text-brand-950">{d}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <input
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addExtra()}
                  placeholder={full ? `You've picked ${PICK_MAX}` : "Missing one? Add its website"}
                  aria-label="Add a competitor website"
                  disabled={full}
                  className="min-w-0 flex-1 rounded-lg border bg-white px-2.5 py-1.5 text-[12px] text-brand-950 disabled:opacity-60"
                />
                <ActionButton icon={<Plus size={12} />} onClick={addExtra} disabled={full}>
                  Add
                </ActionButton>
              </div>
              {confirm.error && <p className="mt-2 text-[11px] text-error-600">{(confirm.error as Error).message}</p>}
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-brand-600" aria-live="polite">
                  {selected.size} of {PICK_MAX} picked
                </span>
                <ActionButton variant="primary" disabled={!canConfirm || confirm.isPending} onClick={() => confirm.mutate([...selected])}>
                  {confirm.isPending
                    ? "Starting…"
                    : selected.size === 0
                      ? `Pick ${pickMin === 1 ? "one" : `at least ${pickMin}`}`
                      : `Track ${selected.size === 1 ? "this competitor" : `these ${selected.size}`}`}
                </ActionButton>
              </div>
            </div>
          )}

          {data.status === "DONE" && (
            <div className="mt-3 flex justify-end">
              <ActionButton variant="primary" onClick={openReport}>
                Open your report
              </ActionButton>
            </div>
          )}

          {data.log.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[11px] text-brand-400">What I&apos;ve done ({data.log.length})</summary>
              <ul className="mt-1 space-y-0.5 text-[11px] text-brand-500">
                {data.log.map((l, i) => (
                  <li key={i}>{l.message}</li>
                ))}
              </ul>
            </details>
          )}

          {ACTIVE.includes(data.status) && (
            <button type="button" onClick={() => cancel.mutate()} className="mt-2 text-[11px] text-brand-400 hover:text-error-600">
              Stop autopilot
            </button>
          )}
        </div>
      )}
    </div>
  );
}
