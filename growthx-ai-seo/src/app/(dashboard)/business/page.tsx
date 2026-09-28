"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Home, Layers, ShoppingBag, Store, Target, Zap } from "lucide-react";
import { Tabs } from "@/components/ui/console";
import { usePortfolio, useWorkspace } from "@/hooks/use-growthx";
import { BusinessAtAGlance } from "@/components/business/business-at-a-glance";
import { CatalogYouTab } from "@/components/business/catalog-you-tab";
import { CatalogThemTab } from "@/components/business/catalog-them-tab";
import { GapsTab } from "@/components/business/gaps-tab";
import { MarketingStrategyTab } from "@/components/business/marketing-strategy-tab";
import { PlansTab } from "@/components/business/plans-tab";

/**
 * Business (Products Intelligence). Mirrors Competitor Intelligence's own
 * ?tab= pattern exactly: state mirrors the URL, pushed back via
 * history.replaceState rather than router.replace (whose transition does not
 * commit reliably on this page — see the Competitor Intelligence page for
 * the same note).
 *
 * The tab id "marketing" is kept for the Marketing Strategy tab so links saved
 * to the old Marketing Signals tab still land on it.
 */
type TabId = "catalog-you" | "catalog-them" | "gaps" | "marketing" | "plans";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "catalog-you", label: "Your products", icon: ShoppingBag },
  { id: "catalog-them", label: "Their products", icon: Store },
  { id: "gaps", label: "Gaps", icon: Layers },
  { id: "marketing", label: "Marketing Strategy", icon: Target },
  { id: "plans", label: "Your Plans", icon: Zap },
];

const DEFAULT_TAB: TabId = "catalog-you";
const isTab = (id: string | null): id is TabId => TABS.some((t) => t.id === id);

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

  const rawTab = searchParams.get("tab");
  const initialTab: TabId = isTab(rawTab) ? rawTab : DEFAULT_TAB;

  const [activeTab, setActiveTabState] = useState<TabId>(initialTab);
  const lastTabRef = useRef<TabId>(activeTab);

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (isTab(raw) && raw !== lastTabRef.current) {
      lastTabRef.current = raw;
      setActiveTabState(raw);
    }
  }, [searchParams]);

  const setActiveTab = (id: TabId) => {
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
    <div className="space-y-5 pb-12">
      <div className="space-y-3">
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

        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em] text-brand-950">Your business vs your competitors</h1>
          <p className="mt-1 max-w-3xl text-[13px] text-brand-500">
            Your products and prices next to your competitors&apos;, what they push hardest, and what to do about it.
            Everything here is read from the websites we already crawled.
          </p>
        </div>

        <BusinessAtAGlance projectId={projectId || ""} onOpenTab={setActiveTab} />

        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "catalog-you" && <CatalogYouTab projectId={projectId || ""} />}
      {activeTab === "catalog-them" && <CatalogThemTab projectId={projectId || ""} onOpenTab={setActiveTab} />}
      {activeTab === "gaps" && <GapsTab projectId={projectId || ""} domain={customerDomain} />}
      {activeTab === "marketing" && <MarketingStrategyTab projectId={projectId || ""} />}
      {activeTab === "plans" && <PlansTab projectId={projectId || ""} onOpenTab={(tab) => setActiveTab(tab)} />}
    </div>
  );
}
