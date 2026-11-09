"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Search,
  BarChart3,
  Zap,
  Target,
  Eye,
  GitBranch,
  Settings,
  RefreshCw,
  CornerDownLeft,
  Wrench,
  CalendarDays,
  Link2,
  Gauge,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Globe,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Deep Dives" | "Quick Actions";
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  subtitle?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  // Listen for ⌘K or Ctrl+K globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const items: CommandItem[] = useMemo(() => [
    // Core Navigation (All 9 Core Tabs)
    { id: "nav-dash", title: "Dashboard", category: "Navigation", icon: BarChart3, href: "/dashboard", subtitle: "Unified overview, health score & executive telemetry beacons" },
    { id: "nav-audit", title: "Website Audit", category: "Navigation", icon: Zap, href: "/website", subtitle: "Autonomous crawler, issue deduplication & site health score" },
    { id: "nav-organic", title: "Organic Search & Keywords", category: "Navigation", icon: Search, href: "/organic-search", subtitle: "Rank tracking, search intent & page-2 striking opportunities" },
    { id: "nav-traffic", title: "Traffic Hub", category: "Navigation", icon: BarChart3, href: "/google", subtitle: "Search Console & Analytics 4 visitors, queries & conversions" },
    { id: "nav-comp", title: "Competitor Intelligence", category: "Navigation", icon: Target, href: "/competitor-intelligence", subtitle: "Benchmarks, competitor crawl diff & market gaps" },
    { id: "nav-backlinks", title: "Backlink Intelligence", category: "Navigation", icon: Link2, href: "/backlinks", subtitle: "Authority backlink index, link gaps & verified checks" },
    { id: "nav-ai", title: "AI Visibility", category: "Navigation", icon: Eye, href: "/ai-visibility", subtitle: "How ChatGPT, Gemini, Perplexity and Claude describe you" },
    { id: "nav-fix", title: "Fix Engine", category: "Navigation", icon: Wrench, href: "/fix-engine", subtitle: "Your improvement plan, and changes as a pull request" },
    { id: "nav-monthly-report", title: "Monthly Report", category: "Navigation", icon: CalendarDays, href: "/monthly-report", subtitle: "Recorded work, verified changes, and measured results by month" },
    { id: "nav-integrations", title: "Integrations & Connections", category: "Navigation", icon: GitBranch, href: "/settings?tab=integrations", subtitle: "Connect Google, GitHub & CMS publishing sources" },
    { id: "nav-settings", title: "Settings", category: "Navigation", icon: Settings, href: "/settings", subtitle: "Workspace configuration & team" },

    // Deep Dives & Sub-Views
    { id: "deep-pages", title: "Website Audit: Crawled Pages Table", category: "Deep Dives", icon: Globe, href: "/website?tab=pages", subtitle: "Inspect indexability, HTTP status codes, word counts & 1-click staging" },
    { id: "deep-cwv", title: "Speed & Core Web Vitals Deep Dive", category: "Deep Dives", icon: Gauge, href: "/website?tab=performance", subtitle: "LCP, INP, CLS threshold breakdown & crawl response times" },
    { id: "deep-striking", title: "Page-2 Striking Distance Opportunities", category: "Deep Dives", icon: Target, href: "/organic-search?tab=page2", subtitle: "Queries ranking #11–#20 ready to jump to Page 1" },
    { id: "deep-gaps", title: "Competitor Content & Keyword Gaps", category: "Deep Dives", icon: Layers, href: "/competitor-intelligence?tab=gaps", subtitle: "Identify topics where competitors rank on Page 1" },
    { id: "deep-rivals", title: "Competitor Rival Radar", category: "Deep Dives", icon: Radio, href: "/competitor-intelligence?tab=rivals", subtitle: "Direct benchmark comparison against primary competitors" },
    { id: "deep-link-gap", title: "Competitor Link Gap Matrix", category: "Deep Dives", icon: Link2, href: "/backlinks?tab=gaps", subtitle: "Referring domains linking to 2+ rivals but missing you" },
    { id: "deep-results", title: "Verified HTML Results Ledger", category: "Deep Dives", icon: CheckCircle2, href: "/fix-engine?tab=results", subtitle: "Continuous rank and traffic lift observation loop" },

    // Quick Actions
    { id: "act-audit", title: "Run Site-Wide Technical Audit", category: "Quick Actions", icon: Zap, action: () => { router.push("/website"); }, subtitle: "Crawl your site for SEO health issues" },
    { id: "act-verify-html", title: "Verify Live HTML Changes", category: "Quick Actions", icon: ShieldCheck, action: () => { router.push("/dashboard"); }, subtitle: "Confirm deployed changes against live server responses" },
    { id: "act-sync-gsc", title: "Sync Google Search Console & GA4", category: "Quick Actions", icon: RefreshCw, action: () => { router.push("/google"); }, subtitle: "Fetch the latest rolling search queries and traffic" },
    { id: "act-ai-scan", title: "Check AI Search Visibility", category: "Quick Actions", icon: Eye, action: () => { router.push("/ai-visibility"); }, subtitle: "Analyze model responses across ChatGPT and Gemini" },
    { id: "act-open-fixes", title: "Stage GitHub Pull Request", category: "Quick Actions", icon: Wrench, action: () => { router.push("/fix-engine"); }, subtitle: "Package approved SEO code fixes into a Git branch" },
  ], [router]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      item =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Reset the highlighted row when the query changes.
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setSelectedIndex(0);
  }

  const handleSelect = (item: CommandItem) => {
    onOpenChange(false);
    setQuery("");
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  // Keyboard navigation within modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (filteredItems.length || 1)) % (filteredItems.length || 1));
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex]);
    }
  };

  const categories = useMemo(() => {
    const cats: string[] = [];
    filteredItems.forEach(i => {
      if (!cats.includes(i.category)) cats.push(i.category);
    });
    return cats;
  }, [filteredItems]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 bg-brand-950/40 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={{ duration: 0.15 }}
          onKeyDown={handleKeyDown}
          className="relative w-full max-w-2xl bg-surface-1 border border-brand-200/80 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[72vh]"
        >
          {/* Search bar */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-brand-200/80 bg-surface-2/80">
            <Search size={18} className="text-brand-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Jump to any section, deep dive, or trigger an action…"
              className="w-full bg-transparent text-sm text-brand-950 placeholder:text-brand-400 focus:outline-none"
            />
            <kbd className="h-6 px-2 rounded-md border border-brand-200 bg-surface-1 text-[11px] text-brand-500 font-mono flex items-center shrink-0">
              ESC
            </kbd>
          </div>

          {/* Results list */}
          <div className="overflow-y-auto flex-1 p-3 space-y-3">
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-brand-400 text-xs">
                No results found for &ldquo;{query}&rdquo;. Try searching for &ldquo;audit&rdquo;, &ldquo;keywords&rdquo;, or &ldquo;traffic&rdquo;.
              </div>
            ) : (
              categories.map(cat => (
                <div key={cat} className="space-y-1">
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-400 font-mono">
                    {cat}
                  </div>
                  {filteredItems
                    .filter(i => i.category === cat)
                    .map(item => {
                      const idx = filteredItems.findIndex(i => i.id === item.id);
                      const isSelected = idx === selectedIndex;
                      const Icon = item.icon;

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors group",
                            isSelected
                              ? "bg-brand-100 text-brand-950 shadow-2xs"
                              : "hover:bg-surface-2 text-brand-800"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                isSelected
                                  ? "bg-surface-1 text-signal-500 shadow-2xs border border-brand-200/80"
                                  : "bg-surface-2 text-brand-500 group-hover:text-brand-950"
                              )}
                            >
                              <Icon size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate">{item.title}</div>
                              {item.subtitle && (
                                <div
                                  className={cn(
                                    "text-[11px] truncate",
                                    isSelected ? "text-brand-600" : "text-brand-400"
                                  )}
                                >
                                  {item.subtitle}
                                </div>
                              )}
                            </div>
                          </div>

                          <div
                            className={cn(
                              "flex items-center gap-1 text-[11px] font-semibold shrink-0 font-mono",
                              isSelected ? "text-brand-700" : "opacity-0 group-hover:opacity-100 text-brand-400"
                            )}
                          >
                            <span>Jump</span>
                            <CornerDownLeft size={12} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-brand-200/80 bg-surface-2/80 flex items-center justify-between text-xs text-brand-500 font-mono">
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-surface-1 border border-brand-200 text-brand-700">↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-1 border border-brand-200 text-brand-700">↓</kbd>
                <span>to navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-surface-1 border border-brand-200 text-brand-700">↵</kbd>
                <span>to select</span>
              </span>
            </div>
            <span className="text-[11px] font-bold text-brand-600">Reigel Global Navigation</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
