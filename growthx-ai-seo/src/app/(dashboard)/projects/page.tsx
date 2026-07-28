"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Globe, ExternalLink, Settings, BarChart3, CheckCircle2 } from "lucide-react";
import { AddWebsiteModal } from "@/components/ui/AddWebsiteModal";

const projects = [
  { id: 1, name: "MilQuu Fresh Dairy", domain: "milquu.com", health: 78, keywords: 847, issues: 47, indexed: 1247, plan: "Growth", status: "active" },
  { id: 2, name: "GrowthX Agency", domain: "growthx.in", health: 65, keywords: 320, issues: 23, indexed: 142, plan: "Growth", status: "active" },
  { id: 3, name: "Client Demo Site", domain: "demo.growthx.in", health: 0, keywords: 0, issues: 0, indexed: 0, plan: "Growth", status: "setup" },
];

const healthColor = (h: number) => h >= 80 ? "text-emerald-500" : h >= 60 ? "text-amber-500" : h > 0 ? "text-red-500" : "text-slate-400";

export default function ProjectsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  // Bypassing plan limit restriction for testing
  const hasActiveProject = false;

  const handleSuccess = (domain: string) => {
    // Redirect to technical SEO dashboard for this specific domain
    router.push(`/technical-seo?domain=${encodeURIComponent(domain)}`);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Projects</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Manage all your websites and SEO campaigns</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={13}/>} onClick={() => setIsModalOpen(true)}>Add Website</Button>
      </motion.div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((project, i) => (
          <motion.div key={project.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="card p-5 hover:shadow-card-hover cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-bg-brand flex items-center justify-center text-white">
                  <Globe size={18}/>
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">{project.name}</div>
                  <code className="text-xs text-purple-400 font-mono">{project.domain}</code>
                </div>
              </div>
              <Badge variant={project.status === "active" ? "success" : "warning"}>
                {project.status === "active" ? "Active" : "Setup"}
              </Badge>
            </div>

            {project.status === "active" ? (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: "SEO Health", value: `${project.health}`, color: healthColor(project.health) },
                  { label: "Keywords", value: project.keywords.toString(), color: "text-purple-500" },
                  { label: "Issues", value: project.issues.toString(), color: project.issues > 0 ? "text-amber-500" : "text-emerald-500" },
                  { label: "Indexed", value: project.indexed.toLocaleString(), color: "text-emerald-500" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[var(--surface-2)] rounded-lg p-2.5 text-center">
                    <div className={cn("text-xl font-bold", color)}>{value}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">{label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg text-xs text-amber-600 dark:text-amber-400">
                Complete setup: connect GSC + GA4 to start tracking
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="primary" size="sm" className="flex-1" icon={<BarChart3 size={12}/>}>
                {project.status === "active" ? "View Dashboard" : "Complete Setup"}
              </Button>
              <button className="w-8 h-8 rounded-lg border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-base">
                <Settings size={13}/>
              </button>
            </div>
          </motion.div>
        ))}

        {/* Add New Project Card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          onClick={() => setIsModalOpen(true)}
          className="card p-5 flex flex-col items-center justify-center py-12 border-dashed border-2 border-[var(--border-color)] hover:border-purple-400 hover:bg-purple-50/30 dark:hover:bg-purple-900/10 cursor-pointer transition-base group">
          <div className="w-12 h-12 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-700 flex items-center justify-center mb-3 group-hover:border-purple-500 transition-base">
            <Plus size={20} className="text-purple-400 group-hover:text-purple-500"/>
          </div>
          <div className="text-sm font-semibold text-[var(--text-secondary)] group-hover:text-purple-600 dark:group-hover:text-purple-400">Add New Website</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Connect GSC & start tracking</div>
        </motion.div>
      </div>

      <AddWebsiteModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
        hasActiveProject={hasActiveProject}
      />
    </div>
  );
}
