"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, X, Send, Star } from "lucide-react";
import { api, type AddCreatorBody, type Creator } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "var(--color-success-500)" },
  INACTIVE: { label: "Inactive", color: "var(--color-brand-500)" },
  DO_NOT_CONTACT: { label: "DNC", color: "var(--color-error-500)" },
};

const PLATFORMS = ["INSTAGRAM", "YOUTUBE", "FACEBOOK", "TIKTOK", "LINKEDIN"];
const CATEGORIES = ["FASHION", "BEAUTY", "LIFESTYLE", "FOOD", "TRAVEL", "TECH", "FINANCE", "FITNESS", "PARENTING", "BUSINESS"];

function CreatorCard({ creator, projectId, onOutreach }: { creator: Creator; projectId: string; onOutreach: (creator: Creator) => void }) {
  const status = STATUS_CONFIG[creator.status] ?? STATUS_CONFIG.ACTIVE;
  return (
    <div className="rounded-xl border bg-white p-5" style={{ borderColor: "var(--color-brand-100)" }}>
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-600 to-series-6 font-mono text-[12px] font-bold text-white">
          {creator.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-brand-950">{creator.name}</span>
            {creator.handle && <span className="font-mono text-[10px] text-brand-400">@{creator.handle}</span>}
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ color: status.color, background: `${status.color}18` }}>
              {status.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-brand-500">
            {creator.platform && <span>{creator.platform}</span>}
            {creator.category && <><span>·</span><span>{creator.category}</span></>}
            {creator.location && <><span>·</span><span>{creator.location}</span></>}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[11px]">
            {creator.followerCount && (
              <div>
                <span className="text-brand-400">Followers: </span>
                <span className="font-semibold text-brand-950">{creator.followerCount >= 1000 ? `${(creator.followerCount / 1000).toFixed(0)}K` : creator.followerCount}</span>
              </div>
            )}
            {creator.engagementRate && (
              <div>
                <span className="text-brand-400">Engagement: </span>
                <span className="font-semibold text-success-500">{creator.engagementRate.toFixed(1)}%</span>
              </div>
            )}
            {creator.averageBudget && (
              <div>
                <span className="text-brand-400">~Budget: </span>
                <span className="font-semibold text-brand-950">₹{creator.averageBudget.toLocaleString()}</span>
              </div>
            )}
          </div>
          {creator.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {creator.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-brand-100 px-2 py-0.5 text-[9.5px] font-medium text-brand-600">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => onOutreach(creator)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium text-accent-600 hover:bg-accent-600/10"
          style={{ borderColor: "var(--color-accent-50)" }}
        >
          <Send size={12} /> Outreach
        </button>
      </div>
    </div>
  );
}

export default function CreatorsPage() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [outreachCreator, setOutreachCreator] = useState<Creator | null>(null);
  const [outreachForm, setOutreachForm] = useState({ brandName: "", campaignName: "", product: "" });
  const [form, setForm] = useState<AddCreatorBody>({ name: "", handle: "", platform: "INSTAGRAM", category: "", location: "" });

  const creators = useQuery({
    queryKey: ["ci-creators", projectId],
    queryFn: () => api.listCreators(projectId!),
    enabled: !!projectId,
  });

  const addMut = useMutation({
    mutationFn: (body: AddCreatorBody) => api.addCreator(projectId!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ci-creators"] }); setShowAdd(false); setForm({ name: "", handle: "", platform: "INSTAGRAM" }); },
  });

  const outreachMut = useMutation({
    // Takes no argument: the payload is read from `outreachForm` state.
    mutationFn: () =>
      api.generateOutreachMessage(projectId!, { ...outreachForm, creatorId: outreachCreator!.id }),
    onSuccess: () => { setOutreachCreator(null); qc.invalidateQueries({ queryKey: ["ci-outreach"] }); },
  });

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-brand-500">Select a project.</div>;

  return (
    <div className="min-h-screen bg-brand-50">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "var(--color-brand-100)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-600/10">
              <Users size={17} className="text-accent-600" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-brand-950">Creator CRM</h1>
              <p className="text-[12px] text-brand-500">Discover, manage, and collaborate with creators and influencers.</p>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-[12px] font-medium text-white">
            <Plus size={13} /> Add Creator
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6 space-y-3">
        {creators.isLoading ? (
          <div className="py-12 text-center text-[12px] text-brand-500">Loading…</div>
        ) : !creators.data?.length ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
            <Users size={28} className="mx-auto mb-3 text-brand-300" />
            <p className="text-[13px] font-medium text-brand-950">No creators yet</p>
            <p className="mt-1 text-[12px] text-brand-500">Add creators to your CRM to manage collaborations and AI-powered matching.</p>
            <button onClick={() => setShowAdd(true)} className="mt-4 mx-auto flex items-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2 text-[12px] font-medium text-white">
              <Plus size={13} /> Add First Creator
            </button>
          </div>
        ) : (
          creators.data.map((creator, i) => (
            <motion.div key={creator.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <CreatorCard creator={creator} projectId={projectId} onOutreach={setOutreachCreator} />
            </motion.div>
          ))
        )}
      </div>

      {/* Add Creator Drawer */}
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
                <h2 className="text-[14px] font-semibold text-brand-950">Add Creator</h2>
                <button onClick={() => setShowAdd(false)} className="rounded-md p-1 hover:bg-brand-100"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Name *", key: "name", placeholder: "Creator's real name or brand name" },
                  { label: "Handle / Username", key: "handle", placeholder: "@username" },
                  { label: "Email", key: "email", placeholder: "creator@example.com" },
                  { label: "Location", key: "location", placeholder: "e.g. Mumbai, India" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="mb-1 block text-[11px] font-medium text-brand-600">{label}</label>
                    <input value={form[key as keyof typeof form] ?? ""} onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder} className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }} />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-brand-600">Platform</label>
                    <select value={form.platform} onChange={(e) => setForm(f => ({ ...f, platform: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }}>
                      {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-brand-600">Category</label>
                    <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }}>
                      <option value="">Select…</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-brand-600">Followers</label>
                    <input type="number" placeholder="e.g. 50000" onChange={(e) => setForm(f => ({ ...f, followerCount: parseInt(e.target.value) || undefined }))}
                      className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-brand-600">Avg Budget (₹)</label>
                    <input type="number" placeholder="e.g. 25000" onChange={(e) => setForm(f => ({ ...f, averageBudget: parseInt(e.target.value) || undefined }))}
                      className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }} />
                  </div>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border py-2 text-[12px] font-medium text-brand-600" style={{ borderColor: "var(--color-brand-200)" }}>Cancel</button>
                <button onClick={() => addMut.mutate(form)} disabled={!form.name || addMut.isPending}
                  className="flex-1 rounded-lg bg-accent-600 py-2 text-[12px] font-medium text-white disabled:opacity-60">
                  {addMut.isPending ? "Adding…" : "Add Creator"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate Outreach Drawer */}
      <AnimatePresence>
        {outreachCreator && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30" onClick={() => setOutreachCreator(null)} />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl border bg-white p-6 shadow-2xl"
              style={{ borderColor: "var(--color-brand-100)" }}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] font-semibold text-brand-950">Generate Outreach</h2>
                <button onClick={() => setOutreachCreator(null)} className="rounded-md p-1 hover:bg-brand-100"><X size={16} /></button>
              </div>
              <p className="mb-4 text-[11.5px] text-brand-500">
                AI will draft a collaboration request for <strong className="text-brand-950">{outreachCreator.name}</strong>. You must approve it before it&apos;s sent.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-brand-600">Your Brand Name *</label>
                  <input value={outreachForm.brandName} onChange={(e) => setOutreachForm(f => ({ ...f, brandName: e.target.value }))}
                    placeholder="e.g. Kalyan Jewellers" className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-brand-600">Campaign Name</label>
                  <input value={outreachForm.campaignName} onChange={(e) => setOutreachForm(f => ({ ...f, campaignName: e.target.value }))}
                    placeholder="e.g. Diwali Wedding Collection" className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-brand-600">Product / Service</label>
                  <input value={outreachForm.product} onChange={(e) => setOutreachForm(f => ({ ...f, product: e.target.value }))}
                    placeholder="e.g. Diamond bridal jewellery" className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }} />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setOutreachCreator(null)} className="flex-1 rounded-lg border py-2 text-[12px] font-medium text-brand-600" style={{ borderColor: "var(--color-brand-200)" }}>Cancel</button>
                <button onClick={() => outreachMut.mutate()} disabled={!outreachForm.brandName || outreachMut.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-accent-600 py-2 text-[12px] font-medium text-white disabled:opacity-60">
                  <Send size={12} /> {outreachMut.isPending ? "Drafting…" : "Draft Message"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
