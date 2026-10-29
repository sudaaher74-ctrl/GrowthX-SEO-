"use client";

import { useState } from "react";
import { Check, Copy, Wrench, X } from "lucide-react";
import { ActionButton, Panel, Pill, StatusNote } from "@/components/ui/console";

interface GapPlanModalProps {
  businessName: string;
  competitor: { domain: string; name: string; count: number };
  promptText: string;
  priority: string;
  onClose: () => void;
  onSaveToFixEngine: (plan: string) => Promise<void>;
}

/** A review proposal grounded only in references held by the caller. */
export function GapPlanModal({ businessName, competitor, promptText, priority, onClose, onSaveToFixEngine }: GapPlanModalProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = competitor.name || competitor.domain;
  const steps = [
    `Inspect the saved answer for "${promptText}" and verify what it says about ${name} and ${businessName}.`,
    "Compare the actual source pages and crawl evidence before proposing content or structured-data changes. Confirm all business facts before publishing.",
    "Record a baseline and repeat the same prompt checks after an approved change. Treat any explanation of the assistant's choice as a hypothesis until supported by evidence.",
  ];
  const plan = `# AI visibility review: ${name}\n\nPrompt: ${promptText}\nPriority: ${priority}\nSaved mention or citation references: ${competitor.count}\nWebsite address: ${competitor.domain || "Not verified"}\n\nThe references do not establish why an assistant selected this business, its website quality, or the impact of a proposed change.\n\n${steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}`;

  async function save() {
    setSaving(true);
    setError(null);
    try { await onSaveToFixEngine(plan); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The task could not be saved. Please retry."); }
    finally { setSaving(false); }
  }

  return <div role="dialog" aria-modal="true" aria-label={`AI Strategy Plan for ${name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/60 p-4" onClick={() => { if (!saving) onClose(); }}>
    <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto" onClick={event => event.stopPropagation()}>
      <Panel padded title={`Review plan: ${name}`} actions={<ActionButton aria-label="Close" disabled={saving} onClick={onClose} icon={<X size={14} />}>Close</ActionButton>}>
        <div className="space-y-4">
          <p className="text-sm text-brand-700">Prompt: {promptText}</p>
          <div className="flex flex-wrap gap-2"><Pill>{priority} priority</Pill><Pill>{competitor.count} saved references</Pill></div>
          <p className="text-xs text-brand-500">Website address: {competitor.domain || "Not verified"}</p>
          <StatusNote>The saved references do not establish why an assistant chose this business or what performance improvement a change will produce. These are proposed review steps.</StatusNote>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-brand-700">{steps.map(step => <li key={step}>{step}</li>)}</ol>
          {error && <StatusNote tone="bad">{error}</StatusNote>}
          <div className="flex flex-wrap justify-end gap-2">
            <ActionButton icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={async () => {
              try { await navigator.clipboard.writeText(plan); setCopied(true); }
              catch { setError("The plan could not be copied."); }
            }}>{copied ? "Plan copied" : "Copy plan"}</ActionButton>
            <ActionButton disabled={saving} icon={<Wrench size={14} />} onClick={() => void save()}>{saving ? "Saving task…" : "Send review task to Fix Engine"}</ActionButton>
          </div>
        </div>
      </Panel>
    </div>
  </div>;
}
