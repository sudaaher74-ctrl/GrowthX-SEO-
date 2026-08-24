"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES, searchRoutes, type AppRoute } from "@/lib/routes";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ⌘K navigation.
 *
 * Its item list used to be hand-written and had drifted badly: six of its
 * nineteen destinations (`/search-console`, `/analytics`, `/rank-tracking`,
 * `/local-seo`, `/backlinks`, `/automations`) were never built, so selecting
 * them 404'd, while ten real pages were missing. It now enumerates the route
 * registry, so it cannot disagree with the app again.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Where focus was before the palette opened, so Escape can put it back
  // rather than dropping the user at the top of the document.
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  // ⌘K / Ctrl+K anywhere in the app.
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

  useEffect(() => {
    if (open) {
      restoreFocusTo.current = document.activeElement as HTMLElement | null;
      inputRef.current?.focus();
    } else {
      restoreFocusTo.current?.focus?.();
    }
  }, [open]);

  // Clearing the query belongs in render, not in the effect above: setting
  // state from an effect costs a second render pass, and React flags it.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }

  const results = useMemo(() => searchRoutes(query), [query]);

  // Reset the highlight when the query changes. Done during render rather than
  // in an effect so there is no extra render pass.
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setSelectedIndex(0);
  }

  const select = (route: AppRoute) => {
    onOpenChange(false);
    router.push(route.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (results.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (results.length || 1)) % (results.length || 1));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      select(results[selectedIndex]);
    } else if (e.key === "Tab") {
      // The palette is the only thing on screen while it is open; Tab must not
      // walk into the page behind the backdrop.
      e.preventDefault();
    }
  };

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const byScope = new Map<string, AppRoute[]>();
    for (const route of results) {
      if (!byScope.has(route.scope)) {
        byScope.set(route.scope, []);
        order.push(route.scope);
      }
      byScope.get(route.scope)!.push(route);
    }
    return order.map((scope) => ({ scope, routes: byScope.get(scope)! }));
  }, [results]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20">
      <button
        aria-label="Close search"
        tabIndex={-1}
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 cursor-default bg-brand-950/20 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and jump to a page"
        onKeyDown={handleKeyDown}
        className="relative z-50 flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl"
        style={{ borderColor: "var(--border-strong)" }}
      >
        <div className="flex items-center gap-3 border-b bg-brand-50 px-5 py-4" style={{ borderColor: "var(--border-color)" }}>
          <Search size={18} className="shrink-0 text-brand-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages and tools…"
            aria-label="Search pages and tools"
            aria-controls="command-palette-results"
            className="w-full bg-transparent text-base text-brand-950 placeholder:text-brand-400 focus:outline-none"
          />
          <kbd
            className="flex h-6 shrink-0 items-center rounded border bg-brand-100 px-2 font-mono text-xs text-brand-500"
            style={{ borderColor: "var(--border-color)" }}
          >
            ESC
          </kbd>
        </div>

        <div id="command-palette-results" ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-3">
          {results.length === 0 ? (
            <p className="py-12 text-center text-sm text-brand-400">
              Nothing matches &ldquo;{query}&rdquo;.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.scope} className="space-y-1">
                <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-400">{group.scope}</p>
                {group.routes.map((route) => {
                  const idx = results.indexOf(route);
                  const isSelected = idx === selectedIndex;
                  const Icon = route.icon;

                  return (
                    <button
                      key={route.href}
                      type="button"
                      data-selected={isSelected}
                      onClick={() => select(route)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors",
                        isSelected ? "bg-brand-100 text-brand-950" : "text-brand-950 hover:bg-brand-50",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                            isSelected ? "bg-white text-brand-950 shadow-sm" : "bg-brand-100 text-brand-500",
                          )}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{route.label}</span>
                          <span className="block truncate text-xs text-brand-400">{route.description}</span>
                        </span>
                      </span>

                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1 text-xs font-medium",
                          isSelected ? "text-brand-500" : "text-transparent group-hover:text-brand-400",
                        )}
                      >
                        Select
                        <CornerDownLeft size={13} />
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className="flex items-center justify-between border-t bg-brand-50 px-4 py-2.5 text-xs text-brand-400"
          style={{ borderColor: "var(--border-color)" }}
        >
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-brand-100 px-1">↑</kbd>
              <kbd className="rounded border bg-brand-100 px-1">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-brand-100 px-1.5">↵</kbd>
              to select
            </span>
          </span>
          <span>
            {results.length} of {ROUTES.length} pages
          </span>
        </div>
      </div>
    </div>
  );
}
