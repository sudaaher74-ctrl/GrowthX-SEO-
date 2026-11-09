"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Search,
  PenLine,
  BarChart3,
  Zap,
  Target,
  Eye,
  GitBranch,
  FileSpreadsheet,
  Settings,
  RefreshCw,
  Plus,
  CornerDownLeft,
  Wrench,
  CalendarDays,
  Link2,
  Gauge,
  Layers,
  ShieldCheck,
  CheckCircle2,
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
    // Core Navigation
    { id: "nav-dash", title: "Dashboard", category: "Navigation", icon: BarChart3, href: "/dashboard", subtitle: "Unified overview & executive KPIs" },
    { id: "nav-audit", title: "Website Audit", category: "Navigation", icon: Zap, href: "/website", subtitle: "Technical crawler, issue deduplication & site health" },
    { id: "nav-organic", title: "Organic Search & Keywords", category: "Navigation", icon: Search, href: "/organic-search", subtitle: "Rank tracking, search intent & page-2 striking opportunities" },
    { id: "nav-traffic", title: "Traffic Hub", category: "Navigation", icon: BarChart3, href: "/google", subtitle: "Search Console & Analytics 4 visitors, queries & conversions" },
    { id: "nav-comp", title: "Competitor Intelligence", category: "Navigation", icon: Target, href: "/competitor-intelligence", subtitle: "Benchmarks, competitor crawl diff & market gaps" },
    { id: "nav-backlinks", title: "Backlink Intelligence", category: "Navigation", icon: Link2, href: "/backlinks", subtitle: "Authority backlink index, link gaps & verified checks" },
    { id: "nav-ai", title: "AI Visibility", category: "Navigation", icon: Eye, href: "/ai-visibility", subtitle: "How ChatGPT, Gemini, Perplexity and Claude describe you" },
    { id: "nav-fix", title: "Fix Engine", category: "Navigation", icon: Wrench, href: "/fix-engine", subtitle: "Your improvement plan, and changes as a pull request" },
    { id: "nav-monthly-report", title: "Monthly Report", category: "Navigation", icon: CalendarDays, href: "/monthly-report", subtitle: "Recorded work, verified changes, and measured results by month" },
    { id: "nav-integrations", title: "Integrations & Connections", category: "Navigation", icon: GitBranch, href: "/settings?tab=integrations", subtitle: "Connect Google, GitHub & CMS publishing sources" },
    { id: "nav-settings", title: "Settings", category: "Navigation", icon: Settings, href: "/settings", subtitle: "Workspace configuration & team" },

    // Deep Dives & Reports
    { id: "deep-cwv", title: "Speed & Core Web Vitals Deep Dive", category: "Deep Dives", icon: Gauge, href: "/website?tab=performance", subtitle: "LCP, INP, CLS threshold breakdown & crawl response times" },
    { id: "deep-striking", title: "Page-2 Striking Distance Opportunities", category: "Deep Dives", icon: Target, href: "/organic-search?tab=page2", subtitle: "Queries ranking #11–#20 ready to jump to Page 1" },
    { id: "deep-gaps", title: "Competitor Content & Keyword Gaps", category: "Deep Dives", icon: Layers, href: "/competitor-intelligence?tab=gaps", subtitle: "Identify topics where competitors rank on Page 1" },
    { id: "deep-link-gap", title: "Competitor Link Gap Matrix", category: "Deep Dives", icon: Link2, href: "/backlinks", subtitle: "Referring domains linking to 2+ rivals but missing you" },
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
      item => item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q)) || item.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Reset the highlighted row when the query changes. Done during render
  // rather than in an effect so there is no extra render pass.
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
          className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          onKeyDown={handleKeyDown}
          className="relative w-full max-w-2xl bg-[var(--card-bg)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[70vh]"
        >
          {/* Search bar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-color)] bg-[var(--surface-2)]">
            <Search size={18} className="text-gray-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              // Was "Search tools, keywords, pages, quick actions… (try 'audit',
              // 'rank', 'theme')". There are no keyword, page or theme
              // commands — only Navigation and Quick Actions — so typing
              // "rank" or "theme" returned nothing and read as a broken search.
              placeholder="Jump to a section, or start an action…"
              className="w-full bg-transparent text-base text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
            />
            <kbd className="h-6 px-2 rounded border border-[var(--border-color)] bg-[var(--surface-3)] text-xs text-[var(--text-muted)] font-mono flex items-center shrink-0">
              ESC
            </kbd>
          </div>

          {/* Results list */}
          <div className="overflow-y-auto flex-1 p-3 space-y-4">
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-[var(--text-muted)] text-sm">
                No results found for &ldquo;{query}&rdquo;. Try searching for &ldquo;SEO&rdquo;, &ldquo;content&rdquo;, or &ldquo;rank&rdquo;.
              </div>
            ) : (
              categories.map(cat => (
                <div key={cat} className="space-y-1">
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
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
                            "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-base group",
                            isSelected ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100" : "hover:bg-[var(--surface-2)] text-[var(--text-primary)]"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-base",
                              isSelected ? "bg-white dark:bg-zinc-700 text-gray-900 shadow-sm" : "bg-[var(--surface-3)] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                            )}>
                              <Icon size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{item.title}</div>
                              {item.subtitle && (
                                <div className={cn("text-xs truncate", isSelected ? "text-gray-500 dark:text-gray-400" : "text-[var(--text-muted)]")}>
                                  {item.subtitle}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className={cn("flex items-center gap-1 text-xs font-medium shrink-0", isSelected ? "text-gray-500 dark:text-gray-400" : "text-transparent group-hover:text-[var(--text-muted)]")}>
                            <span>Select</span>
                            <CornerDownLeft size={13} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-[var(--border-color)] bg-[var(--surface-2)] flex items-center justify-between text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded bg-[var(--surface-3)] border border-[var(--border-color)]">↑</kbd>
                <kbd className="px-1 rounded bg-[var(--surface-3)] border border-[var(--border-color)]">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 rounded bg-[var(--surface-3)] border border-[var(--border-color)]">↵</kbd>
                to select
              </span>
            </div>
            <span>Reigel AI SEO · Quick Command</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
