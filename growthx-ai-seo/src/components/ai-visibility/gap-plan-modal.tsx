"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  HelpCircle,
  Lightbulb,
  Sparkles,
  Target,
  Wrench,
  X,
} from "lucide-react";
import { ActionButton, Pill } from "@/components/ui/console";
import { cn } from "@/lib/utils";

export interface GapPlanModalProps {
  businessName: string;
  competitor: {
    domain: string;
    name: string;
    count: number;
  };
  promptText: string;
  priority: string;
  onClose: () => void;
  onSaveToFixEngine?: (message: string) => void;
}

/**
 * GapPlanModal
 *
 * Generated strategic AI recovery plan explaining:
 * 1. Why AI models recommended the competitor
 * 2. Why your business was not recommended
 * 3. Exact tactical steps to improve, win citations, and outrank them
 */
export function GapPlanModal({
  businessName,
  competitor,
  promptText,
  priority,
  onClose,
  onSaveToFixEngine,
}: GapPlanModalProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const cleanBusiness = businessName || "Your Business";
  const cleanComp = competitor.name || competitor.domain || "Competitor";

  // Build the markdown text for clipboard export
  const fullPlanMarkdown = `# AI Visibility Recovery Plan: Outrank ${cleanComp}
## Target Prompt: "${promptText}"
## Priority: ${priority}

### 1. Why AI Recommended ${cleanComp} (${competitor.domain})
- **Topical Authority & Crawl Density**: ${cleanComp} has established domain-level recognition and dense content coverage around keywords in this prompt.
- **Dedicated Solution Pages**: They offer indexable landing pages directly answering subscription and product delivery queries with clear pricing.
- **Structured Schema Markup**: Search bots extract JSON-LD (Product, Offer, LocalBusiness) from their pages, allowing LLMs to parse availability and pricing immediately.
- **Third-Party Review Footprint**: Strong consensus across external review platforms and directories confirms their delivery reliability.

### 2. Why ${cleanBusiness} Was Not Recommended
- **Missing Target Page (Content Gap)**: ${cleanBusiness} lacks a dedicated URL or prominent H1 directly matching "${promptText}".
- **No Direct Competitor Comparison**: Search engines find no comparison asset (e.g. "${cleanBusiness} vs ${cleanComp}") positioning your value against them.
- **Entity & Local Grounding Scarcity**: Local service boundaries, delivery zones, and product details are not explicitly declared in structured JSON-LD schema.
- **Citation Scarcity**: Fewer third-party reviews and external forum citations linking ${cleanBusiness} to this specific query.

### 3. What We Have To Improve (Tactical Action Plan)
1. **Publish a High-Authority Comparison Page**:
   Create and publish \`/compare/${cleanBusiness.toLowerCase()}-vs-${cleanComp.toLowerCase()}\`. Feature a side-by-side comparison table, transparent pricing, quality benchmarks, and a direct answer in the first 120 words.
2. **Deploy JSON-LD Schema (LocalBusiness & Product)**:
   Add schema markup specifying exact delivery zones, subscription terms, and product attributes so AI search bots recognize availability.
3. **Generative Engine Optimization (GEO)**:
   Place a concise, fact-dense "Quick Summary" answering "${promptText}" at the top of your landing page for AI extractability.
4. **Citation Seeding & Local Reviews**:
   Publish authentic customer testimonials and community mentions referencing ${cleanBusiness} and ${cleanComp} together.
`;

  const copyPlan = async () => {
    try {
      await navigator.clipboard.writeText(fullPlanMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleSave = () => {
    setSaved(true);
    if (onSaveToFixEngine) {
      onSaveToFixEngine(
        `Added 4 tactical tasks to Fix Engine to outrank ${cleanComp} for "${promptText}".`,
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`AI Strategy Plan for ${cleanComp}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border border-line bg-surface-1 p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <Sparkles size={16} />
              </div>
              <h2 className="text-base font-bold text-brand-950 tracking-tight">
                AI Strategy Plan: Outrank {cleanComp}
              </h2>
            </div>
            <p className="text-xs text-brand-500">
              Prompt: <strong className="text-brand-950">&ldquo;{promptText}&rdquo;</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-brand-400 hover:bg-surface-2 hover:text-brand-950 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Competitor Overview Badge Strip */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-brand-700 font-medium">
            <Globe size={13} className="text-brand-500" />
            <span>{competitor.domain}</span>
          </span>
          <span className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-brand-700">
            Recommended in {competitor.count} prompt{competitor.count === 1 ? "" : "s"}
          </span>
          <span
            className={cn(
              "rounded-lg border px-2.5 py-1 font-semibold",
              priority === "High"
                ? "border-error-500/25 bg-error-500/10 text-error-600"
                : "border-warning-500/25 bg-warning-500/10 text-warning-700",
            )}
          >
            {priority} Priority Gap
          </span>
        </div>

        {/* 1. WHY THEY RECOMMENDED THE COMPETITOR */}
        <div className="rounded-xl border border-line bg-surface-2/50 p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-warning-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-950">
              1. Why AI recommended {cleanComp}
            </h3>
          </div>
          <p className="text-xs leading-5 text-brand-600">
            AI search engines (Gemini, Claude, Perplexity) selected {cleanComp} based on strong indexed authority and availability signals:
          </p>
          <ul className="space-y-1.5 pl-4 list-disc text-xs text-brand-600">
            <li>
              <strong className="text-brand-950">Topical Authority:</strong> Established domain entity with high relevance around keywords in this prompt.
            </li>
            <li>
              <strong className="text-brand-950">Dedicated Landing Page:</strong> Indexed catalog pages specifically matching search phrases with pricing and subscription options.
            </li>
            <li>
              <strong className="text-brand-950">Structured Schema:</strong> Clear JSON-LD markup allows AI engines to parse product availability and service terms without ambiguity.
            </li>
            <li>
              <strong className="text-brand-950">Third-Party Consensus:</strong> External citations across customer reviews and local directories confirm their service footprint.
            </li>
          </ul>
        </div>

        {/* 2. WHY YOUR BUSINESS WAS NOT RECOMMENDED */}
        <div className="rounded-xl border border-line bg-surface-2/50 p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <HelpCircle size={16} className="text-error-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-950">
              2. Why {cleanBusiness} was not recommended
            </h3>
          </div>
          <p className="text-xs leading-5 text-brand-600">
            AI models did not recommend your business due to specific content and technical gaps:
          </p>
          <ul className="space-y-1.5 pl-4 list-disc text-xs text-brand-600">
            <li>
              <strong className="text-brand-950">Content Gap:</strong> Missing a dedicated page or strong H1 headline addressing &ldquo;{promptText}&rdquo;.
            </li>
            <li>
              <strong className="text-brand-950">No Direct Comparison:</strong> No published comparison asset (e.g. {cleanBusiness} vs {cleanComp}) establishing parity or superiority.
            </li>
            <li>
              <strong className="text-brand-950">Unlinked Local Entity:</strong> Service areas, delivery terms, and subscription pricing are not explicitly indexed via structured schema.
            </li>
            <li>
              <strong className="text-brand-950">Citation Scarcity:</strong> Fewer crawled third-party mentions or customer reviews comparing your brand for this query.
            </li>
          </ul>
        </div>

        {/* 3. WHAT WE HAVE TO IMPROVE (ACTION PLAN) */}
        <div className="rounded-xl border border-line bg-surface-2/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-success-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-950">
              3. What we have to improve (Tactical Action Plan)
            </h3>
          </div>
          <p className="text-xs text-brand-600">
            Follow this 4-step tactical plan to capture AI recommendations for this prompt:
          </p>

          <div className="space-y-2.5">
            <div className="rounded-lg border border-line bg-surface-1 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-brand-950">
                  Step 1: Publish Comparison Page
                </span>
                <span className="rounded bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                  Priority 1
                </span>
              </div>
              <p className="text-brand-600">
                Publish a comparison guide: <strong className="text-brand-950">{cleanBusiness} vs {cleanComp}</strong>. Include a direct comparison table, pricing breakdown, and distinct quality differentiators.
              </p>
            </div>

            <div className="rounded-lg border border-line bg-surface-1 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-brand-950">
                  Step 2: Deploy Structured JSON-LD Schema
                </span>
                <span className="rounded bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                  Priority 2
                </span>
              </div>
              <p className="text-brand-600">
                Add <code className="rounded bg-surface-2 px-1 font-mono text-[11px]">Product</code>, <code className="rounded bg-surface-2 px-1 font-mono text-[11px]">LocalBusiness</code>, and <code className="rounded bg-surface-2 px-1 font-mono text-[11px]">FAQPage</code> schema specifying exact delivery zones and product attributes.
              </p>
            </div>

            <div className="rounded-lg border border-line bg-surface-1 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-brand-950">
                  Step 3: Optimize for Generative Engines (GEO)
                </span>
                <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-brand-600">
                  Priority 3
                </span>
              </div>
              <p className="text-brand-600">
                Format the first 120 words of your target page with direct, fact-dense bullet points answering &ldquo;{promptText}&rdquo; to maximize AI citation probability.
              </p>
            </div>

            <div className="rounded-lg border border-line bg-surface-1 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-brand-950">
                  Step 4: Seed Off-Page Citations & Reviews
                </span>
                <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-brand-600">
                  Priority 4
                </span>
              </div>
              <p className="text-brand-600">
                Acquire verified reviews mentioning {cleanBusiness} and {cleanComp} in regional directories and community discussions.
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line pt-4">
          <ActionButton
            icon={copied ? <Check size={14} /> : <Copy size={14} />}
            onClick={copyPlan}
          >
            {copied ? "Plan copied" : "Copy plan"}
          </ActionButton>

          <button
            type="button"
            onClick={handleSave}
            disabled={saved}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition shadow-xs",
              saved
                ? "bg-success-100 text-success-800 cursor-default"
                : "bg-signal-400 text-signal-ink hover:bg-signal-500",
            )}
          >
            <Wrench size={13} />
            {saved ? "Saved to Fix Engine" : "Send tasks to Fix Engine"}
          </button>
        </div>
      </div>
    </div>
  );
}
