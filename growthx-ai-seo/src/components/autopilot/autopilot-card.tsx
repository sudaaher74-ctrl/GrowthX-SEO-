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
    refetchInterval: (q) => (q.state.data && ACTIVE.includes(q.state.data.status) ? 5000 : false),
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
          ? `I found ${listNames(data.suggestions.map((s) => s.name))}. Are these your competitors? Say yes, or tell me which to remove or add.`
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

  const selected = chosen ?? new Set(data.suggestions.map((s) => s.domain));
  const toggle = (domain: string) => {
    const next = new Set(selected);
    if (next.has(domain)) next.delete(domain);
    else next.add(domain);
    setChosen(next);
  };
  const addExtra = () => {
    const d = extra.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return;
    setChosen(new Set([...selected, d]));
    setExtra("");
  };
  const extras = [...selected].filter((d) => !data.suggestions.some((s) => s.domain === d));

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
    { label: "Confirm your competitors" },
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
        <Sparkles size={14} className="text-brand-950" />
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
                      <Loader2 size={14} className="animate-spin text-brand-950" />
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
            <div className="mt-3 rounded-xl border bg-brand-50 p-3">
              <p className="text-[12px] font-semibold text-brand-950">Are these your competitors?</p>
              <p className="text-[11px] text-brand-500">Untick any that aren&apos;t, add any we missed, then confirm. Or just say &quot;yes&quot; to Nexa.</p>
              <ul className="mt-2 space-y-1.5">
                {data.suggestions.map((s) => (
                  <li key={s.domain}>
                    <label className="flex cursor-pointer items-start gap-2 text-[12px]">
                      <input type="checkbox" className="mt-0.5" checked={selected.has(s.domain)} onChange={() => toggle(s.domain)} />
                      <span>
                        <span className="font-medium text-brand-950">{s.name}</span> <span className="text-brand-400">{s.domain}</span>
                        {s.reason && <span className="block text-[11px] text-brand-500">{s.reason}</span>}
                      </span>
                    </label>
                  </li>
                ))}
                {extras.map((d) => (
                  <li key={d}>
                    <label className="flex cursor-pointer items-center gap-2 text-[12px]">
                      <input type="checkbox" checked onChange={() => toggle(d)} />
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
                  placeholder="Add a competitor website"
                  aria-label="Add a competitor website"
                  className="min-w-0 flex-1 rounded-lg border bg-white px-2.5 py-1.5 text-[12px] text-brand-950"
                />
                <ActionButton icon={<Plus size={12} />} onClick={addExtra}>
                  Add
                </ActionButton>
              </div>
              {confirm.error && <p className="mt-2 text-[11px] text-error-600">{(confirm.error as Error).message}</p>}
              <div className="mt-3 flex justify-end">
                <ActionButton variant="primary" disabled={selected.size === 0 || confirm.isPending} onClick={() => confirm.mutate([...selected])}>
                  {confirm.isPending ? "Starting…" : "Yes, these are my competitors"}
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
