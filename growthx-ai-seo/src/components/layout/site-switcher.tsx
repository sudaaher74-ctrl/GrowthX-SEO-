"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { usePortfolio, useWorkspace, useDeleteProject } from "@/hooks/use-growthx";

/** Which client website is selected, with add and delete. Shared by the sidebar and the Dashboard's top bar. */
export function SiteSwitcher({ variant = "block", onDone }: { variant?: "block" | "chip"; onDone?: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgId, projects, projectId, setProjectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [newSite, setNewSite] = useState("");
  const [switcherError, setSwitcherError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const deleteProject = useDeleteProject(orgId);
  const selected = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === selected?.id) ?? null;

  async function handleAddWebsite() {
    const domain = newSite.trim();
    if (!domain) return;
    setSwitcherError(null);
    setAdding(true);
    try {
      // The same start the dashboard uses: it registers the website, creates
      // the project for it and begins reading the site. A bare project with no
      // website behind it leaves every audit page empty.
      const run = await api.autopilot.start(domain, null);
      // Register the returned project before selecting it. Otherwise the still
      // cached directory rejects the new ID and switches back to its first site.
      queryClient.setQueryData<{ id: string; name: string }[]>(["projects", orgId], (current = []) =>
        current.some((project) => project.id === run.projectId)
          ? current
          : [...current, { id: run.projectId, name: domain.replace(/^https?:\/\//, "").replace(/\/$/, "") }],
      );
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.setQueryData(["autopilot", run.projectId], run);
      setProjectId(run.projectId);
      setNewSite("");
      setSwitcherOpen(false);
      onDone?.();
      router.push("/dashboard");
    } catch (err) {
      setSwitcherError(err instanceof Error ? err.message : "Could not add the website.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteWebsite(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? All its audits, reports and settings will be permanently removed. This cannot be undone.`)) return;
    setSwitcherError(null);
    try {
      await deleteProject.mutateAsync(id);
      if (id === projectId) setProjectId("");
      queryClient.removeQueries({ predicate: (q) => q.queryKey.includes(id) });
    } catch (err) {
      setSwitcherError(err instanceof Error ? err.message : "Could not delete the website.");
    }
  }
  const chip = variant === "chip";

  return (
    <div className={cn("relative min-w-0", chip ? "" : "px-0.5 mb-3")}>
      <button
        data-tour="workspace-switcher"
        onClick={() => setSwitcherOpen((v) => !v)}
        className={cn(
          "flex min-w-0 items-center gap-2.5 border text-left transition-all focus-visible:outline-2 focus-visible:outline-primary-600",
          chip
            ? "h-9 max-w-[140px] rounded-xl bg-surface-1 py-1 pl-1.5 pr-2 hover:bg-surface-2 sm:max-w-[180px] md:max-w-[210px]"
            : "w-full rounded-xl bg-surface-2/80 px-2.5 py-2 shadow-2xs hover:border-brand-300 hover:bg-surface-2",
        )}
        style={{ borderColor: "var(--border-color)" }}
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-brand-100 font-mono text-[9.5px] font-bold text-brand-800">
          {selected ? initialsOf(selected.name) : "—"}
          {selected && (
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-success-500 ring-2 ring-surface-1" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-bold leading-tight text-brand-950">
            {selected?.name ?? "No projects yet"}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[10px] leading-tight text-brand-400">
            {clientRow?.domain ?? "add a website"}
          </span>
        </span>
        <ChevronsUpDown size={13} className="shrink-0 text-brand-400" />
      </button>

      {switcherOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setSwitcherOpen(false)} />
          <div
            className={cn(
              "absolute z-40 mt-1.5 overflow-hidden rounded-xl border bg-surface-1 p-1 shadow-xl",
              chip ? "left-0 w-[280px]" : "left-0.5 right-0.5",
            )}
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {portfolio.data?.clients.map((client) => {
                const isSelected = client.projectId === selected?.id;
                return (
                  <div
                    key={client.projectId}
                    className={cn(
                      "group flex items-center rounded-lg transition-colors",
                      isSelected ? "bg-brand-100/80" : "hover:bg-brand-100/50",
                    )}
                  >
                    <button
                      onClick={() => {
                        setProjectId(client.projectId);
                        setSwitcherOpen(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-brand-200 bg-surface-2 font-mono text-[8.5px] font-bold text-brand-700">
                        {client.initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] font-semibold text-brand-950">
                          {client.name}
                        </span>
                        <span className="block truncate font-mono text-[9.5px] text-brand-400">
                          {client.domain}
                        </span>
                      </span>
                      {client.aiCitationSharePct != null && (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-brand-600">
                          {client.aiCitationSharePct}%
                        </span>
                      )}
                      {isSelected && <Check size={13} className="shrink-0 text-success-600" />}
                    </button>
                    <button
                      onClick={() => handleDeleteWebsite(client.projectId, client.name)}
                      disabled={deleteProject.isPending}
                      title={`Delete ${client.name}`}
                      aria-label={`Delete ${client.name}`}
                      className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-brand-400 opacity-0 transition group-hover:opacity-100 hover:bg-error-50 hover:text-error-600 disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAddWebsite();
              }}
              className="mt-1 flex items-center gap-1 border-t pt-1.5 px-1 pb-1"
              style={{ borderColor: "var(--border-color)" }}
            >
              <input
                value={newSite}
                onChange={(e) => setNewSite(e.target.value)}
                placeholder="Add website, e.g. yoursite.com"
                className="min-w-0 flex-1 rounded-lg border bg-surface-2 px-2.5 py-1.5 text-[11.5px] text-brand-950 outline-none focus:border-brand-400"
                style={{ borderColor: "var(--border-color)" }}
              />
              <button
                type="submit"
                disabled={!newSite.trim() || adding}
                title="Add website"
                aria-label="Add website"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-signal-400 text-signal-ink transition hover:opacity-90 disabled:opacity-50"
              >
                <Plus size={13} />
              </button>
            </form>
            {switcherError && <p className="px-2 pb-1.5 text-[10.5px] text-error-600">{switcherError}</p>}
          </div>
        </>
      )}
    </div>
  );
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
