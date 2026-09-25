"use client";

import { useState } from "react";
import { Check, ChevronDown, CircleCheck, Copy, RotateCcw, Trash2 } from "lucide-react";
import { ActionButton, Panel, relativeTime } from "@/components/ui/console";
import { useStagedFixItems } from "@/hooks/use-growthx";
import { stagingEngine, type StagedFixItem } from "@/lib/staging-engine";

/**
 * Your Plans: every plan saved from Battleground, Gaps and Rival Radar, as a
 * simple to-do list. Saved in this browser; nothing is changed on the site.
 */
export function CounterMoveDrafts({
  projectId,
  onOpenTab,
}: {
  projectId: string;
  onOpenTab: (tab: "battleground" | "gaps" | "radar") => void;
}) {
  const items = useStagedFixItems(projectId || null).filter((i) => i.category === "Competitor Intelligence");
  const todo = items.filter((i) => i.status !== "EXECUTED");
  const done = items.filter((i) => i.status === "EXECUTED");

  return (
    <div className="space-y-4">
      <Panel
        title="Your plans"
        subtitle="Every plan you save from Battleground, Gaps and Rival Radar lands here. Open one, follow the steps (or send them to whoever edits your website), then mark it done."
        padded
      >
        {items.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-[12.5px] text-brand-600">
              No plans yet. Open one of these tabs and click <span className="font-semibold">Get a plan</span> on anything
              you want to act on:
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <ActionButton onClick={() => onOpenTab("battleground")}>Battleground: what to do this week</ActionButton>
              <ActionButton onClick={() => onOpenTab("gaps")}>Gaps: what they have that you don&apos;t</ActionButton>
              <ActionButton onClick={() => onOpenTab("radar")}>Rival Radar: what they changed</ActionButton>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-brand-500">
            {todo.length} to do · {done.length} done
          </p>
        )}
      </Panel>

      {todo.length > 0 && (
        <Panel title={`To do (${todo.length})`} padded>
          <ul className="space-y-2">
            {todo.map((item) => (
              <PlanRow key={item.id} item={item} projectId={projectId} />
            ))}
          </ul>
        </Panel>
      )}

      {done.length > 0 && (
        <Panel title={`Done (${done.length})`} subtitle="Run Website Audit again after changing your website so the other tabs catch up." padded>
          <ul className="space-y-2">
            {done.map((item) => (
              <PlanRow key={item.id} item={item} projectId={projectId} />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function PlanRow({ item, projectId }: { item: StagedFixItem; projectId: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDone = item.status === "EXECUTED";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.deliverable);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <li className="rounded-xl border">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown size={14} className={`shrink-0 text-brand-400 transition-transform ${open ? "rotate-180" : ""}`} />
          <span className="min-w-0">
            <span className={`block truncate text-[12.5px] font-semibold ${isDone ? "text-brand-400 line-through" : "text-brand-950"}`}>
              {item.title}
            </span>
            <span className="block text-[11px] text-brand-400">
              Saved {relativeTime(item.stagedAt)}
              {item.priority === "HIGH" || item.priority === "CRITICAL" ? " · important" : ""}
            </span>
          </span>
        </button>
        <ActionButton icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={copy}>
          {copied ? "Copied" : "Copy plan"}
        </ActionButton>
        {isDone ? (
          <ActionButton icon={<RotateCcw size={13} />} onClick={() => stagingEngine.setStatus(projectId, item.id, "STAGED")}>
            Not done
          </ActionButton>
        ) : (
          <ActionButton
            variant="primary"
            icon={<CircleCheck size={13} />}
            onClick={() => stagingEngine.setStatus(projectId, item.id, "EXECUTED")}
          >
            Mark done
          </ActionButton>
        )}
        <button
          type="button"
          aria-label="Remove plan"
          onClick={() => stagingEngine.remove(projectId, item.id)}
          className="rounded-lg p-1.5 text-brand-400 hover:bg-brand-100 hover:text-error-600"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {open && (
        <div className="border-t px-4 py-3">
          <PlanText text={item.deliverable} />
        </div>
      )}
    </li>
  );
}

/** A saved plan's Markdown, shown as readable text rather than symbols. */
function PlanText({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-[12.5px] leading-relaxed text-brand-950">
      {text.split("\n").map((line, i) => {
        const h = /^#{1,3}\s+(.*)$/.exec(line);
        if (h) {
          return (
            <p key={i} className={i === 0 ? "text-[13px] font-semibold" : "pt-2 text-[11px] font-semibold uppercase tracking-wide text-brand-400"}>
              {h[1]}
            </p>
          );
        }
        if (/^```/.test(line)) return null;
        if (!line.trim()) return null;
        return (
          <p key={i} className={/^\d+\.\s/.test(line) ? "pl-2" : "text-brand-600"}>
            {line.replace(/^-\s+/, "• ")}
          </p>
        );
      })}
    </div>
  );
}
