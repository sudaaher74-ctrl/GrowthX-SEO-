"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Image, Sparkles, CheckCircle2, Download, AlertTriangle, RefreshCw } from "lucide-react";

const images = [
  { src: "/home/hero-fresh-milk.jpg", alt: "", size: 842, type: "jpg", status: "no_alt", width: 1920, height: 1080 },
  { src: "/products/a2-milk-bottle.jpg", alt: "A2 cow milk glass bottle on white background", size: 124, type: "webp", status: "ok", width: 800, height: 800 },
  { src: "/products/buffalo-milk-packet.jpg", alt: "", size: 384, type: "jpg", status: "large", width: 1600, height: 900 },
  { src: "/about/farm.jpg", alt: "Cow farm in Konkan Maharashtra", size: 218, type: "jpg", status: "no_webp", width: 1200, height: 800 },
  { src: "/blog/a2-benefits.jpg", alt: "", size: 56, type: "webp", status: "ok", width: 800, height: 450 },
  { src: "/gallery/delivery-boy.jpg", alt: "", size: 194, type: "jpg", status: "no_alt", width: 1000, height: 750 },
  { src: "/products/curd.jpg", alt: "Fresh curd in clay pot", size: 88, type: "webp", status: "ok", width: 600, height: 600 },
  { src: "/icons/logo.png", alt: "MilQuu logo", size: 12, type: "png", status: "ok", width: 200, height: 60 },
];

const aiAlts: Record<string, string> = {
  "/home/hero-fresh-milk.jpg": "MilQuu fresh farm milk poured into glass with morning sunlight, Navi Mumbai dairy delivery",
  "/products/buffalo-milk-packet.jpg": "MilQuu buffalo milk packet showing nutrition label, 500ml fresh dairy product",
  "/gallery/delivery-boy.jpg": "MilQuu delivery person on bicycle with insulated milk bag, early morning home delivery Panvel",
};

const statusConfig: Record<string, { label: string; badge: "success" | "warning" | "error" | "default"; bg: string }> = {
  ok: { label: "Optimized", badge: "success", bg: "bg-emerald-50 dark:bg-emerald-900/10" },
  no_alt: { label: "Missing Alt Text", badge: "error", bg: "bg-red-50 dark:bg-red-900/10" },
  large: { label: "Too Large (>200KB)", badge: "warning", bg: "bg-amber-50 dark:bg-amber-900/10" },
  no_webp: { label: "Not WebP", badge: "warning", bg: "bg-yellow-50 dark:bg-yellow-900/10" },
};

export default function ImageSEOPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Image SEO</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Audit, compress, convert to WebP/AVIF, and auto-generate alt text</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13}/>}>Re-scan</Button>
          <Button variant="primary" size="sm" icon={<Sparkles size={13}/>}>Auto-Optimize All</Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Images", value: images.length, color: "text-purple-500" },
          { label: "Optimized", value: images.filter(i => i.status === "ok").length, color: "text-emerald-500" },
          { label: "Missing Alt Text", value: images.filter(i => i.status === "no_alt").length, color: "text-red-500" },
          { label: "Total Size Saved", value: "1.8 MB", color: "text-violet-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="card p-4 text-center">
            <div className={cn("text-3xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Images List */}
      <div className="space-y-2">
        {images.map((img, i) => {
          const sc = statusConfig[img.status];
          const aiAlt = aiAlts[img.src];
          return (
            <motion.div key={img.src} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="card p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shrink-0">
                <Image size={20} className="text-slate-400"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <code className="text-xs text-purple-400 font-mono truncate">{img.src}</code>
                  <Badge variant={sc.badge}>{sc.label}</Badge>
                  <Badge variant="default">{img.type.toUpperCase()}</Badge>
                </div>
                <div className="text-xs text-[var(--text-muted)] flex items-center gap-3">
                  <span>{img.width}×{img.height}px</span>
                  <span className={cn("font-medium", img.size > 200 ? "text-red-500" : img.size > 100 ? "text-amber-500" : "text-emerald-500")}>{img.size}KB</span>
                  {img.alt && <span className="text-emerald-500">Alt: "{img.alt}"</span>}
                </div>
                {aiAlt && img.status === "no_alt" && (
                  <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/15 rounded-lg">
                    <div className="flex items-start gap-1.5">
                      <Sparkles size={11} className="text-purple-500 shrink-0 mt-0.5"/>
                      <div>
                        <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">AI-Generated Alt Text: </span>
                        <span className="text-xs text-[var(--text-secondary)]">{aiAlt}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {img.status !== "ok" && (
                  <Button variant="primary" size="sm" icon={<CheckCircle2 size={12}/>}>Fix</Button>
                )}
                {img.status === "ok" && <CheckCircle2 size={16} className="text-emerald-500"/>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
