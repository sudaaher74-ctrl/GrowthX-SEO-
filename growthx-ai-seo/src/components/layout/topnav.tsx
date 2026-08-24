"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, LogOut, Menu, Search, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { routeFor } from "@/lib/routes";
import { CommandPalette } from "@/components/ui/command-palette";
import { toast } from "@/components/ui/toast";
import { PERIODS, usePeriod, usePortfolio, useWorkspace } from "@/hooks/use-growthx";

export function TopNav({ setMobileOpen }: { collapsed?: boolean; setMobileOpen?: (open: boolean) => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { days, setDays } = usePeriod();
  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [auditing, setAuditing] = useState(false);

  // There was no way to sign out anywhere in the app, because there was no
  // real sign-in either — the shell logged everyone into one shared account.
  function signOut() {
    api.logout();
    router.replace("/login");
  }

  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;

  /**
   * "Run audit" was a button with no `onClick` — it had never done anything.
   * It now starts a crawl of the active client's domain, the same call the
   * Website and Site Health pages make, and sends you where the results land.
   */
  async function runAudit() {
    if (!client?.domain) {
      toast.info("Pick a project with a website first", "The audit runs against a verified domain.");
      return;
    }
    setAuditing(true);
    try {
      await api.startCrawl({ domain: client.domain, maxDepth: 20, maxConcurrency: 10, useSitemap: true });
      toast.success(`Audit started for ${client.domain}`, "Results appear on the Website page as pages are crawled.");
      router.push("/website");
    } catch (error) {
      toast.error("Could not start the audit", error instanceof Error ? error.message : undefined);
    } finally {
      setAuditing(false);
    }
  }

  // Longest-prefix match, so a nested page like /content-intelligence/gaps gets
  // its own name instead of falling through to the generic default the old
  // exact-match table produced on most routes.
  const meta = routeFor(pathname);

  return (
    <>
      <header
        className="fixed left-0 right-0 top-0 z-30 flex h-[52px] items-center gap-3 border-b bg-white px-4 md:left-[232px]"
        style={{ borderColor: "var(--border-color)" }}
      >
        <button className="md:hidden" onClick={() => setMobileOpen?.(true)} aria-label="Open navigation">
          <Menu size={18} className="text-brand-600" />
        </button>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px]">
          <span className="text-brand-400">{meta?.scope ?? "Workspace"}</span>
          <span className="text-brand-300" aria-hidden="true">
            /
          </span>
          <span aria-current="page" className="font-semibold text-brand-950">
            {meta?.label ?? "Workspace"}
          </span>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Search. A button, not an input: it opens the command palette,
              which is where the typing actually happens. The old input took
              keystrokes and did nothing with them. */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-brand-50 lg:flex"
            style={{ borderColor: "var(--border-color)" }}
          >
            <Search size={13} className="text-brand-400" />
            <span className="w-44 text-[12px] text-brand-400">Search or jump to…</span>
            <kbd
              className="rounded border px-1 font-mono text-[9px] text-brand-400"
              style={{ borderColor: "var(--border-color)" }}
            >
              ⌘K
            </kbd>
          </button>

          {/* Narrow screens get the same thing as an icon. */}
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="rounded-lg border p-1.5 text-brand-500 transition-colors hover:text-brand-950 lg:hidden"
            style={{ borderColor: "var(--border-color)" }}
          >
            <Search size={13} />
          </button>

          {/* Period pills. These now drive the workspace-wide reporting period
              that the portfolio and visibility queries read. */}
          <div
            role="group"
            aria-label="Reporting period"
            className="hidden items-center rounded-lg border p-0.5 sm:flex"
            style={{ borderColor: "var(--border-color)" }}
          >
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setDays(p)}
                aria-pressed={days === p}
                className={cn(
                  "rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                  days === p ? "bg-brand-100 font-semibold text-brand-950" : "text-brand-500 hover:text-brand-950",
                )}
              >
                {p}d
              </button>
            ))}
          </div>

          <button
            onClick={runAudit}
            disabled={auditing}
            className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {auditing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            {auditing ? "Starting…" : "Run audit"}
          </button>

          <button
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg border p-1.5 text-brand-500 transition-colors hover:text-brand-950"
            style={{ borderColor: "var(--border-color)" }}
          >
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* Mounted at last. The palette was a finished component that nothing
          rendered, while the header advertised its ⌘K shortcut. */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
