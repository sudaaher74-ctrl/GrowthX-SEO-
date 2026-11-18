"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronsUpDown, Loader2, Plus, Search, Trash2 } from "lucide-react";
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
  const [clientFilter, setClientFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
      const run = await api.autopilot.start(domain, null);
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

  async function executeDeleteWebsite(id: string, _name: string) {
    setSwitcherError(null);
    setIsDeleting(true);
    try {
      await deleteProject.mutateAsync(id);
      const remaining = portfolio.data?.clients.filter((c) => c.projectId !== id) ?? [];
      if (id === projectId) {
        setProjectId(remaining[0]?.projectId ?? "");
      }
      queryClient.removeQueries({ predicate: (q) => q.queryKey.includes(id) });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      setConfirmDelete(null);
    } catch (err) {
      setSwitcherError(err instanceof Error ? err.message : "Could not delete the website.");
    } finally {
      setIsDeleting(false);
    }
  }

  const clientList = portfolio.data?.clients ?? [];
  const filteredClients = clientList.filter((c) => {
    if (!clientFilter.trim()) return true;
    const q = clientFilter.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.domain || "").toLowerCase().includes(q);
  });
  const chip = variant === "chip";

  return (
    <div className={cn("relative min-w-0", chip ? "" : "px-0.5 mb-3")}>
      <button
        data-tour="workspace-switcher"
        onClick={() => {
          setSwitcherOpen((v) => !v);
          setConfirmDelete(null);
          setClientFilter("");
        }}
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
          <div
            className="fixed inset-0 z-30"
            onClick={() => {
              setSwitcherOpen(false);
              setConfirmDelete(null);
            }}
          />
          <div
            className={cn(
              "absolute z-40 mt-1.5 overflow-hidden rounded-xl border bg-surface-1 p-1 shadow-xl",
              chip ? "left-0 w-[290px]" : "left-0.5 right-0.5",
            )}
            style={{ borderColor: "var(--border-color)" }}
          >
            {/* IN-SWITCHER DANGER CONFIRMATION DIALOG */}
            {confirmDelete ? (
              <div className="p-3 space-y-2.5 bg-error-50/70 border border-error-200 rounded-lg animate-in fade-in duration-150">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="text-error-600 shrink-0 mt-0.5" />
                  <div className="text-[11.5px] text-brand-950">
                    <p className="font-bold">Delete &ldquo;{confirmDelete.name}&rdquo;?</p>
                    <p className="text-[10.5px] text-brand-600 mt-0.5">
                      All technical audits, reports, and settings will be permanently removed. This cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setConfirmDelete(null)}
                    className="rounded-md border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-surface-2 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => executeDeleteWebsite(confirmDelete.id, confirmDelete.name)}
                    className="inline-flex items-center gap-1 rounded-md bg-error-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-error-700 transition shadow-2xs cursor-pointer disabled:opacity-60"
                  >
                    {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    <span>{isDeleting ? "Deleting..." : "Delete Website"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Instant Filter Search Bar (when > 3 clients) */}
                {clientList.length > 3 && (
                  <div className="px-1 pt-0.5 pb-1 border-b border-brand-200/60 mb-1">
                    <div className="relative">
                      <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-brand-400" />
                      <input
                        type="text"
                        placeholder="Filter clients…"
                        value={clientFilter}
                        onChange={(e) => setClientFilter(e.target.value)}
                        className="w-full rounded-md border border-brand-200/80 bg-surface-2/80 pl-6 pr-2 py-1 text-[11px] text-brand-950 placeholder:text-brand-400 focus:outline-primary-600"
                      />
                    </div>
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {filteredClients.length === 0 ? (
                    <div className="p-3 text-center text-[11px] text-brand-400 font-mono">
                      No matching clients found
                    </div>
                  ) : (
                    filteredClients.map((client) => {
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
                            onClick={() => setConfirmDelete({ id: client.projectId, name: client.name })}
                            disabled={deleteProject.isPending}
                            title={`Delete ${client.name}`}
                            aria-label={`Delete ${client.name}`}
                            className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-brand-400 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-error-50 hover:text-error-600 transition disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })
                  )}
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
              </>
            )}

            {switcherError && (
              <div className="mx-1 my-1 rounded-md bg-error-50 px-2 py-1.5 text-[11px] font-medium text-error-700 border border-error-200">
                {switcherError}
              </div>
            )}
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
