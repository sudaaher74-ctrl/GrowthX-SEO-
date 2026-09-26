"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Home, Layers, ShoppingBag, Store, Target, Zap } from "lucide-react";
import { usePortfolio, useWorkspace } from "@/hooks/use-growthx";
import { CatalogYouTab } from "@/components/business/catalog-you-tab";
import { CatalogThemTab } from "@/components/business/catalog-them-tab";
import { GapsTab } from "@/components/business/gaps-tab";
import { MarketingSignalsTab } from "@/components/business/marketing-signals-tab";
import { PlansTab } from "@/components/business/plans-tab";

/**
 * Business (Products Intelligence). Mirrors Competitor Intelligence's own
 * ?tab= pattern exactly: state mirrors the URL, pushed back via
 * history.replaceState rather than router.replace (whose transition does not
 * commit reliably on this page — see the Competitor Intelligence page for
 * the same note).
 */
const TABS = [
  { id: "catalog-you", label: "Catalog (You)", icon: ShoppingBag },
  { id: "catalog-them", label: "Catalog (Them)", icon: Store },
  { id: "gaps", label: "Gaps", icon: Layers },
  { id: "marketing", label: "Marketing Signals", icon: Target },
  { id: "plans", label: "Your Plans", icon: Zap },
];

const DEFAULT_TAB = "catalog-you";

export default function BusinessPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-brand-500">Loading Business...</div>}>
      <BusinessClient />
    </Suspense>
  );
}

function BusinessClient() {
  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const customerDomain = clientRow?.domain || "";
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const rawTab = searchParams.get("tab") || DEFAULT_TAB;
  const initialTab = TABS.some((t) => t.id === rawTab) ? rawTab : DEFAULT_TAB;

  const [activeTab, setActiveTabState] = useState<string>(initialTab);
  const lastTabRef = useRef(activeTab);

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw && TABS.some((t) => t.id === raw) && raw !== lastTabRef.current) {
      lastTabRef.current = raw;
      setActiveTabState(raw);
    }
  }, [searchParams]);

  const setActiveTab = (id: string) => {
    lastTabRef.current = id;
    setActiveTabState(id);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", id);
      const targetUrl = `${pathname}?${params.toString()}`;
      // Not router.replace: see Competitor Intelligence's page.tsx for why.
      window.history.replaceState(null, "", targetUrl);
    } catch {
      // ignore
    }
  };

  const currentTabObj = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="space-y-6 pb-12">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-500">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-brand-950 transition">
            <Home className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>
          <span>/</span>
          <Link href="/business" className="hover:text-brand-950 transition">
            Business
          </Link>
          <span>/</span>
          <span className="text-brand-950 font-bold">{currentTabObj.label}</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-line">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-accent-600 text-white shadow-xs"
                    : "text-brand-600 hover:text-brand-950 hover:bg-brand-100 font-semibold"
                }`}
              >
                <Icon size={14} className={isActive ? "text-white" : "text-brand-400"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "catalog-you" && <CatalogYouTab projectId={projectId || ""} />}
      {activeTab === "catalog-them" && <CatalogThemTab projectId={projectId || ""} />}
      {activeTab === "gaps" && <GapsTab projectId={projectId || ""} domain={customerDomain} />}
      {activeTab === "marketing" && <MarketingSignalsTab projectId={projectId || ""} />}
      {activeTab === "plans" && <PlansTab projectId={projectId || ""} onOpenTab={(tab) => setActiveTab(tab)} />}
    </div>
  );
}
