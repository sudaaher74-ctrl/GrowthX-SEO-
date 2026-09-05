"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, Plus, Trash2, Eye, EyeOff, ExternalLink, Globe, Upload, X, Sparkles, MessageSquare, Heart, CheckCircle2, Tag, Zap, BarChart2 } from "lucide-react";
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
  return <Icon size={14} style={{ color: PLATFORM_COLORS[platform] ?? "var(--color-brand-500)" }} />;
}

export default function CompetitorWorkspacePage() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"ACCOUNTS" | "FEED">("ACCOUNTS");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [ingestAccountId, setIngestAccountId] = useState<string | null>(null);
  const [classifyResult, setClassifyResult] = useState<string | null>(null);

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

  const contentFeed = useQuery({
    queryKey: ["ci-content", projectId, selectedPlatform],
    queryFn: () =>
      api.listCompetitorContent(projectId!, {
        platform: selectedPlatform === "ALL" ? undefined : selectedPlatform,
        limit: 50,
      }),
    enabled: !!projectId,
  });

  const addMut = useMutation({
    mutationFn: (body: AddCompetitorAccountBody) => api.addCompetitorAccount(projectId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ci-accounts"] });
      setShowAdd(false);
      setForm({ competitorId: "manual", platform: "INSTAGRAM", handle: "" });
    },
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => api.removeCompetitorAccount(projectId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ci-accounts"] });
      qc.invalidateQueries({ queryKey: ["ci-content"] });
    },
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.toggleCompetitorAccount(projectId!, id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-accounts"] }),
  });

  const classifyMut = useMutation({
    mutationFn: () => api.classifyContent(projectId!),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["ci-content"] });
      qc.invalidateQueries({ queryKey: ["ci-accounts"] });
      setClassifyResult(`Successfully classified ${res.classified} of ${res.total} content items.`);
      setTimeout(() => setClassifyResult(null), 6000);
    },
  });

  const [ingestForm, setIngestForm] = useState({
    platform: "INSTAGRAM",
    contentType: "POST",
    caption: "",
    contentUrl: "",
    publishedAt: "",
  });
  const ingestMut = useMutation({
    // Takes no argument: the payload is read from `ingestForm` state.
    mutationFn: () =>
      api.ingestCompetitorContent(projectId!, { accountId: ingestAccountId!, ...ingestForm }),
    onSuccess: () => {
      setIngestAccountId(null);
      setIngestForm({ platform: "INSTAGRAM", contentType: "POST", caption: "", contentUrl: "", publishedAt: "" });
      qc.invalidateQueries({ queryKey: ["ci-accounts"] });
      qc.invalidateQueries({ queryKey: ["ci-content"] });
    },
  });

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-brand-500">Select a project.</div>;

  const grouped = (accounts.data ?? []).reduce<Record<string, typeof accounts.data>>((acc, a) => {
    const key = a.competitorId ?? "manual";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(a);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-brand-50">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "var(--color-brand-100)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-600/10">
              <Crosshair size={17} className="text-accent-600" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-brand-950">Competitor Social Workspace</h1>
              <p className="text-[12px] text-brand-500">Track competitor social profiles, ingest content, and run automated AI classification.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => classifyMut.mutate()}
              disabled={classifyMut.isPending}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium text-brand-700 bg-white hover:bg-brand-50 disabled:opacity-60 transition shadow-2xs"
              style={{ borderColor: "var(--color-brand-200)" }}
              title="Classify unclassified competitor content"
            >
              <Sparkles size={13} className={classifyMut.isPending ? "animate-spin text-accent-600" : "text-accent-600"} />
              <span>{classifyMut.isPending ? "Classifying…" : "Classify Content"}</span>
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-[12px] font-medium text-white shadow-2xs hover:bg-brand-900 transition"
            >
              <Plus size={13} /> Add Account
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6">
        {/* Classification feedback message */}
        {classifyResult && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-medium text-emerald-800">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>{classifyResult}</span>
          </div>
        )}

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 border-b pb-3 mb-6" style={{ borderColor: "var(--color-brand-200)" }}>
          <button
            onClick={() => setActiveTab("ACCOUNTS")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
              activeTab === "ACCOUNTS"
                ? "bg-brand-950 text-white font-semibold shadow-2xs"
                : "text-brand-600 hover:bg-brand-100"
            }`}
          >
            <Crosshair size={13} />
            <span>Tracked Accounts ({accounts.data?.length ?? 0})</span>
          </button>
          <button
            onClick={() => setActiveTab("FEED")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
              activeTab === "FEED"
                ? "bg-brand-950 text-white font-semibold shadow-2xs"
                : "text-brand-600 hover:bg-brand-100"
            }`}
          >
            <BarChart2 size={13} />
            <span>Content Feed & AI Analysis ({contentFeed.data?.length ?? 0})</span>
          </button>
        </div>

        {activeTab === "ACCOUNTS" && (
          <div className="space-y-4">
            {accounts.isLoading ? (
              <div className="py-12 text-center text-[12px] text-brand-500">Loading accounts…</div>
            ) : !accounts.data?.length ? (
              <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
                <Crosshair size={28} className="mx-auto mb-3 text-brand-300" />
                <p className="text-[13px] font-medium text-brand-950">No competitor accounts yet</p>
                <p className="mt-1 text-[12px] text-brand-500">Add a competitor&apos;s Instagram, YouTube, or Facebook account to start tracking.</p>
                <button onClick={() => setShowAdd(true)} className="mt-4 flex items-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2 text-[12px] font-medium text-white mx-auto">
                  <Plus size={13} /> Add First Account
                </button>
              </div>
            ) : (
              Object.entries(grouped).map(([groupKey, accs]) => (
                <div key={groupKey} className="rounded-xl border bg-white overflow-hidden shadow-2xs" style={{ borderColor: "var(--color-brand-100)" }}>
                  <div className="border-b px-5 py-3 bg-brand-50" style={{ borderColor: "var(--color-brand-100)" }}>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                      {groupKey === "manual" ? "Manually Added Accounts" : `Competitor: ${groupKey.slice(0, 8)}`}
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: "var(--color-brand-100)" }}>
                    {accs!.map((account) => (
                      <motion.div key={account.id} layout className="flex items-center gap-4 px-5 py-4">
                        <PlatformIcon platform={account.platform} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-brand-950">{account.displayName ?? account.handle}</span>
                            <span className="text-[10px] font-mono text-brand-400">@{account.handle}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${account.isActive ? "bg-[#10b98118] text-success-500" : "bg-brand-100 text-brand-400"}`}>
                              {account.isActive ? "Active" : "Paused"}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-brand-500">
                            <span>{account.platform}</span>
                            {account.followerCount && <span>{account.followerCount.toLocaleString()} followers</span>}
                            <span>{account._count?.content ?? 0} content items</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setIngestAccountId(account.id)}
                            className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-brand-600 hover:bg-brand-100"
                            style={{ borderColor: "var(--color-brand-200)" }}
                            title="Add content manually"
                          >
                            <Upload size={11} /> Add Content
                          </button>
                          <button
                            onClick={() => toggleMut.mutate({ id: account.id, isActive: !account.isActive })}
                            className="rounded-md p-1.5 text-brand-500 hover:bg-brand-100"
                            title={account.isActive ? "Pause" : "Resume"}
                          >
                            {account.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          <button
                            onClick={() => { if (confirm("Remove this account and all its content?")) removeMut.mutate(account.id); }}
                            className="rounded-md p-1.5 text-error-500 hover:bg-error-50"
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
        )}

        {/* Content Feed with AI Classification Badges */}
        {activeTab === "FEED" && (
          <div className="space-y-4">
            {/* Platform filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-brand-400 mr-1">Platform:</span>
              {["ALL", ...PLATFORMS].map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPlatform(p)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                    selectedPlatform === p
                      ? "bg-brand-950 text-white font-semibold shadow-2xs"
                      : "bg-white border text-brand-600 hover:bg-brand-50"
                  }`}
                  style={{ borderColor: selectedPlatform === p ? undefined : "var(--color-brand-200)" }}
                >
                  {p}
                </button>
              ))}
            </div>

            {contentFeed.isLoading ? (
              <div className="py-12 text-center text-[12px] text-brand-500">Loading competitor content…</div>
            ) : !contentFeed.data?.length ? (
              <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
                <BarChart2 size={28} className="mx-auto mb-3 text-brand-300" />
                <p className="text-[13px] font-medium text-brand-950">No content items found</p>
                <p className="mt-1 text-[12px] text-brand-500">Add posts manually from the Tracked Accounts tab or run ingestion.</p>
                <button
                  onClick={() => setActiveTab("ACCOUNTS")}
                  className="mt-4 flex items-center gap-1.5 rounded-lg bg-brand-950 px-4 py-2 text-[12px] font-medium text-white mx-auto shadow-2xs"
                >
                  Go to Tracked Accounts
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {contentFeed.data.map((item) => {
                  const hasClassification = !!item.classification;
                  const cls = item.classification;

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border bg-white p-4 shadow-2xs space-y-3"
                      style={{ borderColor: "var(--color-brand-200)" }}
                    >
                      {/* Post Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <PlatformIcon platform={item.platform} />
                          <span className="text-[12px] font-semibold text-brand-950">
                            {item.account?.displayName ?? item.account?.handle ?? item.platform}
                          </span>
                          {item.contentType && (
                            <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-brand-600">
                              {item.contentType}
                            </span>
                          )}
                          {item.publishedAt && (
                            <span className="text-[10px] text-brand-400">
                              {new Date(item.publishedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>

                        {item.contentUrl && (
                          <a
                            href={item.contentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-accent-600 transition"
                          >
                            <span>Open</span>
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>

                      {/* Post Caption / Content */}
                      {item.caption && (
                        <p className="text-[12px] text-brand-700 leading-relaxed whitespace-pre-line">
                          {item.caption.length > 280 ? `${item.caption.slice(0, 280)}…` : item.caption}
                        </p>
                      )}

                      {/* Engagement Metrics Strip */}
                      <div className="flex items-center gap-4 text-[11px] text-brand-500 pt-1 border-t border-brand-50">
                        {item.viewsCount != null && (
                          <span className="flex items-center gap-1 font-mono">
                            <Eye size={12} className="text-brand-400" />
                            {item.viewsCount.toLocaleString()} views
                          </span>
                        )}
                        {item.likesCount != null && (
                          <span className="flex items-center gap-1 font-mono">
                            <Heart size={12} className="text-rose-500" />
                            {item.likesCount.toLocaleString()} likes
                          </span>
                        )}
                        {item.commentsCount != null && (
                          <span className="flex items-center gap-1 font-mono">
                            <MessageSquare size={12} className="text-blue-500" />
                            {item.commentsCount.toLocaleString()} comments
                          </span>
                        )}
                      </div>

                      {/* AI Classification Badges */}
                      {hasClassification && cls ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-brand-100">
                          {cls.contentCategory && (
                            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                              <Tag size={10} />
                              {cls.contentCategory}
                            </span>
                          )}
                          {(cls.visualFormat || cls.format) && (
                            <span className="rounded bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                              {cls.visualFormat ?? cls.format}
                            </span>
                          )}
                          {cls.hookType && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              <Zap size={10} />
                              Hook: {cls.hookType}
                            </span>
                          )}
                          {cls.creativityScore != null && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              <Sparkles size={10} />
                              {cls.creativityScore}/100
                            </span>
                          )}
                          {cls.storytellingStyle && (
                            <span className="rounded bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                              Style: {cls.storytellingStyle}
                            </span>
                          )}
                          {cls.ctaType && (
                            <span className="rounded bg-brand-100 border border-brand-200 px-2 py-0.5 text-[10px] font-medium text-brand-600">
                              CTA: {cls.ctaType}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-2 border-t border-brand-100 text-[11px]">
                          <span className="text-brand-400 flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-brand-300" />
                            Unclassified post
                          </span>
                          <button
                            onClick={() => classifyMut.mutate()}
                            disabled={classifyMut.isPending}
                            className="text-accent-600 hover:text-accent-700 font-medium"
                          >
                            Classify this post →
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add account drawer */}
      <AnimatePresence>
        {showAdd && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowAdd(false)} />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl border bg-white p-6 shadow-2xl"
              style={{ borderColor: "var(--color-brand-100)" }}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[14px] font-semibold text-brand-950">Add Competitor Account</h2>
                <button onClick={() => setShowAdd(false)} className="rounded-md p-1 hover:bg-brand-100"><X size={16} /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-brand-600">Platform</label>
                  <select
                    value={form.platform}
                    onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600"
                    style={{ borderColor: "var(--color-brand-200)" }}
                  >
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-brand-600">Handle / Username</label>
                  <input
                    value={form.handle}
                    onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                    placeholder="@username or channel-id"
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600"
                    style={{ borderColor: "var(--color-brand-200)" }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-brand-600">Display Name (optional)</label>
                  <input
                    value={form.displayName ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="Competitor brand name"
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600"
                    style={{ borderColor: "var(--color-brand-200)" }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-brand-600">Approximate Follower Count (optional)</label>
                  <input
                    type="number"
                    value={form.followerCount ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, followerCount: parseInt(e.target.value) || undefined }))}
                    placeholder="e.g. 50000"
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600"
                    style={{ borderColor: "var(--color-brand-200)" }}
                  />
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border py-2 text-[12px] font-medium text-brand-600" style={{ borderColor: "var(--color-brand-200)" }}>
                  Cancel
                </button>
                <button
                  onClick={() => addMut.mutate(form)}
                  disabled={!form.handle || addMut.isPending}
                  className="flex-1 rounded-lg bg-accent-600 py-2 text-[12px] font-medium text-white disabled:opacity-60"
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
              style={{ borderColor: "var(--color-brand-100)" }}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[14px] font-semibold text-brand-950">Add Content Manually</h2>
                <button onClick={() => setIngestAccountId(null)} className="rounded-md p-1 hover:bg-brand-100"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-brand-600">Content Type</label>
                  <select value={ingestForm.contentType} onChange={(e) => setIngestForm(f => ({ ...f, contentType: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }}>
                    {["POST", "REEL", "VIDEO", "CAROUSEL", "STORY"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-brand-600">Caption / Text</label>
                  <textarea value={ingestForm.caption} onChange={(e) => setIngestForm(f => ({ ...f, caption: e.target.value }))}
                    placeholder="Paste the post caption or description"
                    rows={4}
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600 resize-none" style={{ borderColor: "var(--color-brand-200)" }} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-brand-600">Content URL (optional)</label>
                  <input value={ingestForm.contentUrl} onChange={(e) => setIngestForm(f => ({ ...f, contentUrl: e.target.value }))}
                    placeholder="https://www.instagram.com/p/..."
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }} />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setIngestAccountId(null)} className="flex-1 rounded-lg border py-2 text-[12px] font-medium text-brand-600" style={{ borderColor: "var(--color-brand-200)" }}>Cancel</button>
                <button onClick={() => ingestMut.mutate()} disabled={!ingestForm.caption || ingestMut.isPending}
                  className="flex-1 rounded-lg bg-accent-600 py-2 text-[12px] font-medium text-white disabled:opacity-60">
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
