"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair, Plus, Trash2, Eye, EyeOff, ExternalLink,
  Globe, Upload, X, ChevronDown, Play
} from "lucide-react";
import { api, type AddCompetitorAccountBody } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";

const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "YOUTUBE", "TIKTOK", "TWITTER", "LINKEDIN"];
// No brand icons in lucide — use Globe as fallback for all platforms
const PLATFORM_ICONS: Record<string, React.ElementType> = {};
const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: "#e1306c",
  YOUTUBE: "#ff0000",
  FACEBOOK: "#1877f2",
  TIKTOK: "#000000",
  TWITTER: "#1da1f2",
  LINKEDIN: "#0077b5",
};

function PlatformIcon({ platform }: { platform: string }) {
  const Icon = PLATFORM_ICONS[platform] ?? Globe;
  return <Icon size={14} style={{ color: PLATFORM_COLORS[platform] ?? "#71717a" }} />;
}

export default function CompetitorWorkspacePage() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [ingestAccountId, setIngestAccountId] = useState<string | null>(null);

  const [form, setForm] = useState<AddCompetitorAccountBody>({
    competitorId: "manual",
    platform: "INSTAGRAM",
    handle: "",
    displayName: "",
    followerCount: undefined,
    profileUrl: "",
  });

  const accounts = useQuery({
    queryKey: ["ci-accounts", projectId],
    queryFn: () => api.listCompetitorAccounts(projectId!),
    enabled: !!projectId,
  });

  const addMut = useMutation({
    mutationFn: (body: AddCompetitorAccountBody) => api.addCompetitorAccount(projectId!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ci-accounts"] }); setShowAdd(false); setForm({ competitorId: "manual", platform: "INSTAGRAM", handle: "" }); },
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => api.removeCompetitorAccount(projectId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-accounts"] }),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.toggleCompetitorAccount(projectId!, id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-accounts"] }),
  });

  const [ingestForm, setIngestForm] = useState({ platform: "INSTAGRAM", contentType: "POST", caption: "", contentUrl: "", publishedAt: "" });
  const ingestMut = useMutation({
    mutationFn: (body: any) => api.ingestCompetitorContent(projectId!, { accountId: ingestAccountId!, ...ingestForm }),
    onSuccess: () => { setIngestAccountId(null); qc.invalidateQueries({ queryKey: ["ci-accounts"] }); },
  });

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-[#71717a]">Select a project.</div>;

  const grouped = (accounts.data ?? []).reduce<Record<string, typeof accounts.data>>((acc, a) => {
    const key = a.competitorId ?? "manual";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(a);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "#f4f4f5" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6366f118]">
              <Crosshair size={17} className="text-[#6366f1]" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-[#09090b]">Competitor Workspace</h1>
              <p className="text-[12px] text-[#71717a]">Add competitor social accounts and manually add their content for analysis.</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#09090b] px-3 py-1.5 text-[12px] font-medium text-white"
          >
            <Plus size={13} /> Add Account
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-4">
        {accounts.isLoading ? (
          <div className="py-12 text-center text-[12px] text-[#71717a]">Loading…</div>
        ) : !accounts.data?.length ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "#e4e4e7" }}>
            <Crosshair size={28} className="mx-auto mb-3 text-[#d4d4d8]" />
            <p className="text-[13px] font-medium text-[#09090b]">No competitor accounts yet</p>
            <p className="mt-1 text-[12px] text-[#71717a]">Add a competitor's Instagram, YouTube, or Facebook account to start tracking.</p>
            <button onClick={() => setShowAdd(true)} className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-4 py-2 text-[12px] font-medium text-white mx-auto">
              <Plus size={13} /> Add First Account
            </button>
          </div>
        ) : (
          Object.entries(grouped).map(([groupKey, accs]) => (
            <div key={groupKey} className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#f4f4f5" }}>
              <div className="border-b px-5 py-3 bg-[#fafafa]" style={{ borderColor: "#f4f4f5" }}>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#71717a]">
                  {groupKey === "manual" ? "Manually Added" : `Competitor: ${groupKey.slice(0, 8)}`}
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: "#f4f4f5" }}>
                {accs!.map((account) => (
                  <motion.div key={account.id} layout className="flex items-center gap-4 px-5 py-4">
                    <PlatformIcon platform={account.platform} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-[#09090b]">{account.displayName ?? account.handle}</span>
                        <span className="text-[10px] font-mono text-[#a1a1aa]">@{account.handle}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${account.isActive ? "bg-[#10b98118] text-[#10b981]" : "bg-[#f4f4f5] text-[#a1a1aa]"}`}>
                          {account.isActive ? "Active" : "Paused"}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[#71717a]">
                        <span>{account.platform}</span>
                        {account.followerCount && <span>{account.followerCount.toLocaleString()} followers</span>}
                        <span>{account._count?.content ?? 0} content items</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setIngestAccountId(account.id)}
                        className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-[#52525b] hover:bg-[#f4f4f5]"
                        style={{ borderColor: "#e4e4e7" }}
                        title="Add content manually"
                      >
                        <Upload size={11} /> Add Content
                      </button>
                      <button
                        onClick={() => toggleMut.mutate({ id: account.id, isActive: !account.isActive })}
                        className="rounded-md p-1.5 text-[#71717a] hover:bg-[#f4f4f5]"
                        title={account.isActive ? "Pause" : "Resume"}
                      >
                        {account.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        onClick={() => { if (confirm("Remove this account and all its content?")) removeMut.mutate(account.id); }}
                        className="rounded-md p-1.5 text-[#ef4444] hover:bg-[#fee2e2]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add account drawer */}
      <AnimatePresence>
        {showAdd && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowAdd(false)} />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl border bg-white p-6 shadow-2xl"
              style={{ borderColor: "#f4f4f5" }}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[14px] font-semibold text-[#09090b]">Add Competitor Account</h2>
                <button onClick={() => setShowAdd(false)} className="rounded-md p-1 hover:bg-[#f4f4f5]"><X size={16} /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Platform</label>
                  <select
                    value={form.platform}
                    onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]"
                    style={{ borderColor: "#e4e4e7" }}
                  >
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Handle / Username</label>
                  <input
                    value={form.handle}
                    onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                    placeholder="@username or channel-id"
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]"
                    style={{ borderColor: "#e4e4e7" }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Display Name (optional)</label>
                  <input
                    value={form.displayName ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="Competitor brand name"
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]"
                    style={{ borderColor: "#e4e4e7" }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Approximate Follower Count (optional)</label>
                  <input
                    type="number"
                    value={form.followerCount ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, followerCount: parseInt(e.target.value) || undefined }))}
                    placeholder="e.g. 50000"
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]"
                    style={{ borderColor: "#e4e4e7" }}
                  />
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border py-2 text-[12px] font-medium text-[#52525b]" style={{ borderColor: "#e4e4e7" }}>
                  Cancel
                </button>
                <button
                  onClick={() => addMut.mutate(form)}
                  disabled={!form.handle || addMut.isPending}
                  className="flex-1 rounded-lg bg-[#6366f1] py-2 text-[12px] font-medium text-white disabled:opacity-60"
                >
                  {addMut.isPending ? "Adding…" : "Add Account"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ingest content drawer */}
      <AnimatePresence>
        {ingestAccountId && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30" onClick={() => setIngestAccountId(null)} />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl border bg-white p-6 shadow-2xl"
              style={{ borderColor: "#f4f4f5" }}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[14px] font-semibold text-[#09090b]">Add Content Manually</h2>
                <button onClick={() => setIngestAccountId(null)} className="rounded-md p-1 hover:bg-[#f4f4f5]"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Content Type</label>
                  <select value={ingestForm.contentType} onChange={(e) => setIngestForm(f => ({ ...f, contentType: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]" style={{ borderColor: "#e4e4e7" }}>
                    {["POST", "REEL", "VIDEO", "CAROUSEL", "STORY"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Caption / Text</label>
                  <textarea value={ingestForm.caption} onChange={(e) => setIngestForm(f => ({ ...f, caption: e.target.value }))}
                    placeholder="Paste the post caption or description"
                    rows={4}
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1] resize-none" style={{ borderColor: "#e4e4e7" }} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Content URL (optional)</label>
                  <input value={ingestForm.contentUrl} onChange={(e) => setIngestForm(f => ({ ...f, contentUrl: e.target.value }))}
                    placeholder="https://www.instagram.com/p/..."
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]" style={{ borderColor: "#e4e4e7" }} />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setIngestAccountId(null)} className="flex-1 rounded-lg border py-2 text-[12px] font-medium text-[#52525b]" style={{ borderColor: "#e4e4e7" }}>Cancel</button>
                <button onClick={() => ingestMut.mutate({})} disabled={!ingestForm.caption || ingestMut.isPending}
                  className="flex-1 rounded-lg bg-[#6366f1] py-2 text-[12px] font-medium text-white disabled:opacity-60">
                  {ingestMut.isPending ? "Saving…" : "Add Content"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
