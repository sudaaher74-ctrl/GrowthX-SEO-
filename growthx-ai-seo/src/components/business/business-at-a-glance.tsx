"use client";

import { Layers, ShoppingBag, Store, Zap } from "lucide-react";
import { useBusinessCompetitorCatalogs, useBusinessGaps, useBusinessMyCatalog, useStagedFixItems } from "@/hooks/use-growthx";
import { cn } from "@/lib/utils";

type TabId = "catalog-you" | "catalog-them" | "gaps" | "marketing" | "plans";

/**
 * The four numbers a business owner asks first, above every Business tab,
 * each opening the tab that explains it. Counted from the same queries the
 * tabs use, so a tile and its tab can never disagree.
 */
export function BusinessAtAGlance({ projectId, onOpenTab }: { projectId: string; onOpenTab: (tab: TabId) => void }) {
  const mine = useBusinessMyCatalog(projectId || null);
  const theirs = useBusinessCompetitorCatalogs(projectId || null);
  const gaps = useBusinessGaps(projectId || null);
  const plans = useStagedFixItems(projectId || null).filter((i) => i.category === "Business");

  const myProducts = mine.data?.products ?? [];
  const competitors = theirs.data ?? [];
  const theirProducts = competitors.reduce((s, c) => s + c.products.length, 0);
  const gapItems = gaps.data ?? [];
  const todo = plans.filter((p) => p.status !== "EXECUTED").length;

  const tiles: Array<{ tab: TabId; icon: React.ElementType; label: string; value: string; sub: string; loading: boolean }> = [
    {
      tab: "catalog-you",
      icon: ShoppingBag,
      label: "Your products",
      value: myProducts.length.toLocaleString(),
      sub: `${myProducts.filter((p) => p.priceStatus === "FOUND").length} show a price`,
      loading: mine.isLoading,
    },
    {
      tab: "catalog-them",
      icon: Store,
      label: "Their products",
      value: theirProducts.toLocaleString(),
      sub: `across ${competitors.length} competitor${competitors.length === 1 ? "" : "s"}`,
      loading: theirs.isLoading,
    },
    {
      tab: "gaps",
      icon: Layers,
      label: "Gaps found",
      value: gapItems.length.toLocaleString(),
      sub: gapItems.length ? "categories and prices to act on" : "nothing to act on yet",
      loading: gaps.isLoading,
    },
    {
      tab: "plans",
      icon: Zap,
      label: "Your plans",
      value: todo.toLocaleString(),
      sub: `to do · ${plans.length - todo} done`,
      loading: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.tab}
            type="button"
            onClick={() => onOpenTab(t.tab)}
            className="group flex items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-card transition-colors hover:border-primary-200 hover:bg-primary-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 group-hover:bg-white">
              <Icon size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-brand-400">{t.label}</span>
              <span className={cn("block font-mono text-[22px] font-bold leading-tight text-brand-950", t.loading && "text-brand-300")}>
                {t.loading ? "…" : t.value}
              </span>
              <span className="block truncate text-[11px] text-brand-500">{t.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
