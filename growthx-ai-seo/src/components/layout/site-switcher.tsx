"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Plus, Trash2 } from "lucide-react";
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
            <div className={cn("relative", chip ? "" : "px-1 mb-3")}>
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                className={cn("flex items-center gap-2 border bg-white text-left transition hover:bg-brand-50", chip ? "h-11 rounded-full py-1 pl-1.5 pr-3" : "w-full rounded-lg px-2 py-2")}
                style={{ borderColor: "var(--border-color)" }}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 font-mono text-[9px] font-semibold text-brand-700">
                  {selected ? initialsOf(selected.name) : "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-brand-950">
                    {selected?.name ?? "No projects yet"}
                  </span>
                  <span className="block truncate font-mono text-[9.5px] text-brand-400">
                    {clientRow?.domain ?? "add a website"}
                  </span>
                </span>
                <ChevronsUpDown size={13} className="shrink-0 text-brand-400" />
              </button>

              {switcherOpen && (
                <div
                  className={cn("absolute z-40 mt-1 overflow-hidden rounded-lg border bg-white shadow-lg", chip ? "left-0 w-[280px]" : "left-1 right-1")}
                  style={{ borderColor: "var(--border-color)" }}
                >
                  {portfolio.data?.clients.map((client) => (
                    <div key={client.projectId} className="group flex items-center hover:bg-brand-100">
                      <button
                        onClick={() => {
                          setProjectId(client.projectId);
                          setSwitcherOpen(false);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-100 font-mono text-[8px] font-semibold text-brand-700">
                          {client.initials}
                        </span>
                        <span className="flex-1 truncate text-[11.5px] text-brand-950">{client.name}</span>
                        <span className="font-mono text-[9.5px] text-brand-500">
                          {client.aiCitationSharePct != null ? `${client.aiCitationSharePct}%` : "—"}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDeleteWebsite(client.projectId, client.name)}
                        disabled={deleteProject.isPending}
                        title={`Delete ${client.name}`}
                        aria-label={`Delete ${client.name}`}
                        className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-brand-400 transition hover:bg-error-50 hover:text-error-600 disabled:opacity-50"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleAddWebsite();
                    }}
                    className="flex items-center gap-1 border-t p-1.5"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <input
                      value={newSite}
                      onChange={(e) => setNewSite(e.target.value)}
                      placeholder="Add website, e.g. yoursite.com"
                      className="min-w-0 flex-1 rounded-md border bg-white px-2 py-1.5 text-[11.5px] text-brand-950 outline-none focus:border-brand-400"
                      style={{ borderColor: "var(--border-color)" }}
                    />
                    <button
                      type="submit"
                      disabled={!newSite.trim() || adding}
                      title="Add website"
                      aria-label="Add website"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50"
                    >
                      <Plus size={13} />
                    </button>
                  </form>
                  {switcherError && <p className="px-2 pb-2 text-[10.5px] text-error-600">{switcherError}</p>}
                </div>
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
