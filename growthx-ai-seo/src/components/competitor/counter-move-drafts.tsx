"use client";

import { useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { ActionButton, Panel, Pill, relativeTime } from "@/components/ui/console";
import { useStagedFixItems } from "@/hooks/use-growthx";
import { stagingEngine } from "@/lib/staging-engine";

/**
 * Counter-moves saved from Battleground (and staged from the other tabs).
 *
 * Only the Draft stage exists yet. Approved → Shipped → Verified needs the
 * re-crawl verification jobs, so those columns are not drawn empty.
 */
export function CounterMoveDrafts({ projectId }: { projectId: string }) {
  const items = useStagedFixItems(projectId || null).filter((i) => i.category === "Competitor Intelligence");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <Panel
      title={`Drafts (${items.length})`}
      subtitle="Saved in this browser. Copy a brief to hand it over; nothing is changed on your site."
      padded
    >
      {items.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-brand-500">
          No drafts yet. Press Counter on a move in Battleground to write one.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-brand-950">{item.title}</p>
                <p className="text-[11px] text-brand-400">
                  Saved {relativeTime(item.stagedAt)}
                  {item.evidence ? ` · ${item.evidence}` : ""}
                </p>
              </div>
              <Pill tone={item.priority === "HIGH" || item.priority === "CRITICAL" ? "warn" : "default"}>
                {item.priority.toLowerCase()}
              </Pill>
              <ActionButton
                icon={copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                onClick={() => copy(item.id, item.deliverable)}
              >
                {copiedId === item.id ? "Copied" : "Copy brief"}
              </ActionButton>
              <button
                type="button"
                aria-label="Remove draft"
                onClick={() => stagingEngine.remove(projectId, item.id)}
                className="rounded-lg p-1.5 text-brand-400 hover:bg-brand-100 hover:text-error-600"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
