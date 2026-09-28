"use client";

import { useState } from "react";
import { Boxes, Globe2, LayoutGrid, Sparkles, Tag } from "lucide-react";
import { PlanModal } from "@/components/competitor/plan-modal";
import { ActionButton, PageHeader, Panel, Pill } from "@/components/ui/console";
import { TimedQueryState } from "@/components/ui/timed-query-state";
import { useBusinessGaps } from "@/hooks/use-growthx";
import type { CategoryGapItem } from "@/lib/api-client";
import { buildCategoryGapPlan } from "@/lib/business-gaps-plain";
import { stagingEngine } from "@/lib/staging-engine";
import { cn } from "@/lib/utils";

type Kind = CategoryGapItem["kind"];

const KIND: Record<Kind, { label: string; plural: string; tone: "bad" | "warn" | "info" | "default"; icon: React.ElementType; iconClass: string }> = {
  MISSING_CATEGORY: { label: "Products they sell, you don't", plural: "Products you don't sell", tone: "bad", icon: LayoutGrid, iconClass: "bg-error-50 text-error-600" },
  PRICE_DELTA: { label: "Price difference", plural: "Price differences", tone: "warn", icon: Tag, iconClass: "bg-warning-50 text-warning-600" },
  PRICE_INCOMPARABLE: { label: "Different currency", plural: "Different currency", tone: "default", icon: Globe2, iconClass: "bg-brand-100 text-brand-600" },
  STOCK_TRANSPARENCY: { label: "They show stock, you don't", plural: "Stock shown", tone: "info", icon: Boxes, iconClass: "bg-accent-50 text-accent-600" },
};
const KIND_ORDER: Kind[] = ["MISSING_CATEGORY", "PRICE_DELTA", "STOCK_TRANSPARENCY", "PRICE_INCOMPARABLE"];

/**
 * Gaps: category-level comparison between your products and each
 * competitor's. v1 is category matching only — product-level fuzzy/SKU
 * matching is a v2 problem. Same "what to do about it" action-item format
 * Battleground uses.
 */
export function GapsTab({ projectId, domain }: { projectId: string; domain: string }) {
  const query = useBusinessGaps(projectId || null);
  const items = query.data ?? [];
  const [planFor, setPlanFor] = useState<CategoryGapItem | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);

  const counts = new Map<Kind, number>();
  for (const i of items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
  const shown = kind ? items.filter((i) => i.kind === kind) : items;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gaps"
        subtitle="Where your products, prices and stock information fall behind each competitor's, category by category."
      />

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {KIND_ORDER.map((k) => {
            const Icon = KIND[k].icon;
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(active ? null : k)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-white p-3.5 text-left shadow-card transition-colors",
                  active ? "border-primary-600 ring-1 ring-primary-600" : "hover:border-primary-200 hover:bg-primary-50",
                )}
              >
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", KIND[k].iconClass)}>
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-[20px] font-bold leading-tight text-brand-950">{counts.get(k) ?? 0}</span>
                  <span className="block truncate text-[11.5px] text-brand-500">{KIND[k].plural}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <TimedQueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={items.length === 0}
        emptyTitle="No gaps found yet"
        emptyBody="Gaps appear once both your products and a competitor's have been found, and they sell in the same categories."
        onRetry={() => query.refetch()}
      >
        <Panel
          title={kind ? KIND[kind].plural : "All gaps"}
          subtitle={`${shown.length} to act on, biggest first${kind ? " · click the tile again to show all" : ""}`}
        >
          <ul className="divide-y">
            {shown.map((item) => {
              const Icon = KIND[item.kind].icon;
              return (
                <li key={item.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", KIND[item.kind].iconClass)}>
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill tone={KIND[item.kind].tone}>{KIND[item.kind].label}</Pill>
                      <Pill>{item.category}</Pill>
                      <span className="text-[11px] text-brand-400">vs {item.competitorLabel}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] font-semibold text-brand-950">{item.headline}</p>
                    <p className="mt-0.5 text-[12px] text-brand-500">{item.why}</p>
                    {item.steps[0] && (
                      <p className="mt-1.5 text-[12px] text-brand-700">
                        <span className="font-semibold text-success-700">First step: </span>
                        {item.steps[0]}
                      </p>
                    )}
                  </div>
                  <ActionButton variant="primary" icon={<Sparkles size={13} />} onClick={() => setPlanFor(item)}>
                    Get a plan
                  </ActionButton>
                </li>
              );
            })}
          </ul>
        </Panel>
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
