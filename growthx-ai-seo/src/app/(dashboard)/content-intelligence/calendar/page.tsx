"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, Sparkles, X, Check, Clock, RefreshCw, Download, FileText } from "lucide-react";
import { api, type CalendarItem, type GenerateContentBody } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";
import { exportCalendarToCsv, exportCalendarToMarkdown } from "@/lib/export-utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "Draft", color: "var(--color-brand-500)", bg: "var(--color-brand-100)" },
  REVIEW: { label: "In Review", color: "var(--color-warning-500)", bg: "var(--color-warning-50)" },
  APPROVED: { label: "Approved", color: "var(--color-success-500)", bg: "var(--color-success-50)" },
  SCHEDULED: { label: "Scheduled", color: "var(--color-accent-600)", bg: "var(--color-accent-50)" },
  PUBLISHED: { label: "Published", color: "var(--color-series-2)", bg: "var(--color-accent-50)" },
  FAILED: { label: "Failed", color: "var(--color-error-500)", bg: "var(--color-error-50)" },
};

const PILLAR_COLORS: Record<string, string> = {
  PRODUCT: "var(--color-accent-600)",
  EDUCATIONAL: "var(--color-series-2)",
  LIFESTYLE: "var(--color-series-6)",
  CREATOR: "var(--color-warning-500)",
  PROMOTIONAL: "var(--color-error-500)",
  BEHIND_SCENES: "var(--color-success-500)",
};

const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "YOUTUBE", "WEBSITE", "WHATSAPP"];
const CONTENT_TYPES = ["POST", "REEL", "CAROUSEL", "VIDEO", "BLOG", "STORY"];
const PILLARS = ["PRODUCT", "EDUCATIONAL", "LIFESTYLE", "CREATOR", "PROMOTIONAL", "BEHIND_SCENES"];

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <span className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold" style={{ color: config.color, background: config.bg }}>
      {config.label}
    </span>
  );
}

function ContentItemCard({ item, onUpdateStatus }: { item: CalendarItem; onUpdateStatus: (id: string, status: string) => void }) {
  const pillarColor = PILLAR_COLORS[item.contentPillar ?? ""] ?? "var(--color-brand-500)";
  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--color-brand-100)", borderLeft: `3px solid ${pillarColor}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12.5px] font-semibold text-brand-950">{item.title}</span>
            <StatusBadge status={item.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-brand-500">
            <span className="font-medium text-brand-600">{item.platform}</span>
            <span>·</span>
            <span>{item.contentType}</span>
            {item.contentPillar && <><span>·</span><span style={{ color: pillarColor }}>{item.contentPillar}</span></>}
            {item.campaign && <><span>·</span><span className="text-accent-600">{item.campaign.name}</span></>}
          </div>
          {item.hook && <p className="mt-2 text-[11.5px] font-medium text-brand-950 italic">&quot;{item.hook}&quot;</p>}
          {item.caption && <p className="mt-1 text-[11px] text-brand-500 line-clamp-2">{item.caption}</p>}
          {item.scheduledFor && (
            <div className="mt-2 flex items-center gap-1 text-[10.5px] text-brand-400">
              <Clock size={11} /> {new Date(item.scheduledFor).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
          {item.hashtags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.hashtags.slice(0, 5).map((h) => (
                <span key={h} className="text-[9.5px] text-accent-600">#{h}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {item.status === "DRAFT" && (
            <button onClick={() => onUpdateStatus(item.id, "APPROVED")} className="flex items-center gap-1 rounded-md bg-success-500 px-2 py-1 text-[10px] font-medium text-white">
              <Check size={11} /> Approve
            </button>
          )}
          {item.status === "APPROVED" && (
            <button onClick={() => onUpdateStatus(item.id, "SCHEDULED")} className="flex items-center gap-1 rounded-md bg-accent-600 px-2 py-1 text-[10px] font-medium text-white">
              <Clock size={11} /> Schedule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "draft" | "approved" | "scheduled" | "published">("all");
  const [showGenerate, setShowGenerate] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [generateForm, setGenerateForm] = useState<GenerateContentBody>({
    platform: "INSTAGRAM",
    contentType: "REEL",
    contentPillar: "PRODUCT",
    topic: "",
  });

  const [createForm, setCreateForm] = useState({ platform: "INSTAGRAM", contentType: "POST", contentPillar: "PRODUCT", title: "", caption: "" });

  const items = useQuery({
    queryKey: ["ci-calendar", projectId, tab],
    queryFn: () => api.listCalendarItems(projectId!, tab === "all" ? undefined : { status: tab.toUpperCase() }),
    enabled: !!projectId,
  });

  const generateMut = useMutation({
    mutationFn: (body: GenerateContentBody) => api.generateContent(projectId!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ci-calendar"] }); setShowGenerate(false); },
  });

  const createMut = useMutation({
    mutationFn: (body: any) => api.createCalendarItem(projectId!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ci-calendar"] }); setShowCreate(false); },
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateCalendarItem(projectId!, id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-calendar"] }),
  });

  if (!projectId) return <div className="flex h-40 items-center justify-center text-sm text-brand-500">Select a project.</div>;

  const tabs = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "approved", label: "Approved" },
    { key: "scheduled", label: "Scheduled" },
    { key: "published", label: "Published" },
  ] as const;

  return (
    <div className="min-h-screen bg-brand-50">
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "var(--color-brand-100)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0ea5e918]">
              <Calendar size={17} className="text-series-2" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-brand-950">Content Calendar</h1>
              <p className="text-[12px] text-brand-500">Plan, generate, approve, and schedule your content.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.data && items.data.length > 0 && (
              <>
                <button
                  onClick={() => exportCalendarToCsv(items.data ?? [])}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium text-brand-600 hover:bg-brand-100 transition"
                  style={{ borderColor: "var(--color-brand-200)" }}
                  title="Export full editorial schedule to CSV"
                >
                  <Download size={13} /> Export CSV
                </button>
                <button
                  onClick={() => exportCalendarToMarkdown(items.data ?? [])}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium text-brand-600 hover:bg-brand-100 transition"
                  style={{ borderColor: "var(--color-brand-200)" }}
                  title="Export production briefs and scripts to Markdown / Notion"
                >
                  <FileText size={13} /> Export Markdown
                </button>
              </>
            )}
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium text-brand-600 hover:bg-brand-100" style={{ borderColor: "var(--color-brand-200)" }}>
              <Plus size={13} /> Manual
            </button>
            <button onClick={() => setShowGenerate(true)} className="flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm hover:opacity-90 transition">
              <Sparkles size={13} /> AI Generate
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-[11.5px] font-medium transition ${tab === t.key ? "bg-brand-100 text-brand-950" : "text-brand-500 hover:bg-brand-100"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6 space-y-3">
        {items.isLoading ? (
          <div className="py-12 text-center text-[12px] text-brand-500">Loading…</div>
        ) : !items.data?.length ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
            <Calendar size={28} className="mx-auto mb-3 text-brand-300" />
            <p className="text-[13px] font-medium text-brand-950">No content items yet</p>
            <p className="mt-1 text-[12px] text-brand-500">Use AI Generate to create content from your strategy, or add manually.</p>
          </div>
        ) : (
          items.data.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <ContentItemCard item={item} onUpdateStatus={(id, status) => updateStatusMut.mutate({ id, status })} />
            </motion.div>
          ))
        )}
      </div>

      {/* AI Generate drawer */}
      <AnimatePresence>
        {showGenerate && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowGenerate(false)} />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl border bg-white p-6 shadow-2xl"
              style={{ borderColor: "var(--color-brand-100)" }}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[14px] font-semibold text-brand-950">AI Content Generation</h2>
                <button onClick={() => setShowGenerate(false)} className="rounded-md p-1 hover:bg-brand-100"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Platform", key: "platform", options: PLATFORMS },
                  { label: "Content Type", key: "contentType", options: CONTENT_TYPES },
                  { label: "Content Pillar", key: "contentPillar", options: PILLARS },
                ].map(({ label, key, options }) => (
                  <div key={key}>
                    <label className="mb-1 block text-[11px] font-medium text-brand-600">{label}</label>
                    <select value={(generateForm as any)[key]} onChange={(e) => setGenerateForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }}>
                      {options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-brand-600">Topic / Brief</label>
                  <textarea
                    value={generateForm.topic}
                    onChange={(e) => setGenerateForm(f => ({ ...f, topic: e.target.value }))}
                    placeholder="e.g. New diamond necklace launch — focus on elegance for weddings"
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600 resize-none"
                    style={{ borderColor: "var(--color-brand-200)" }}
                  />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setShowGenerate(false)} className="flex-1 rounded-lg border py-2 text-[12px] font-medium text-brand-600" style={{ borderColor: "var(--color-brand-200)" }}>Cancel</button>
                <button
                  onClick={() => generateMut.mutate(generateForm)}
                  disabled={!generateForm.topic || generateMut.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-accent-600 py-2 text-[12px] font-medium text-white disabled:opacity-60"
                >
                  {generateMut.isPending ? <><RefreshCw size={12} className="animate-spin" /> Generating…</> : <><Sparkles size={12} /> Generate</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual create drawer */}
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
                <h2 className="text-[14px] font-semibold text-brand-950">Add Content Item</h2>
                <button onClick={() => setShowCreate(false)} className="rounded-md p-1 hover:bg-brand-100"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-brand-600">Title</label>
                  <input value={createForm.title} onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Content title" className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }} />
                </div>
                {[
                  { label: "Platform", key: "platform", options: PLATFORMS },
                  { label: "Content Type", key: "contentType", options: CONTENT_TYPES },
                ].map(({ label, key, options }) => (
                  <div key={key}>
                    <label className="mb-1 block text-[11px] font-medium text-brand-600">{label}</label>
                    <select value={(createForm as any)[key]} onChange={(e) => setCreateForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-accent-600" style={{ borderColor: "var(--color-brand-200)" }}>
                      {options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 rounded-lg border py-2 text-[12px] font-medium text-brand-600" style={{ borderColor: "var(--color-brand-200)" }}>Cancel</button>
                <button onClick={() => createMut.mutate(createForm)} disabled={!createForm.title || createMut.isPending}
                  className="flex-1 rounded-lg bg-brand-950 py-2 text-[12px] font-medium text-white disabled:opacity-60">
                  {createMut.isPending ? "Adding…" : "Add"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
