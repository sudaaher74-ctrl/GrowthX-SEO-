"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, AlertTriangle, Calendar, Zap, ChevronDown, ChevronRight,
  CheckCircle, TrendingUp, FileText, ArrowRight, Copy, ExternalLink,
  BookOpen, GitMerge, RotateCcw, Star
} from "lucide-react";
import { PageHeader, ActionButton } from "@/components/ui/console";
import {
  useWorkspace,
  useTopicClusters,
  useCannibalizationReport,
  useContentVelocityCalendar,
} from "@/hooks/use-growthx";
import { stagingEngine } from "@/lib/staging-engine";
import type { TopicCluster, CannibalizationGroup, ContentCalendarItem } from "@/lib/api-client";

const TABS = [
  { id: "clusters", label: "Topic Cluster Map", icon: Layers },
  { id: "cannibalization", label: "Cannibalization Detector", icon: AlertTriangle },
  { id: "calendar", label: "Velocity Calendar", icon: Calendar },
] as const;

type Tab = (typeof TABS)[number]["id"];

function ScoreCard({ label, value, sub, color = "text-brand-950" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm">
      <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${color}`}>{value}</span>
        {sub && <span className="text-[12px] text-brand-400">{sub}</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1: Topic Cluster Map
// ─────────────────────────────────────────────────────────────────────────────

function TopicClustersTab({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useTopicClusters(projectId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [staged, setStaged] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const stageGap = (clusterId: string, gap: string) => {
    if (staged.has(`${clusterId}-${gap}`)) return;
    stagingEngine.stage(projectId, {
      title: gap,
      category: "Content Velocity",
      source: "LOCAL_SEO_GEO", // reusing existing; content velocity stages as geo for now
      priority: "HIGH",
      impact: `Fill topical authority gap: ${gap}`,
      effortHours: 4,
      deliverable: `Publish ${gap} article (target 1200 words)`,
    });
    setStaged((prev) => new Set([...prev, `${clusterId}-${gap}`]));
  };

  if (isLoading) return <div className="py-20 text-center text-[13px] text-brand-400">Analyzing topic clusters across your site…</div>;
  if (error || !data) return <div className="py-20 text-center text-[13px] text-rose-500">Could not load cluster data. Run a crawl first.</div>;

  const { scoreboard, clusters } = data;

  return (
    <div className="space-y-6">
      {/* Scoreboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <ScoreCard label="Total Pages" value={scoreboard.totalPages} />
        <ScoreCard label="Clustered Pages" value={scoreboard.clusteredPages} color="text-emerald-600" />
        <ScoreCard label="Orphan Pages" value={scoreboard.orphanPages} color={scoreboard.orphanPages > 0 ? "text-rose-600" : "text-brand-950"} />
        <ScoreCard label="Pillar Topics" value={scoreboard.pillarCount} color="text-blue-600" />
        <ScoreCard label="Avg Cluster Depth" value={`${scoreboard.avgClusterDepth}%`} color={scoreboard.avgClusterDepth >= 60 ? "text-emerald-600" : "text-amber-600"} />
      </div>

      {/* Cluster List */}
      <div className="bg-white rounded-xl border border-brand-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-100 flex items-center gap-2">
          <Layers size={15} className="text-brand-500" />
          <h3 className="text-[13px] font-semibold text-brand-950">Topic Cluster Architecture</h3>
          <span className="ml-auto text-[11px] text-brand-400">{clusters.length} clusters detected</span>
        </div>

        <div className="divide-y divide-brand-50">
          {clusters.map((cluster: TopicCluster) => {
            const isOpen = expanded.has(cluster.id);
            const depthColor = cluster.depthScore >= 70 ? "text-emerald-600 bg-emerald-50" : cluster.depthScore >= 40 ? "text-amber-600 bg-amber-50" : "text-rose-600 bg-rose-50";
            return (
              <div key={cluster.id}>
                <button
                  onClick={() => toggle(cluster.id)}
                  className="w-full px-6 py-4 flex items-center gap-4 hover:bg-brand-50/60 transition text-left"
                >
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full ${depthColor} text-[10px] font-bold shrink-0`}>
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-brand-950 capitalize">{cluster.topic}</p>
                    <p className="text-[11px] text-brand-400 mt-0.5">
                      {cluster.clusterPages.length + 1} pages · {cluster.contentGaps.length} gaps
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[10px] font-semibold text-brand-500 uppercase tracking-wider">Depth</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-24 h-1.5 rounded-full bg-brand-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${cluster.depthScore >= 70 ? "bg-emerald-500" : cluster.depthScore >= 40 ? "bg-amber-400" : "bg-rose-400"}`}
                            style={{ width: `${cluster.depthScore}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-bold ${cluster.depthScore >= 70 ? "text-emerald-600" : cluster.depthScore >= 40 ? "text-amber-600" : "text-rose-600"}`}>
                          {cluster.depthScore}%
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 pt-1 space-y-4 bg-brand-50/30">
                        {/* Pillar page */}
                        {cluster.pillar && (
                          <div>
                            <p className="text-[10.5px] font-semibold text-brand-500 uppercase tracking-wider mb-2">Pillar Page</p>
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                              <Star size={13} className="text-blue-500 shrink-0" />
                              <a href={cluster.pillar.url} target="_blank" rel="noopener noreferrer"
                                className="text-[12px] text-blue-700 font-medium hover:underline truncate flex items-center gap-1">
                                {cluster.pillar.title || cluster.pillar.url}
                                <ExternalLink size={10} className="opacity-60 shrink-0" />
                              </a>
                              <span className="ml-auto text-[10px] text-blue-600 font-semibold shrink-0">{cluster.pillar.wordCount.toLocaleString()} words</span>
                            </div>
                          </div>
                        )}

                        {/* Cluster spoke pages */}
                        {cluster.clusterPages.length > 0 && (
                          <div>
                            <p className="text-[10.5px] font-semibold text-brand-500 uppercase tracking-wider mb-2">Cluster Spokes ({cluster.clusterPages.length})</p>
                            <div className="space-y-1.5">
                              {cluster.clusterPages.map((page, i) => (
                                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-brand-100">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                  <a href={page.url} target="_blank" rel="noopener noreferrer"
                                    className="text-[11.5px] text-brand-700 hover:underline truncate">
                                    {page.title || page.url}
                                  </a>
                                  <span className="ml-auto text-[10px] text-brand-400 shrink-0">{page.wordCount.toLocaleString()}w</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Content gaps */}
                        {cluster.contentGaps.length > 0 && (
                          <div>
                            <p className="text-[10.5px] font-semibold text-brand-500 uppercase tracking-wider mb-2">Missing Content Gaps</p>
                            <div className="space-y-2">
                              {cluster.contentGaps.map((gap, i) => {
                                const key = `${cluster.id}-${gap}`;
                                const isStaged = staged.has(key);
                                return (
                                  <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-50/70 border border-amber-200">
                                    <div className="flex items-center gap-2">
                                      <Zap size={12} className="text-amber-500 shrink-0" />
                                      <span className="text-[12px] text-amber-900 capitalize">{gap}</span>
                                    </div>
                                    <button
                                      onClick={() => stageGap(cluster.id, gap)}
                                      disabled={isStaged}
                                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 shrink-0 transition ${isStaged ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-white border border-amber-300 text-amber-800 hover:bg-amber-50"}`}
                                    >
                                      {isStaged ? <><CheckCircle size={10} /> Staged</> : <>Stage →</>}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2: Cannibalization Detector
// ─────────────────────────────────────────────────────────────────────────────

const REC_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  MERGE: { label: "Merge Pages", color: "text-rose-700", bg: "bg-rose-50 border-rose-200", icon: <GitMerge size={13} className="text-rose-500" /> },
  REDIRECT: { label: "301 Redirect", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: <ArrowRight size={13} className="text-amber-500" /> },
  DIFFERENTIATE: { label: "Differentiate", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: <Layers size={13} className="text-blue-500" /> },
  CANONICALIZE: { label: "Add Canonical", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: <RotateCcw size={13} className="text-purple-500" /> },
};

function CannibalizationTab({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useCannibalizationReport(projectId);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const copyFix = (i: number, fix: string) => {
    navigator.clipboard.writeText(fix);
    setCopied((prev) => new Set([...prev, i]));
    setTimeout(() => setCopied((prev) => { const n = new Set(prev); n.delete(i); return n; }), 2000);
  };

  if (isLoading) return <div className="py-20 text-center text-[13px] text-brand-400">Scanning for keyword cannibalization…</div>;
  if (error || !data) return <div className="py-20 text-center text-[13px] text-rose-500">Could not analyze cannibalization. Run a crawl first.</div>;

  const { scoreboard, groups } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <ScoreCard label="Cannibal Groups" value={scoreboard.totalGroups} color={scoreboard.totalGroups > 0 ? "text-rose-600" : "text-emerald-600"} />
        <ScoreCard label="High-Impact Groups" value={scoreboard.highImpactGroups} color={scoreboard.highImpactGroups > 0 ? "text-rose-600" : "text-emerald-600"} />
        <ScoreCard label="Affected Pages" value={scoreboard.affectedPages} />
        <ScoreCard label="Est. Equity Loss" value={scoreboard.estimatedEquityLoss} color="text-rose-600" />
      </div>

      {groups.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircle size={32} className="mx-auto mb-3 text-emerald-500" />
          <p className="text-[13px] font-semibold text-emerald-800">No keyword cannibalization detected</p>
          <p className="text-[12px] text-emerald-600 mt-1">Your pages have unique enough titles and headings — no SEO equity conflicts found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-brand-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-brand-100 flex items-center gap-2">
            <AlertTriangle size={15} className="text-rose-500" />
            <h3 className="text-[13px] font-semibold text-brand-950">Cannibalization Groups</h3>
            <span className="ml-auto text-[11px] text-brand-400">{groups.length} conflicts detected</span>
          </div>
          <div className="divide-y divide-brand-50">
            {groups.map((group: CannibalizationGroup, i: number) => {
              const isOpen = expanded.has(i);
              const rec = REC_CONFIG[group.recommendation] ?? REC_CONFIG.DIFFERENTIATE;
              return (
                <div key={i}>
                  <button
                    onClick={() => toggle(i)}
                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-brand-50/60 transition text-left"
                  >
                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${rec.bg} ${rec.color} flex items-center gap-1 shrink-0`}>
                      {rec.icon}
                      {rec.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-brand-950 capitalize">{group.keyword}</p>
                      <p className="text-[11px] text-brand-400 mt-0.5">{group.pages.length} pages competing</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${group.impact === "HIGH" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"} shrink-0`}>
                      {group.impact}
                    </span>
                    {isOpen ? <ChevronDown size={14} className="text-brand-400 shrink-0" /> : <ChevronRight size={14} className="text-brand-400 shrink-0" />}
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-6 pb-5 pt-1 space-y-4 bg-brand-50/30">
                          {/* Competing pages */}
                          <div>
                            <p className="text-[10.5px] font-semibold text-brand-500 uppercase tracking-wider mb-2">Competing Pages</p>
                            <div className="space-y-1.5">
                              {group.pages.map((page, j) => (
                                <div key={j} className={`flex items-center gap-3 p-2.5 rounded-lg border ${page.url === group.primaryUrl ? "bg-blue-50 border-blue-200" : "bg-white border-brand-100"}`}>
                                  {page.url === group.primaryUrl && <Star size={11} className="text-blue-500 shrink-0" />}
                                  <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-brand-700 hover:underline truncate">
                                    {page.title || page.url}
                                  </a>
                                  <span className="ml-auto text-[10px] text-brand-400 font-mono shrink-0">{page.similarityScore}% match</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Fix recommendation */}
                          <div className={`p-4 rounded-xl border ${rec.bg}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2">
                                {rec.icon}
                                <p className={`text-[12px] ${rec.color}`}>{group.fix}</p>
                              </div>
                              <button
                                onClick={() => copyFix(i, group.fix)}
                                className="px-2 py-1 rounded border border-brand-200 bg-white text-[10px] text-brand-600 flex items-center gap-1 hover:bg-brand-50 transition shrink-0"
                              >
                                {copied.has(i) ? <CheckCircle size={10} className="text-emerald-500" /> : <Copy size={10} />}
                                {copied.has(i) ? "Copied!" : "Copy fix"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3: Velocity Calendar
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_CONFIG = {
  "30-day": { label: "30 Day", color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
  "60-day": { label: "60 Day", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  "90-day": { label: "90 Day", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
};

const CONTENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  PILLAR: <Star size={12} className="text-blue-500" />,
  CLUSTER_SPOKE: <FileText size={12} className="text-emerald-500" />,
  FAQ: <BookOpen size={12} className="text-purple-500" />,
  CASE_STUDY: <TrendingUp size={12} className="text-amber-500" />,
  LANDING_PAGE: <Layers size={12} className="text-rose-500" />,
};

function VelocityCalendarTab({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useContentVelocityCalendar(projectId);
  const [activePhase, setActivePhase] = useState<string>("all");
  const [staged, setStaged] = useState<Set<string>>(new Set());

  const stageItem = (item: ContentCalendarItem) => {
    if (staged.has(item.id)) return;
    stagingEngine.stage(projectId, {
      title: item.suggestedTitle,
      category: "Content Velocity",
      source: "LOCAL_SEO_GEO",
      priority: item.estimatedImpact === "HIGH" ? "HIGH" : "MEDIUM",
      impact: item.priorityReason,
      effortHours: Math.round(item.targetWordCount / 300),
      deliverable: `Publish: ${item.suggestedSlug} (${item.targetWordCount.toLocaleString()} words)`,
    });
    setStaged((prev) => new Set([...prev, item.id]));
  };

  if (isLoading) return <div className="py-20 text-center text-[13px] text-brand-400">Building your content velocity calendar…</div>;
  if (error || !data) return <div className="py-20 text-center text-[13px] text-rose-500">Could not generate calendar. Run a crawl first.</div>;

  const { scoreboard, calendar } = data;
  const filtered = activePhase === "all" ? calendar : calendar.filter((i) => i.phase === activePhase);

  return (
    <div className="space-y-6">
      {/* Scoreboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
        <ScoreCard label="30-Day Items" value={scoreboard.thirtyDayItems} color="text-rose-600" />
        <ScoreCard label="60-Day Items" value={scoreboard.sixtyDayItems} color="text-amber-600" />
        <ScoreCard label="90-Day Items" value={scoreboard.ninetyDayItems} color="text-blue-600" />
        <ScoreCard label="Total Items" value={scoreboard.totalItems} />
        <ScoreCard label="Est. Traffic Lift" value={scoreboard.estimatedMonthlyTrafficLift} color="text-emerald-600" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {["all", "30-day", "60-day", "90-day"].map((phase) => (
          <button
            key={phase}
            onClick={() => setActivePhase(phase)}
            className={`px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition border ${activePhase === phase ? "bg-brand-950 text-white border-brand-950" : "bg-white text-brand-700 border-brand-200 hover:bg-brand-50"}`}
          >
            {phase === "all" ? "All Phases" : phase.replace("-", " ").toUpperCase()}
          </button>
        ))}
      </div>

      {/* Calendar items */}
      <div className="bg-white rounded-xl border border-brand-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-brand-50">
          {filtered.map((item: ContentCalendarItem, i: number) => {
            const phase = PHASE_CONFIG[item.phase];
            const isStaged = staged.has(item.id);
            return (
              <div key={item.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-brand-50/40 transition">
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono text-brand-400 w-8">W{item.week}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${phase.bg} ${phase.color}`}>{phase.label}</span>
                  <span className="flex items-center gap-1">{CONTENT_TYPE_ICONS[item.contentType]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-brand-950">{item.suggestedTitle}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-brand-400">
                    <span className="font-mono bg-brand-100 px-1.5 py-0.5 rounded text-brand-600">{item.suggestedSlug}</span>
                    <span>·</span>
                    <span>{item.targetWordCount.toLocaleString()} words</span>
                    <span>·</span>
                    <span>Cluster: <strong className="text-brand-600 capitalize">{item.targetCluster}</strong></span>
                  </div>
                  <p className="text-[11px] text-brand-400 mt-1 italic">{item.priorityReason}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.estimatedImpact === "HIGH" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {item.estimatedImpact}
                  </span>
                  <button
                    onClick={() => stageItem(item)}
                    disabled={isStaged}
                    className={`px-3 py-1.5 rounded-lg text-[11.5px] font-medium flex items-center gap-1.5 transition ${isStaged ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-white border border-brand-200 text-brand-950 hover:bg-brand-100"}`}
                  >
                    {isStaged ? <><CheckCircle size={11} /> Staged</> : <><Zap size={11} className="text-amber-500" /> Stage</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ContentVelocityPage() {
  const { projectId } = useWorkspace();
  const [activeTab, setActiveTab] = useState<Tab>("clusters");

  return (
    <div className="flex-1 overflow-y-auto bg-brand-50">
      <PageHeader
        title="Content Velocity Engine"
        subtitle="AI-powered topic cluster mapping, keyword cannibalization detection, and a 90-day content production calendar."
        actions={
          <ActionButton
            variant="secondary"
            icon={<TrendingUp size={12} />}
            onClick={() => window.open("/fix-engine?tab=implementation", "_blank")}
          >
            View Fix Engine Queue
          </ActionButton>
        }
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Tab nav */}
        <div className="flex gap-1 bg-brand-100 rounded-xl p-1 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-medium transition ${
                activeTab === id ? "bg-white text-brand-950 shadow-sm" : "text-brand-500 hover:text-brand-950"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {projectId ? (
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {activeTab === "clusters" && <TopicClustersTab projectId={projectId} />}
              {activeTab === "cannibalization" && <CannibalizationTab projectId={projectId} />}
              {activeTab === "calendar" && <VelocityCalendarTab projectId={projectId} />}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="py-20 text-center text-[13px] text-brand-400">Select a project to view content velocity data.</div>
        )}
      </div>
    </div>
  );
}
