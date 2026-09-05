"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Search, Sparkles, Globe, BarChart3, Search as SearchIcon, Zap, FileText, MapPin, Target, Eye, GitBranch, FileSpreadsheet, Settings, RefreshCw, Plus, CornerDownLeft, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Quick Actions" | "Keywords" | "Pages";
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
    // E-Commerce
    { id: "nav-dash", title: "Dashboard", category: "Navigation", icon: BarChart3, href: "/dashboard", subtitle: "Unified overview & executive KPIs" },
    { id: "nav-audit", title: "Website Audit", category: "Navigation", icon: Zap, href: "/website", subtitle: "Technical crawler, issue deduplication & site health" },
    { id: "nav-comp", title: "Competitor Intelligence", category: "Navigation", icon: Target, href: "/competitor-intelligence", subtitle: "Benchmarks, competitor crawl diff & market gaps" },
    { id: "nav-social", title: "Social Media", category: "Navigation", icon: Share2, href: "/social-media", subtitle: "Viral hooks, cross-platform cadence & social intelligence" },

    // Google Business Profile
    { id: "nav-local", title: "Local SEO", category: "Navigation", icon: MapPin, href: "/local", subtitle: "Google Business Profile, reviews & citations" },
    { id: "nav-monitoring", title: "Monitoring", category: "Navigation", icon: Globe, href: "/monitoring", subtitle: "Uptime, SSL, and daily crawl watchers" },
    { id: "nav-research", title: "Market Research", category: "Navigation", icon: Eye, href: "/market-research", subtitle: "Cited answers about this client's market" },

    // Workspace & Tools
    { id: "nav-search-perf", title: "Search Performance", category: "Navigation", icon: SearchIcon, href: "/search-performance", subtitle: "Google Search Console & GA4 traffic" },
    { id: "nav-ai-vis", title: "AI Visibility", category: "Navigation", icon: Sparkles, href: "/ai-visibility", subtitle: "Brand citations in ChatGPT, Claude & Gemini" },
    { id: "nav-content", title: "Content & Opportunities", category: "Navigation", icon: FileText, href: "/content-opportunities", subtitle: "SEO opportunities, keyword gaps & drafting studio" },
    { id: "nav-reports", title: "Reports", category: "Navigation", icon: FileSpreadsheet, href: "/reports", subtitle: "Executive summaries & white-label exports" },
    { id: "nav-integrations", title: "Integrations", category: "Navigation", icon: GitBranch, href: "/integrations", subtitle: "Connect Google, GitHub & CRM sources" },
    { id: "nav-settings", title: "Settings", category: "Navigation", icon: Settings, href: "/settings", subtitle: "Workspace configuration & team" },
    { id: "nav-add-biz", title: "Add Business", category: "Navigation", icon: Plus, href: "/projects", subtitle: "Guided 5-step onboarding wizard" },

    // Quick Actions
    // Subtitles describe what the action does. They deliberately carry no
    // counts or metrics — the palette has no workspace data loaded, so any
    // figure here would be a fabricated number shown to every tenant.
    { id: "act-audit", title: "Run Site-Wide Technical Audit", category: "Quick Actions", icon: Zap, action: () => { router.push("/technical-seo"); }, subtitle: "Scan your site for SEO issues" },
    { id: "act-blog", title: "Generate New AI Blog Post", category: "Quick Actions", icon: Sparkles, action: () => { router.push("/content-ai"); }, subtitle: "Draft an SEO-optimized article" },
    // These two pointed at /search-console and /local-seo, neither of which
    // is a route in this app — the palette was written before it was mounted,
    // so nobody ever clicked them into a 404.
    { id: "act-sync", title: "Sync Google Search Console Data", category: "Quick Actions", icon: RefreshCw, action: () => { router.push("/search/search-console"); }, subtitle: "Fetch the latest search queries" },
    { id: "act-local", title: "Create Local City Page", category: "Quick Actions", icon: MapPin, action: () => { router.push("/local"); }, subtitle: "Generate a landing page for a target city" },
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
            <span>GrowthX AI SEO · Quick Command</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
