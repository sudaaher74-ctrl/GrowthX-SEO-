"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Sparkles, CheckCircle2, Copy, Edit3, ChevronDown, ChevronUp } from "lucide-react";

const pages = [
  { url: "/", title: "Home — MilQuu Fresh Dairy | Best Milk Delivery Navi Mumbai", desc: "Order fresh cow and buffalo milk online. MilQuu delivers pure, farm-fresh A2 milk and dairy products to Panvel, Kharghar, Nerul & all of Navi Mumbai. Subscribe today.", titleLen: 75, descLen: 186, status: "ok" },
  { url: "/products/a2-cow-milk", title: "A2 Cow Milk", desc: "", titleLen: 11, descLen: 0, status: "missing_desc" },
  { url: "/blog/benefits-a2-milk", title: "7 Benefits of A2 Milk You Must Know | MilQuu Blog", desc: "Discover the amazing health benefits of A2 cow milk. From better digestion to higher nutrition, learn why A2 milk is the superior choice for your family.", titleLen: 51, descLen: 158, status: "ok" },
  { url: "/milk-delivery-panvel", title: "Milk Delivery Panvel — Same Day Fresh Milk | MilQuu", desc: "Get fresh cow and buffalo milk delivered to your doorstep in Panvel. MilQuu offers daily milk subscription with free home delivery. Order now!", titleLen: 52, descLen: 142, status: "ok" },
  { url: "/products/buffalo-milk", title: "Buffalo Milk", desc: "Buy buffalo milk online", titleLen: 12, descLen: 23, status: "too_short" },
  { url: "/checkout", title: "Checkout - MilQuu", desc: "Complete your order", titleLen: 18, descLen: 19, status: "too_short" },
  { url: "/products", title: "Products | MilQuu Fresh Dairy Products Navi Mumbai Online", desc: "Browse our complete range of fresh dairy products including A2 cow milk, buffalo milk, curd, paneer and more. Daily home delivery across Navi Mumbai.", titleLen: 59, descLen: 150, status: "ok" },
  { url: "/about", title: "About MilQuu", desc: "", titleLen: 13, descLen: 0, status: "missing_desc" },
];

const aiMeta: Record<string, { title: string; desc: string; slug: string }> = {
  "/products/a2-cow-milk": {
    title: "Buy A2 Cow Milk Online | Pure & Farm-Fresh | MilQuu",
    desc: "Order A2 cow milk online in Navi Mumbai. MilQuu sources directly from indigenous cows for maximum nutrition. Daily home delivery to Panvel, Kharghar & Nerul. Try risk-free.",
    slug: "a2-cow-milk-online-delivery",
  },
  "/products/buffalo-milk": {
    title: "Fresh Buffalo Milk Delivery | Creamy & Nutritious | MilQuu",
    desc: "Pure buffalo milk delivered fresh to your home. Rich in fat and protein — perfect for chai, curd & paneer. Daily subscription available across Navi Mumbai.",
    slug: "fresh-buffalo-milk-delivery",
  },
  "/checkout": {
    title: "Checkout | Complete Your Milk Order — MilQuu",
    desc: "Securely complete your fresh milk order. Flexible subscription plans, easy payment, and same-day delivery across Navi Mumbai.",
    slug: "checkout",
  },
  "/about": {
    title: "About MilQuu | Farm-Fresh Dairy Delivered Daily in Navi Mumbai",
    desc: "Learn how MilQuu brings pure, farm-fresh milk from indigenous cows to your doorstep every morning. Trusted by 2,000+ families across Navi Mumbai.",
    slug: "about-milquu-fresh-dairy",
  },
};

const statusLabel: Record<string, string> = { ok: "Optimized", missing_desc: "Missing Description", too_short: "Too Short", duplicate: "Duplicate" };
const statusBadge: Record<string, "success" | "error" | "warning" | "default"> = { ok: "success", missing_desc: "error", too_short: "warning", duplicate: "error" };

export default function MetaOptimizerPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [approved, setApproved] = useState<string[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);

  const issues = pages.filter(p => p.status !== "ok");

  const generate = (url: string) => {
    setGenerating(url);
    setTimeout(() => { setGenerating(null); setExpanded(url); }, 1800);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">AI Meta Optimizer</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">AI-generated titles, descriptions, and slugs — one-click approve</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">Bulk Generate All</Button>
          <Button variant="primary" size="sm" icon={<Sparkles size={13}/>}>Generate Fixes</Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Pages", value: pages.length, color: "text-purple-500" },
          { label: "Optimized", value: pages.filter(p => p.status === "ok").length, color: "text-emerald-500" },
          { label: "Needs Fix", value: issues.length, color: "text-amber-500" },
          { label: "Approved Today", value: approved.length, color: "text-violet-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="card p-4 text-center">
            <div className={cn("text-3xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Pages List */}
      <div className="space-y-2">
        {pages.map((page, i) => {
          const hasAI = !!aiMeta[page.url];
          const isApproved = approved.includes(page.url);
          return (
            <motion.div key={page.url} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={cn("card overflow-hidden", isApproved && "border-emerald-200 dark:border-emerald-900")}>
              <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpanded(expanded === page.url ? null : page.url)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <code className="text-xs text-purple-400 font-mono">{page.url}</code>
                    <Badge variant={isApproved ? "success" : statusBadge[page.status]}>
                      {isApproved ? "Approved" : statusLabel[page.status]}
                    </Badge>
                  </div>
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">{page.title || <span className="text-[var(--text-muted)]">No title</span>}</div>
                  {page.desc ? <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">{page.desc}</div> : <div className="text-xs text-red-400 mt-0.5">Missing meta description</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {page.status !== "ok" && !isApproved && (
                    <Button variant="secondary" size="sm" loading={generating === page.url} onClick={(e) => { e.stopPropagation(); generate(page.url); }} icon={<Sparkles size={12}/>}>
                      {generating === page.url ? "Generating..." : "AI Fix"}
                    </Button>
                  )}
                  {expanded === page.url ? <ChevronUp size={15} className="text-[var(--text-muted)]"/> : <ChevronDown size={15} className="text-[var(--text-muted)]"/>}
                </div>
              </div>

              {/* AI Suggestions Panel */}
              {expanded === page.url && hasAI && !isApproved && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="border-t border-[var(--border-color)] p-4 bg-purple-50/30 dark:bg-purple-900/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={13} className="text-purple-500"/>
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">AI-Generated Suggestions</span>
                  </div>
                  <div className="space-y-2 mb-4">
                    {[
                      { label: "Title", value: aiMeta[page.url].title, chars: aiMeta[page.url].title.length },
                      { label: "Meta Description", value: aiMeta[page.url].desc, chars: aiMeta[page.url].desc.length },
                      { label: "Slug", value: aiMeta[page.url].slug, chars: aiMeta[page.url].slug.length },
                    ].map(({ label, value, chars }) => (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{label}</span>
                          <span className={cn("text-xs font-medium", chars > 160 ? "text-red-500" : chars > 70 && label === "Title" ? "text-amber-500" : "text-emerald-500")}>{chars} chars</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 text-sm text-[var(--text-primary)] bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg px-3 py-2">{value}</div>
                          <button onClick={() => navigator.clipboard?.writeText(value)} className="w-8 h-8 shrink-0 rounded-lg border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-base mt-1">
                            <Copy size={12}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" icon={<CheckCircle2 size={12}/>} onClick={() => setApproved(p => [...p, page.url])}>Approve & Apply</Button>
                    <Button variant="ghost" size="sm" icon={<Edit3 size={12}/>}>Edit First</Button>
                    <Button variant="ghost" size="sm" icon={<Sparkles size={12}/>}>Regenerate</Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
