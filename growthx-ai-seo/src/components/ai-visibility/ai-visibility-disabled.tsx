"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/console";

/**
 * AI Visibility is switched off for now, the same way Fix Engine and Design
 * Studio are. The screens are kept in the codebase so it can be switched back
 * on by pointing the pages at them again.
 */
export function AiVisibilityDisabled() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <PageHeader title="AI Visibility" subtitle="How often AI assistants recommend your business." />
      <Panel padded>
        <div className="mx-auto max-w-md space-y-4 px-6 py-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <Sparkles size={24} />
          </div>
          <h3 className="text-base font-bold text-brand-950">AI Visibility is disabled</h3>
          <p className="text-xs leading-relaxed text-brand-600">
            This part of GrowthX is switched off for now. Competitor Intelligence and Website Audit work as usual.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-900"
            >
              <ArrowLeft size={13} /> Back to dashboard
            </Link>
          </div>
        </div>
      </Panel>
    </div>
  );
}
