"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Search, ArrowRight, Sparkles, Globe, BarChart3, Search as SearchIcon,
  Zap, FileText, Bot, MapPin, Target, Eye, Sliders, Code, Link2,
  Image, GitBranch, Play, FileSpreadsheet, CreditCard, Settings,
  HelpCircle, Moon, Sun, RefreshCw, Plus, Check, CornerDownLeft
} from "lucide-react";
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
    // Navigation
    { id: "nav-dash", title: "Dashboard Overview", category: "Navigation", icon: BarChart3, href: "/dashboard", subtitle: "Main analytics & executive summary" },
    { id: "nav-gsc", title: "Google Search Console", category: "Navigation", icon: SearchIcon, href: "/search-console", subtitle: "Queries, clicks, CTR & impressions" },
    { id: "nav-ga", title: "Google Analytics 4", category: "Navigation", icon: Globe, href: "/analytics", subtitle: "Sessions, users & conversion funnels" },
    { id: "nav-tech", title: "Technical SEO Audit", category: "Navigation", icon: Zap, href: "/technical-seo", subtitle: "Site crawler & 47 detected issues" },
    { id: "nav-rank", title: "Rank Tracking", category: "Navigation", icon: Target, href: "/rank-tracking", subtitle: "Daily keyword positions & SERP updates" },
    { id: "nav-kw", title: "Keyword Research", category: "Navigation", icon: SearchIcon, href: "/keywords", subtitle: "Volume, difficulty, CPC & opportunities" },
    { id: "nav-content", title: "AI Content Engine", category: "Navigation", icon: FileText, href: "/content-ai", subtitle: "Generate SEO blogs, landing & local pages" },
    { id: "nav-ai", title: "AI Assistant", category: "Navigation", icon: Bot, href: "/ai-assistant", subtitle: "Chat with AI about your workspace data" },
    { id: "nav-local", title: "Local SEO Generator", category: "Navigation", icon: MapPin, href: "/local-seo", subtitle: "Bulk city & service page generation" },
    { id: "nav-geo", title: "GEO / AI Search Visibility", category: "Navigation", icon: Eye, href: "/geo-tracking", subtitle: "Track mentions in ChatGPT, Perplexity & Gemini" },
    { id: "nav-comp", title: "Competitor Analysis", category: "Navigation", icon: Target, href: "/competitors", subtitle: "Side-by-side traffic & keyword gaps" },
    { id: "nav-meta", title: "AI Meta Optimizer", category: "Navigation", icon: Sliders, href: "/meta-optimizer", subtitle: "Bulk title & description generator" },
    { id: "nav-schema", title: "Schema Generator", category: "Navigation", icon: Code, href: "/schema-generator", subtitle: "JSON-LD structured data builder" },
    { id: "nav-backlinks", title: "Backlink Monitor", category: "Navigation", icon: Link2, href: "/backlinks", subtitle: "New, lost & spam backlink analysis" },
    { id: "nav-img", title: "Image SEO Optimizer", category: "Navigation", icon: Image, href: "/image-seo", subtitle: "Alt text generator & WebP compression" },
    { id: "nav-links", title: "Internal Linking AI", category: "Navigation", icon: GitBranch, href: "/internal-linking", subtitle: "Orphan page detection & link graph" },
    { id: "nav-auto", title: "Automations & Workflows", category: "Navigation", icon: Play, href: "/automations", subtitle: "Scheduled audits & trigger alerts" },
    { id: "nav-reports", title: "Report Builder", category: "Navigation", icon: FileSpreadsheet, href: "/reports", subtitle: "White-label client PDF/Excel exports" },
    { id: "nav-settings", title: "Settings & Integrations", category: "Navigation", icon: Settings, href: "/settings", subtitle: "Workspace domain, team & OAuth" },

    // Quick Actions
    // Subtitles describe what the action does. They deliberately carry no
    // counts or metrics — the palette has no workspace data loaded, so any
    // figure here would be a fabricated number shown to every tenant.
    { id: "act-audit", title: "Run Site-Wide Technical Audit", category: "Quick Actions", icon: Zap, action: () => { router.push("/technical-seo"); }, subtitle: "Scan your site for SEO issues" },
    { id: "act-blog", title: "Generate New AI Blog Post", category: "Quick Actions", icon: Sparkles, action: () => { router.push("/content-ai"); }, subtitle: "Draft an SEO-optimized article" },
    { id: "act-sync", title: "Sync Google Search Console Data", category: "Quick Actions", icon: RefreshCw, action: () => { router.push("/search-console"); }, subtitle: "Fetch the latest search queries" },
    { id: "act-local", title: "Create Local City Page", category: "Quick Actions", icon: MapPin, action: () => { router.push("/local-seo"); }, subtitle: "Generate a landing page for a target city" },
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
              placeholder="Search tools, keywords, pages, quick actions... (try 'audit', 'rank', 'theme')"
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
