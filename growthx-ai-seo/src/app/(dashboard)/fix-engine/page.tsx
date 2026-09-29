"use client";

import { PageHeader } from "@/components/ui/console";
import { PlanView } from "@/components/fix-engine/plan-view";

/**
 * Fix Engine: the improvement plan drawn from every tab of the workflow.
 *
 * The earlier screen was switched off because it marked fixes "Applied &
 * Verified" on a timer without touching or re-checking the site. This one only
 * shows real findings and records your decisions. Applying a change, and
 * confirming it by re-checking the site, is added in separate steps.
 */
export default function FixEnginePage() {
  return (
    <div className="space-y-4 pb-12">
      <PageHeader title="Fix Engine" subtitle="Everything found across your website, Google, competitors, AI visibility and Business Profile, ranked, with what to do about it." />
      <PlanView />
    </div>
  );
}
