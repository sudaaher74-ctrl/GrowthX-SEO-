"use client";
import { motion } from "framer-motion";
import { mockLocalPages } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { MapPin, Plus, CheckCircle2, Clock, Edit3, Sparkles, Globe, FileText, HelpCircle, Link2, Map } from "lucide-react";
import { useState } from "react";

const areasList = ["Panvel", "Kharghar", "Nerul", "Belapur", "Ulwe", "Vashi", "Airoli", "Ghansoli", "Taloja", "Kalamboli", "Kamothe", "Sanpada", "Turbhe", "Mahape"];

export default function LocalSEOPage() {
  const [showBulk, setShowBulk] = useState(false);
  const [selected, setSelected] = useState<string[]>(["Ulwe", "Vashi", "Airoli"]);
  const [generating, setGenerating] = useState(false);

  const toggle = (area: string) => setSelected(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Local SEO</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Auto-generate hyper-local pages with schema, FAQ, and internal links</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={13}/>} onClick={() => setShowBulk(!showBulk)}>
          Bulk Generate Pages
        </Button>
      </motion.div>

      {/* Bulk Generator */}
      {showBulk && (
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg gradient-bg-brand flex items-center justify-center">
              <Sparkles size={15} className="text-white"/>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Bulk Local Page Generator</h2>
              <p className="text-xs text-[var(--text-muted)]">Select areas → AI generates full pages with meta, schema, FAQ, maps</p>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-2">Service (from your site)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg">
                Milk Delivery
              </span>
              <span className="text-xs text-[var(--text-muted)]">Will generate: /milk-delivery-[area]</span>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-2">Select Areas ({selected.length} selected)</label>
            <div className="flex flex-wrap gap-2">
              {areasList.map(area => (
                <button key={area} onClick={() => toggle(area)} className={cn("px-3 py-1.5 text-xs rounded-lg border font-medium transition-base",
                  selected.includes(area)
                    ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
                    : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-indigo-400"
                )}>
                  {area}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Include Schema", checked: true, icon: <FileText size={12}/> },
              { label: "Include FAQ", checked: true, icon: <HelpCircle size={12}/> },
              { label: "Include Maps", checked: true, icon: <Map size={12}/> },
              { label: "Internal Links", checked: true, icon: <Link2 size={12}/> },
            ].map(({ label, checked, icon }) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer card p-2.5">
                <input type="checkbox" defaultChecked={checked} className="accent-indigo-500"/>
                {icon}
                <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" loading={generating} onClick={() => { setGenerating(true); setTimeout(() => setGenerating(false), 3000); }} icon={<Sparkles size={13}/>}>
              {generating ? `Generating ${selected.length} pages...` : `Generate ${selected.length} Pages`}
            </Button>
            <Button variant="ghost" onClick={() => setShowBulk(false)}>Cancel</Button>
            <span className="text-xs text-[var(--text-muted)] ml-auto">Requires approval before publishing</span>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Published", value: mockLocalPages.filter(p => p.status === "published").length, color: "text-emerald-500" },
          { label: "Pending Approval", value: mockLocalPages.filter(p => p.status === "pending_approval").length, color: "text-amber-500" },
          { label: "Drafts", value: mockLocalPages.filter(p => p.status === "draft").length, color: "text-slate-400" },
          { label: "Total Traffic", value: mockLocalPages.reduce((s, p) => s + p.traffic, 0), color: "text-indigo-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="card p-4 text-center">
            <div className={cn("text-3xl font-bold", s.color)}>{typeof s.value === "number" && s.label === "Total Traffic" ? formatNumber(s.value) : s.value}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Pages Grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {mockLocalPages.map((page, i) => (
          <motion.div key={page.slug} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="card p-4 hover:shadow-card-hover cursor-pointer group">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center",
                  page.status === "published" ? "bg-emerald-50 dark:bg-emerald-900/20" : page.status === "pending_approval" ? "bg-amber-50 dark:bg-amber-900/20" : "bg-slate-100 dark:bg-slate-800")}>
                  <MapPin size={16} className={page.status === "published" ? "text-emerald-500" : page.status === "pending_approval" ? "text-amber-500" : "text-slate-400"}/>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">Milk Delivery {page.area}</div>
                  <code className="text-[10px] text-indigo-400 font-mono">/{page.slug}</code>
                </div>
              </div>
              <Badge variant={page.status === "published" ? "success" : page.status === "pending_approval" ? "warning" : "default"}>
                {page.status === "published" ? "Live" : page.status === "pending_approval" ? "Approval" : "Draft"}
              </Badge>
            </div>

            {page.status === "published" && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-[var(--surface-2)] rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-indigo-500">{formatNumber(page.traffic)}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Monthly Clicks</div>
                </div>
                <div className="bg-[var(--surface-2)] rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-emerald-500">#{page.position}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Avg Position</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs">
              {[
                { label: "Schema", ok: page.schema },
                { label: "FAQ", ok: page.faq },
                { label: "Maps", ok: true },
                { label: "Links", ok: page.status === "published" },
              ].map(({ label, ok }) => (
                <span key={label} className={cn("flex items-center gap-0.5 font-medium", ok ? "text-emerald-500" : "text-[var(--text-muted)]")}>
                  <CheckCircle2 size={10}/>{label}
                </span>
              ))}
            </div>

            {page.status !== "published" && (
              <div className="flex gap-2 mt-3">
                <Button variant="primary" size="sm" className="flex-1" icon={<CheckCircle2 size={12}/>}>
                  {page.status === "pending_approval" ? "Approve & Publish" : "Generate"}
                </Button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center border border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-base">
                  <Edit3 size={13}/>
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
