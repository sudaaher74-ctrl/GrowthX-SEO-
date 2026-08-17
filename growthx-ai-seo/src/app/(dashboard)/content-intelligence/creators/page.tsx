"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, X, Send, Star } from "lucide-react";
import { api, type AddCreatorBody, type Creator } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "#10b981" },
  INACTIVE: { label: "Inactive", color: "#71717a" },
  DO_NOT_CONTACT: { label: "DNC", color: "#ef4444" },
};

const PLATFORMS = ["INSTAGRAM", "YOUTUBE", "FACEBOOK", "TIKTOK", "LINKEDIN"];
const CATEGORIES = ["FASHION", "BEAUTY", "LIFESTYLE", "FOOD", "TRAVEL", "TECH", "FINANCE", "FITNESS", "PARENTING", "BUSINESS"];

function CreatorCard({ creator, projectId, onOutreach }: { creator: Creator; projectId: string; onOutreach: (creator: Creator) => void }) {
  const status = STATUS_CONFIG[creator.status] ?? STATUS_CONFIG.ACTIVE;
  return (
    <div className="rounded-xl border bg-white p-5" style={{ borderColor: "#f4f4f5" }}>
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] font-mono text-[12px] font-bold text-white">
          {creator.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-[#09090b]">{creator.name}</span>
            {creator.handle && <span className="font-mono text-[10px] text-[#a1a1aa]">@{creator.handle}</span>}
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ color: status.color, background: `${status.color}18` }}>
              {status.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[#71717a]">
            {creator.platform && <span>{creator.platform}</span>}
            {creator.category && <><span>·</span><span>{creator.category}</span></>}
            {creator.location && <><span>·</span><span>{creator.location}</span></>}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[11px]">
            {creator.followerCount && (
              <div>
                <span className="text-[#a1a1aa]">Followers: </span>
                <span className="font-semibold text-[#09090b]">{creator.followerCount >= 1000 ? `${(creator.followerCount / 1000).toFixed(0)}K` : creator.followerCount}</span>
              </div>
            )}
            {creator.engagementRate && (
              <div>
                <span className="text-[#a1a1aa]">Engagement: </span>
                <span className="font-semibold text-[#10b981]">{creator.engagementRate.toFixed(1)}%</span>
              </div>
            )}
            {creator.averageBudget && (
              <div>
                <span className="text-[#a1a1aa]">~Budget: </span>
                <span className="font-semibold text-[#09090b]">₹{creator.averageBudget.toLocaleString()}</span>
              </div>
            )}
          </div>
          {creator.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {creator.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[9.5px] font-medium text-[#52525b]">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => onOutreach(creator)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium text-[#6366f1] hover:bg-[#6366f118]"
          style={{ borderColor: "#c7d2fe" }}
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
    mutationFn: (body: any) => api.generateOutreachMessage(projectId!, { ...outreachForm, creatorId: outreachCreator!.id }),
    onSuccess: () => { setOutreachCreator(null); qc.invalidateQueries({ queryKey: ["ci-outreach"] }); },
  });

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-[#71717a]">Select a project.</div>;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "#f4f4f5" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6366f118]">
              <Users size={17} className="text-[#6366f1]" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-[#09090b]">Creator CRM</h1>
              <p className="text-[12px] text-[#71717a]">Discover, manage, and collaborate with creators and influencers.</p>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-lg bg-[#09090b] px-3 py-1.5 text-[12px] font-medium text-white">
            <Plus size={13} /> Add Creator
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6 space-y-3">
        {creators.isLoading ? (
          <div className="py-12 text-center text-[12px] text-[#71717a]">Loading…</div>
        ) : !creators.data?.length ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "#e4e4e7" }}>
            <Users size={28} className="mx-auto mb-3 text-[#d4d4d8]" />
            <p className="text-[13px] font-medium text-[#09090b]">No creators yet</p>
            <p className="mt-1 text-[12px] text-[#71717a]">Add creators to your CRM to manage collaborations and AI-powered matching.</p>
            <button onClick={() => setShowAdd(true)} className="mt-4 mx-auto flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-4 py-2 text-[12px] font-medium text-white">
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
              style={{ borderColor: "#f4f4f5" }}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[14px] font-semibold text-[#09090b]">Add Creator</h2>
                <button onClick={() => setShowAdd(false)} className="rounded-md p-1 hover:bg-[#f4f4f5]"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Name *", key: "name", placeholder: "Creator's real name or brand name" },
                  { label: "Handle / Username", key: "handle", placeholder: "@username" },
                  { label: "Email", key: "email", placeholder: "creator@example.com" },
                  { label: "Location", key: "location", placeholder: "e.g. Mumbai, India" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="mb-1 block text-[11px] font-medium text-[#52525b]">{label}</label>
                    <input value={(form as any)[key] ?? ""} onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder} className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]" style={{ borderColor: "#e4e4e7" }} />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Platform</label>
                    <select value={form.platform} onChange={(e) => setForm(f => ({ ...f, platform: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]" style={{ borderColor: "#e4e4e7" }}>
                      {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Category</label>
                    <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]" style={{ borderColor: "#e4e4e7" }}>
                      <option value="">Select…</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Followers</label>
                    <input type="number" placeholder="e.g. 50000" onChange={(e) => setForm(f => ({ ...f, followerCount: parseInt(e.target.value) || undefined }))}
                      className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]" style={{ borderColor: "#e4e4e7" }} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Avg Budget (₹)</label>
                    <input type="number" placeholder="e.g. 25000" onChange={(e) => setForm(f => ({ ...f, averageBudget: parseInt(e.target.value) || undefined }))}
                      className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]" style={{ borderColor: "#e4e4e7" }} />
                  </div>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border py-2 text-[12px] font-medium text-[#52525b]" style={{ borderColor: "#e4e4e7" }}>Cancel</button>
                <button onClick={() => addMut.mutate(form)} disabled={!form.name || addMut.isPending}
                  className="flex-1 rounded-lg bg-[#6366f1] py-2 text-[12px] font-medium text-white disabled:opacity-60">
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
              style={{ borderColor: "#f4f4f5" }}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] font-semibold text-[#09090b]">Generate Outreach</h2>
                <button onClick={() => setOutreachCreator(null)} className="rounded-md p-1 hover:bg-[#f4f4f5]"><X size={16} /></button>
              </div>
              <p className="mb-4 text-[11.5px] text-[#71717a]">
                AI will draft a collaboration request for <strong className="text-[#09090b]">{outreachCreator.name}</strong>. You must approve it before it's sent.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Your Brand Name *</label>
                  <input value={outreachForm.brandName} onChange={(e) => setOutreachForm(f => ({ ...f, brandName: e.target.value }))}
                    placeholder="e.g. Kalyan Jewellers" className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]" style={{ borderColor: "#e4e4e7" }} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Campaign Name</label>
                  <input value={outreachForm.campaignName} onChange={(e) => setOutreachForm(f => ({ ...f, campaignName: e.target.value }))}
                    placeholder="e.g. Diwali Wedding Collection" className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]" style={{ borderColor: "#e4e4e7" }} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Product / Service</label>
                  <input value={outreachForm.product} onChange={(e) => setOutreachForm(f => ({ ...f, product: e.target.value }))}
                    placeholder="e.g. Diamond bridal jewellery" className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]" style={{ borderColor: "#e4e4e7" }} />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setOutreachCreator(null)} className="flex-1 rounded-lg border py-2 text-[12px] font-medium text-[#52525b]" style={{ borderColor: "#e4e4e7" }}>Cancel</button>
                <button onClick={() => outreachMut.mutate({})} disabled={!outreachForm.brandName || outreachMut.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#6366f1] py-2 text-[12px] font-medium text-white disabled:opacity-60">
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
