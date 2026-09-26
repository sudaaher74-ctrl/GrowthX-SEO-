"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { PlanModal } from "@/components/competitor/plan-modal";
import { ActionButton, PageHeader, Panel, Pill } from "@/components/ui/console";
import { TimedQueryState } from "@/components/ui/timed-query-state";
import { useBusinessGaps } from "@/hooks/use-growthx";
import type { CategoryGapItem } from "@/lib/api-client";
import { buildCategoryGapPlan } from "@/lib/business-gaps-plain";
import { stagingEngine } from "@/lib/staging-engine";

const KIND_LABEL: Record<CategoryGapItem["kind"], { label: string; tone: "bad" | "warn" | "info" | "default" }> = {
  MISSING_CATEGORY: { label: "Category gap", tone: "bad" },
  PRICE_DELTA: { label: "Price delta", tone: "warn" },
  PRICE_INCOMPARABLE: { label: "Different currency", tone: "default" },
  STOCK_TRANSPARENCY: { label: "Stock transparency", tone: "info" },
};

/**
 * Gaps: category-level comparison between Catalog (You) and Catalog (Them).
 * v1 is category matching only — product-level fuzzy/SKU matching is a v2
 * problem. Same "what to do about it" action-item format Battleground uses.
 */
export function GapsTab({ projectId, domain }: { projectId: string; domain: string }) {
  const query = useBusinessGaps(projectId || null);
  const items = query.data ?? [];
  const [planFor, setPlanFor] = useState<CategoryGapItem | null>(null);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gaps"
        subtitle="Category coverage, price and stock-transparency gaps between your catalog and each competitor's."
      />

      <TimedQueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={items.length === 0}
        emptyTitle="No gaps found"
        emptyBody="Once both Catalog (You) and Catalog (Them) have crawled products, category-level gaps show up here."
        onRetry={() => query.refetch()}
      >
        <div className="space-y-3">
          {items.map((item) => (
            <Panel key={item.id} padded>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={KIND_LABEL[item.kind].tone}>{KIND_LABEL[item.kind].label}</Pill>
                    <span className="text-[11px] text-brand-400">{item.category}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] font-semibold text-brand-950">{item.headline}</p>
                  <p className="mt-1 text-[12px] text-brand-500">{item.why}</p>
                </div>
                <ActionButton variant="primary" icon={<Sparkles size={13} />} onClick={() => setPlanFor(item)}>
                  Get a plan
                </ActionButton>
              </div>
            </Panel>
          ))}
        </div>
      </TimedQueryState>

      {planFor && (
        <PlanModal
          subtitle={`${planFor.competitorLabel} · ${planFor.category}`}
          why={planFor.why}
          steps={planFor.steps}
          plan={buildCategoryGapPlan(planFor, { domain })}
          onClose={() => setPlanFor(null)}
          onSave={(plan) => {
            stagingEngine.stage(projectId, {
              title: planFor.headline,
              category: "Business",
              source: "BUSINESS_CATALOG_GAP",
              priority: planFor.kind === "MISSING_CATEGORY" ? "HIGH" : "MEDIUM",
              impact: planFor.why,
              effortHours: 2,
              deliverable: plan,
              evidence: `${planFor.competitorLabel} · counted from both catalogs`,
            });
            setPlanFor(null);
          }}
        />
      )}
    </div>
  );
}
