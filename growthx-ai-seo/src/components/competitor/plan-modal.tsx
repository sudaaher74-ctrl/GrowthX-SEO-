"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { ActionButton, Panel } from "@/components/ui/console";

/**
 * The plan behind every "Get a plan" button in Competitor Intelligence: why
 * it matters, the steps, and a copy that can be handed to whoever edits the
 * website. Nothing is changed on the site.
 */
export function PlanModal({
  subtitle,
  why,
  steps,
  plan,
  onClose,
  onSave,
}: {
  subtitle: string;
  why: string;
  steps: string[];
  plan: string;
  onClose: () => void;
  onSave: (plan: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plan);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Plan"
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/40 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <Panel
          title="Your plan"
          subtitle={subtitle}
          actions={
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-brand-400 hover:bg-brand-100">
              <X size={16} />
            </button>
          }
          padded
        >
          <div className="max-h-[55vh] space-y-3 overflow-auto">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">Why this matters</p>
              <p className="mt-1 text-[12.5px] text-brand-950">{why}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">What to do</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-[12.5px] text-brand-950">
                {steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
            <p className="text-[11px] text-brand-500">
              Nothing is changed on your website. Do these steps yourself, or copy the plan and send it to whoever edits your website.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <ActionButton icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={copy}>
              {copied ? "Copied" : "Copy plan"}
            </ActionButton>
            <ActionButton variant="primary" onClick={() => onSave(plan)}>
              Save to Your Plans
            </ActionButton>
          </div>
        </Panel>
      </div>
    </div>
  );
}
