"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/console";
import { PlanView } from "@/components/fix-engine/plan-view";
import { EngineerPanel, RunsPanel } from "@/components/fix-engine/engineer-panel";
import { ShipPanel } from "@/components/fix-engine/ship-panel";

/**
 * Fix Engine: the improvement plan drawn from every tab of the workflow.
 *
 * The earlier screen was switched off because it marked fixes "Applied &
 * Verified" on a timer without touching or re-checking the site. This one only
 * shows real findings, prepares low-risk fixes as a pull request you review and
 * merge, and never publishes anything itself. Confirming a fix by re-checking
 * the site after it is merged is a separate step.
 */
export default function FixEnginePage() {
  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="Fix Engine"
        subtitle="Everything found across your website, Google, competitors, AI visibility and Business Profile, ranked, with what to do about it."
        actions={
          <Link
            href="/reports/plan"
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/50 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-950 hover:bg-brand-100 transition shadow-2xs"
          >
            Download full report
          </Link>
        }
      />
      <ShipPanel />
      <Link href="/fix-engine/changes" className="inline-flex rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">Changes &amp; proof — see before and after</Link>
      <EngineerPanel />
      <RunsPanel />
      <PlanView />
    </div>
  );
}
