"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link2, Sparkles, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

const orphanPages = [
  { url: "/blog/buffalo-milk-recipe", title: "Best Buffalo Milk Recipes", traffic: 84, inLinks: 0 },
  { url: "/blog/dairy-nutrition-guide", title: "Dairy Nutrition Complete Guide", traffic: 142, inLinks: 1 },
  { url: "/products/ghee", title: "Pure Desi Ghee — MilQuu", traffic: 210, inLinks: 0 },
];

const linkOpportunities = [
  { from: "/blog/benefits-a2-milk", to: "/products/a2-cow-milk", anchor: "buy A2 cow milk", score: 96, status: "pending" },
  { from: "/", to: "/milk-delivery-panvel", anchor: "milk delivery in Panvel", score: 88, status: "approved" },
  { from: "/blog/dairy-nutrition-guide", to: "/products/buffalo-milk", anchor: "fresh buffalo milk", score: 82, status: "pending" },
  { from: "/milk-delivery-panvel", to: "/milk-delivery-kharghar", anchor: "nearby areas like Kharghar", score: 78, status: "pending" },
  { from: "/products/a2-cow-milk", to: "/blog/benefits-a2-milk", anchor: "learn about A2 milk benefits", score: 74, status: "pending" },
  { from: "/", to: "/products", anchor: "browse all dairy products", score: 71, status: "approved" },
];

export default function InternalLinkingPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Internal Linking AI</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Detect orphan pages and AI-powered link opportunity recommendations</p>
        </div>
        <Button variant="primary" size="sm" icon={<Sparkles size={13}/>}>Scan & Suggest Links</Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Orphan Pages", value: orphanPages.length, color: "text-red-500" },
          { label: "Opportunities", value: linkOpportunities.length, color: "text-indigo-500" },
          { label: "Pending Approval", value: linkOpportunities.filter(l => l.status === "pending").length, color: "text-amber-500" },
          { label: "Approved Links", value: linkOpportunities.filter(l => l.status === "approved").length, color: "text-emerald-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="card p-4 text-center">
            <div className={cn("text-3xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Orphan Pages */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border-color)]">
          <AlertCircle size={15} className="text-red-500"/>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Orphan Pages (no internal links pointing to them)</h3>
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          {orphanPages.map((page, i) => (
            <div key={page.url} className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--surface-2)]">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{page.title}</div>
                <code className="text-xs text-indigo-400 font-mono">{page.url}</code>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-[var(--text-primary)]">{page.traffic}</div>
                <div className="text-[10px] text-[var(--text-muted)]">monthly clicks</div>
              </div>
              <Badge variant="error">{page.inLinks} inbound links</Badge>
              <Button variant="primary" size="sm" icon={<Link2 size={12}/>}>Fix</Button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Link Opportunities */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-indigo-500"/>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">AI Link Recommendations</h3>
          </div>
          <Button variant="secondary" size="sm">Approve All Pending</Button>
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          {linkOpportunities.map((link, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.04 * i }}
              className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--surface-2)]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] flex-wrap">
                  <code className="text-indigo-400 font-mono">{link.from}</code>
                  <ArrowRight size={12}/>
                  <code className="text-violet-400 font-mono">{link.to}</code>
                </div>
                <div className="text-sm text-[var(--text-primary)] mt-0.5">
                  Anchor: <span className="font-medium text-indigo-500">&ldquo;{link.anchor}&rdquo;</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={cn("text-lg font-bold", link.score >= 85 ? "text-emerald-500" : "text-amber-500")}>{link.score}</div>
                <div className="text-[10px] text-[var(--text-muted)]">relevance</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {link.status === "approved" ? (
                  <Badge variant="success"><CheckCircle2 size={10} className="mr-1"/>Approved</Badge>
                ) : (
                  <Button variant="primary" size="sm" icon={<CheckCircle2 size={12}/>}>Approve</Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
