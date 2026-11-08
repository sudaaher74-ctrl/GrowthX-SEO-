"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { PageHeader, Panel, ActionButton } from "@/components/ui/console";
import { AdaptiveResultsHub } from "@/components/fix-engine/adaptive-results-hub";
import { useWorkspace } from "@/hooks/use-growthx";

export default function FixChangesPage() {
  const { projectId } = useWorkspace();

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center gap-2">
        <Link
          href="/fix-engine"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-700 hover:underline"
        >
          <ArrowLeft size={13} /> Back to Fix Engine
        </Link>
      </div>

      <PageHeader
        title="Impact & Results Ledger"
        subtitle="The closed-loop results engine: observe real Google Search Console & AI citation lift for every deployed change, diagnose flat performance, and auto-pivot to alternative methods until results are delivered."
      />

      <Panel title="How the Closed Loop works" padded>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs text-brand-600">
          <div className="space-y-1">
            <p className="font-bold text-brand-950">1. Verification Live</p>
            <p>Every merged fix is crawled and confirmed directly in your website HTML before observation begins.</p>
          </div>
          <div className="space-y-1">
            <p className="font-bold text-brand-950">2. 21-Day Observation</p>
            <p>We monitor Search Console clicks, impressions, and AI search citations (Perplexity, SearchGPT, Gemini) to measure lift.</p>
          </div>
          <div className="space-y-1">
            <p className="font-bold text-brand-950">3. Autonomous Pivot (Plan B)</p>
            <p>If a fix produces zero lift after observation, Reigel diagnoses the root cause and prepares an alternative strategy (Plan B) PR.</p>
          </div>
        </div>
      </Panel>

      {!projectId ? (
        <Panel padded>Select a workspace to see its results ledger.</Panel>
      ) : (
        <AdaptiveResultsHub />
      )}
    </div>
  );
}
