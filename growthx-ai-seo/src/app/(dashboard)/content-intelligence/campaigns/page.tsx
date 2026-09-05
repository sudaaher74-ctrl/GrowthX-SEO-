"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Plus, X, Clock, Users } from "lucide-react";
import { api, type CreateCampaignBody, type CICampaign } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  PLANNING: { color: "var(--color-warning-500)", bg: "var(--color-warning-50)" },
  ACTIVE: { color: "var(--color-success-500)", bg: "var(--color-success-50)" },
  PAUSED: { color: "var(--color-brand-500)", bg: "var(--color-brand-100)" },
  COMPLETED: { color: "var(--color-series-2)", bg: "var(--color-accent-50)" },
  ARCHIVED: { color: "var(--color-brand-400)", bg: "var(--color-brand-100)" },
};

const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "YOUTUBE", "TIKTOK"];

function CampaignCard({ campaign, onMatchCreators }: { campaign: CICampaign; onMatchCreators: (id: string) => void }) {
  const status = STATUS_COLORS[campaign.status] ?? STATUS_COLORS.PLANNING;
  return (
    <div className="rounded-xl border bg-white p-5" style={{ borderColor: "var(--color-brand-100)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[13px] font-semibold text-brand-950">{campaign.name}</h3>
            <span className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold" style={{ color: status.color, background: status.bg }}>
              {campaign.status}
            </span>
          </div>
          {campaign.objective && <p className="mt-1 text-[11.5px] text-accent-600">{campaign.objective}</p>}
          {campaign.productFocus && <p className="mt-0.5 text-[11px] text-brand-500">Product: {campaign.productFocus}</p>}
          {campaign.targetAudience && <p className="mt-0.5 text-[11px] text-brand-500">Audience: {campaign.targetAudience}</p>}

          <div className="mt-3 flex flex-wrap gap-2 text-[10.5px]">
            {campaign.platforms.map((p) => (
              <span key={p} className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-600">{p}</span>
            ))}
          </div>

          {(campaign.startDate || campaign.endDate) && (
            <div className="mt-2 flex items-center gap-1 text-[10.5px] text-brand-400">
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
              <div className="text-[9px] text-brand-400">Budget</div>
              <div className="text-[13px] font-bold text-brand-950">₹{campaign.budget.toLocaleString()}</div>
            </div>
          )}
          <div className="flex gap-3">
            {campaign._count && (
              <>
                <div>
                  <div className="text-[9px] text-brand-400">Content</div>
                  <div className="text-[12px] font-semibold text-brand-950">{campaign._count.calendarItems}</div>
                </div>
                <div>
                  <div className="text-[9px] text-brand-400">Creators</div>
                  <div className="text-[12px] font-semibold text-brand-950">{campaign._count.creatorMatches}</div>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => onMatchCreators(campaign.id)}
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium text-accent-600 hover:bg-accent-600/10"
            style={{ borderColor: "var(--color-accent-50)" }}
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

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-brand-500">Select a project.</div>;

  return (
    <div className="min-h-screen bg-brand-50">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "var(--color-brand-100)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10b98118]">
              <Zap size={17} className="text-success-500" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-brand-950">Campaign Workspace</h1>
              <p className="text-[12px] text-brand-500">Manage campaigns, brief creators, and link content.</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-[12px] font-medium text-white">
            <Plus size={13} /> New Campaign
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-4">
        {campaigns.isLoading ? (
          <div className="py-12 text-center text-[12px] text-brand-500">Loading…</div>
        ) : !campaigns.data?.length ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
            <Zap size={28} className="mx-auto mb-3 text-brand-300" />
            <p className="text-[13px] font-medium text-brand-950">No campaigns yet</p>
            <p className="mt-1 text-[12px] text-brand-500">Create a campaign to organize your content and creators.</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 mx-auto flex items-center gap-1.5 rounded-lg bg-success-500 px-4 py-2 text-[12px] font-medium text-white">
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
              style={{ borderColor: "var(--color-brand-100)" }}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[14px] font-semibold text-brand-950">New Campaign</h2>
                <button onClick={() => setShowCreate(false)} className="rounded-md p-1 hover:bg-brand-100"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Campaign Name *", key: "name", placeholder: "e.g. Diwali Collection 2025" },
                  { label: "Objective", key: "objective", placeholder: "e.g. Drive sales of new collection" },
                  { label: "Product Focus", key: "productFocus", placeholder: "e.g. Diamond necklaces" },
                  { label: "Target Audience", key: "targetAudience", placeholder: "e.g. Women 25-40, metro cities" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="mb-1 block text-[11px] font-medium text-brand-600">{label}</label>
                    <input value={form[key as keyof typeof form] ?? ""} onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder} className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }} />
                  </div>
                ))}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-brand-600">Platforms</label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p}
                        onClick={() => togglePlatform(p)}
                        className={`rounded-full px-2.5 py-1 text-[10.5px] font-medium transition ${form.platforms?.includes(p) ? "bg-accent-600 text-white" : "bg-brand-100 text-brand-600"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-brand-600">Budget (₹, optional)</label>
                  <input type="number" placeholder="e.g. 50000" onChange={(e) => setForm(f => ({ ...f, budget: parseInt(e.target.value) || undefined }))}
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }} />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 rounded-lg border py-2 text-[12px] font-medium text-brand-600" style={{ borderColor: "var(--color-brand-200)" }}>Cancel</button>
                <button onClick={() => createMut.mutate(form)} disabled={!form.name || createMut.isPending}
                  className="flex-1 rounded-lg bg-success-500 py-2 text-[12px] font-medium text-white disabled:opacity-60">
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
