"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Plus, X, RefreshCw, Check, Clock, Users } from "lucide-react";
import { api, type CreateCampaignBody, type CICampaign } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  PLANNING: { color: "#f59e0b", bg: "#fef3c7" },
  ACTIVE: { color: "#10b981", bg: "#d1fae5" },
  PAUSED: { color: "#71717a", bg: "#f4f4f5" },
  COMPLETED: { color: "#0ea5e9", bg: "#e0f2fe" },
  ARCHIVED: { color: "#a1a1aa", bg: "#f4f4f5" },
};

const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "YOUTUBE", "TIKTOK"];

function CampaignCard({ campaign, onMatchCreators }: { campaign: CICampaign; onMatchCreators: (id: string) => void }) {
  const status = STATUS_COLORS[campaign.status] ?? STATUS_COLORS.PLANNING;
  return (
    <div className="rounded-xl border bg-white p-5" style={{ borderColor: "#f4f4f5" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[13px] font-semibold text-[#09090b]">{campaign.name}</h3>
            <span className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold" style={{ color: status.color, background: status.bg }}>
              {campaign.status}
            </span>
          </div>
          {campaign.objective && <p className="mt-1 text-[11.5px] text-[#6366f1]">{campaign.objective}</p>}
          {campaign.productFocus && <p className="mt-0.5 text-[11px] text-[#71717a]">Product: {campaign.productFocus}</p>}
          {campaign.targetAudience && <p className="mt-0.5 text-[11px] text-[#71717a]">Audience: {campaign.targetAudience}</p>}

          <div className="mt-3 flex flex-wrap gap-2 text-[10.5px]">
            {campaign.platforms.map((p) => (
              <span key={p} className="rounded-full bg-[#f4f4f5] px-2 py-0.5 font-medium text-[#52525b]">{p}</span>
            ))}
          </div>

          {(campaign.startDate || campaign.endDate) && (
            <div className="mt-2 flex items-center gap-1 text-[10.5px] text-[#a1a1aa]">
              <Clock size={11} />
              {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : "—"}
              {" → "}
              {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : "—"}
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-3 text-right">
          {campaign.budget && (
            <div>
              <div className="text-[9px] text-[#a1a1aa]">Budget</div>
              <div className="text-[13px] font-bold text-[#09090b]">₹{campaign.budget.toLocaleString()}</div>
            </div>
          )}
          <div className="flex gap-3">
            {campaign._count && (
              <>
                <div>
                  <div className="text-[9px] text-[#a1a1aa]">Content</div>
                  <div className="text-[12px] font-semibold text-[#09090b]">{campaign._count.calendarItems}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#a1a1aa]">Creators</div>
                  <div className="text-[12px] font-semibold text-[#09090b]">{campaign._count.creatorMatches}</div>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => onMatchCreators(campaign.id)}
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium text-[#6366f1] hover:bg-[#6366f118]"
            style={{ borderColor: "#c7d2fe" }}
          >
            <Users size={12} /> Match Creators
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateCampaignBody>({ name: "", objective: "", productFocus: "", targetAudience: "", platforms: ["INSTAGRAM"] });

  const campaigns = useQuery({
    queryKey: ["ci-campaigns", projectId],
    queryFn: () => api.listCICampaigns(projectId!),
    enabled: !!projectId,
  });

  const createMut = useMutation({
    mutationFn: (body: CreateCampaignBody) => api.createCICampaign(projectId!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ci-campaigns"] }); setShowCreate(false); },
  });

  const matchMut = useMutation({
    mutationFn: (campaignId: string) => api.matchCreatorsToCampaign(projectId!, campaignId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-campaigns"] }),
  });

  const togglePlatform = (p: string) => {
    setForm(f => ({
      ...f,
      platforms: f.platforms?.includes(p) ? f.platforms.filter(x => x !== p) : [...(f.platforms ?? []), p],
    }));
  };

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-[#71717a]">Select a project.</div>;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "#f4f4f5" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10b98118]">
              <Zap size={17} className="text-[#10b981]" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-[#09090b]">Campaign Workspace</h1>
              <p className="text-[12px] text-[#71717a]">Manage campaigns, brief creators, and link content.</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg bg-[#09090b] px-3 py-1.5 text-[12px] font-medium text-white">
            <Plus size={13} /> New Campaign
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-4">
        {campaigns.isLoading ? (
          <div className="py-12 text-center text-[12px] text-[#71717a]">Loading…</div>
        ) : !campaigns.data?.length ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "#e4e4e7" }}>
            <Zap size={28} className="mx-auto mb-3 text-[#d4d4d8]" />
            <p className="text-[13px] font-medium text-[#09090b]">No campaigns yet</p>
            <p className="mt-1 text-[12px] text-[#71717a]">Create a campaign to organize your content and creators.</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 mx-auto flex items-center gap-1.5 rounded-lg bg-[#10b981] px-4 py-2 text-[12px] font-medium text-white">
              <Plus size={13} /> Create Campaign
            </button>
          </div>
        ) : (
          campaigns.data.map((campaign, i) => (
            <motion.div key={campaign.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <CampaignCard campaign={campaign} onMatchCreators={(id) => matchMut.mutate(id)} />
            </motion.div>
          ))
        )}
      </div>

      {/* Create Campaign Drawer */}
      <AnimatePresence>
        {showCreate && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowCreate(false)} />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl border bg-white p-6 shadow-2xl"
              style={{ borderColor: "#f4f4f5" }}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[14px] font-semibold text-[#09090b]">New Campaign</h2>
                <button onClick={() => setShowCreate(false)} className="rounded-md p-1 hover:bg-[#f4f4f5]"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Campaign Name *", key: "name", placeholder: "e.g. Diwali Collection 2025" },
                  { label: "Objective", key: "objective", placeholder: "e.g. Drive sales of new collection" },
                  { label: "Product Focus", key: "productFocus", placeholder: "e.g. Diamond necklaces" },
                  { label: "Target Audience", key: "targetAudience", placeholder: "e.g. Women 25-40, metro cities" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="mb-1 block text-[11px] font-medium text-[#52525b]">{label}</label>
                    <input value={(form as any)[key] ?? ""} onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder} className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]" style={{ borderColor: "#e4e4e7" }} />
                  </div>
                ))}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[#52525b]">Platforms</label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p}
                        onClick={() => togglePlatform(p)}
                        className={`rounded-full px-2.5 py-1 text-[10.5px] font-medium transition ${form.platforms?.includes(p) ? "bg-[#6366f1] text-white" : "bg-[#f4f4f5] text-[#52525b]"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52525b]">Budget (₹, optional)</label>
                  <input type="number" placeholder="e.g. 50000" onChange={(e) => setForm(f => ({ ...f, budget: parseInt(e.target.value) || undefined }))}
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[#6366f1]" style={{ borderColor: "#e4e4e7" }} />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 rounded-lg border py-2 text-[12px] font-medium text-[#52525b]" style={{ borderColor: "#e4e4e7" }}>Cancel</button>
                <button onClick={() => createMut.mutate(form)} disabled={!form.name || createMut.isPending}
                  className="flex-1 rounded-lg bg-[#10b981] py-2 text-[12px] font-medium text-white disabled:opacity-60">
                  {createMut.isPending ? "Creating…" : "Create Campaign"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
