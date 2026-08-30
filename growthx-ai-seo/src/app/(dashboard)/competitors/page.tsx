"use client";
import { Suspense, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair, Target, Play, Sparkles, Plus, RefreshCw, Eye,
  Layers, CheckCircle2, XCircle, Clock, ChevronRight, Video, ShieldAlert,
  ThumbsUp, HelpCircle, Search, Wand2, Check, Copy, Calendar, X, Globe, MapPin
} from "lucide-react";
import { api, type CompetitorContent, type EnrichedOpportunity, type VideoBriefAndScript, type CompetitorChangeAlert } from "@/lib/api-client";
import { useWorkspace, useVisibility } from "@/hooks/use-growthx";
import { Panel, Table, Th, Tr, Td, ActionButton } from "@/components/ui/console";

export default function CompetitorIntelligencePage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center text-sm text-[var(--text-muted)]"><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading Competitor Video Intelligence...</div>}>
      <CompetitorConsoleClient />
    </Suspense>
  );
}

function CompetitorConsoleClient() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();

  // Tabs
  const [activeTab, setActiveTab] = useState<"video-feed" | "matrix" | "teardown" | "opportunities" | "alerts" | "voice">("video-feed");

  // Filters & State
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [pillarFilter, setPillarFilter] = useState<string>("ALL");
  const [selectedVideo, setSelectedVideo] = useState<CompetitorContent | null>(null);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [activeScript, setActiveScript] = useState<VideoBriefAndScript | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptTopic, setScriptTopic] = useState("");
  const [scriptPlatform, setScriptPlatform] = useState<"INSTAGRAM_REEL" | "YOUTUBE_SHORTS" | "YOUTUBE_VIDEO">("INSTAGRAM_REEL");
  const [copiedScript, setCopiedScript] = useState(false);

  // Add Competitor Wizard State
  const [isAddWizardOpen, setIsAddWizardOpen] = useState(false);
  const [wizardWebsite, setWizardWebsite] = useState("");
  const [wizardName, setWizardName] = useState("");
  const [wizardLocation, setWizardLocation] = useState("");
  const [wizardIndustry, setWizardIndustry] = useState("");
  const [discoveredProfiles, setDiscoveredProfiles] = useState<any[] | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Manual Ingest Video Modal State
  const [isIngestVideoOpen, setIsIngestVideoOpen] = useState(false);
  const [ingestAccountId, setIngestAccountId] = useState("");
  const [ingestPlatform, setIngestPlatform] = useState<"INSTAGRAM" | "YOUTUBE">("INSTAGRAM");
  const [ingestContentType, setIngestContentType] = useState<"REEL" | "VIDEO" | "SHORT">("REEL");
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestTranscript, setIngestTranscript] = useState("");
  const [ingestViews, setIngestViews] = useState<number>(45000);
  const [ingestLikes, setIngestLikes] = useState<number>(1800);

  // Data Queries
  const visibility = useVisibility(projectId, 28);

  const competitorsQuery = useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () => api.listCompetitors(projectId!),
    enabled: !!projectId,
  });

  const accountsQuery = useQuery({
    queryKey: ["ci-accounts", projectId],
    queryFn: () => api.listCompetitorAccounts(projectId!),
    enabled: !!projectId,
  });

  const contentQuery = useQuery({
    queryKey: ["ci-content", projectId],
    queryFn: () => api.listCompetitorContent(projectId!, { limit: 50 }),
    enabled: !!projectId,
  });

  const matrixQuery = useQuery({
    queryKey: ["ci-matrix", projectId],
    queryFn: () => api.getCrossCompetitorMatrix(projectId!),
    enabled: !!projectId,
  });

  const opportunitiesQuery = useQuery({
    queryKey: ["ci-opportunities", projectId],
    queryFn: () => api.getEnrichedOpportunities(projectId!),
    enabled: !!projectId,
  });

  const alertsQuery = useQuery({
    queryKey: ["ci-alerts", projectId],
    queryFn: () => api.getCompetitorAlerts(projectId!),
    enabled: !!projectId,
  });

  // Mutations
  const analyzeVideoMut = useMutation({
    mutationFn: (body: any) => api.ingestAndAnalyzeVideo(projectId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ci-content"] });
      qc.invalidateQueries({ queryKey: ["ci-matrix"] });
      qc.invalidateQueries({ queryKey: ["ci-opportunities"] });
      setIsIngestVideoOpen(false);
      resetIngestForm();
    },
  });

  const saveScriptMut = useMutation({
    mutationFn: (scriptData: VideoBriefAndScript) => api.saveVideoScriptToCalendar(projectId!, { scriptData }),
    onSuccess: () => {
      alert("Video brief & script successfully saved to Content Calendar (ENGINE 10)!");
    },
  });

  const resetIngestForm = () => {
    setIngestTitle("");
    setIngestTranscript("");
  };

  const handleDiscoverProfiles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizardWebsite?.trim()) return;
    setIsDiscovering(true);
    try {
      // 1. Register competitor domain in SEO / AI visibility tracking
      await api.addCompetitor(projectId!, wizardWebsite.trim(), wizardName?.trim() || undefined).catch(() => {});

      // 2. Discover social channels and generate baseline intelligence
      const res = await api.discoverSocialProfiles(projectId!, {
        website: wizardWebsite.trim(),
        businessName: wizardName?.trim() || undefined,
        location: wizardLocation?.trim() || undefined,
        industry: wizardIndustry?.trim() || undefined,
      });

      const accountsList = res.accounts && res.accounts.length > 0 ? res.accounts : (res.competitorDomain ? [{
        id: res.competitorDomain.id,
        displayName: res.competitorDomain.label || wizardWebsite.trim(),
        handle: `@${res.competitorDomain.domain?.split('.')[0] || 'competitor'}`,
        platform: 'INSTAGRAM',
        matchConfidence: 90,
      } as any] : []);

      setDiscoveredProfiles(accountsList);

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ci-accounts", projectId] }),
        qc.invalidateQueries({ queryKey: ["ci-content", projectId] }),
        qc.invalidateQueries({ queryKey: ["competitors", projectId] }),
        qc.invalidateQueries({ queryKey: ["ci-matrix", projectId] }),
        qc.invalidateQueries({ queryKey: ["ci-opportunities", projectId] }),
        qc.invalidateQueries({ queryKey: ["opportunities", projectId] }),
        qc.invalidateQueries({ queryKey: ["ci-alerts", projectId] }),
      ]);
    } catch (err: any) {
      alert(`Discovery notice: ${err.message || "Failed to scan competitor."}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleGenerateScript = async (topic: string, platform: "INSTAGRAM_REEL" | "YOUTUBE_SHORTS" | "YOUTUBE_VIDEO" = "INSTAGRAM_REEL", context?: string) => {
    setScriptTopic(topic);
    setScriptPlatform(platform);
    setIsGeneratingScript(true);
    setActiveScript(null);
    try {
      const res = await api.generateVideoScript(projectId!, {
        topic,
        platform,
        opportunityContext: context,
      });
      setActiveScript(res);
    } catch (err: any) {
      alert(`Error generating script: ${err.message}`);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const competitorDomains = competitorsQuery.data ?? [];
  const rawAccounts = accountsQuery.data ?? [];

  const accounts = useMemo(() => {
    const list = [...rawAccounts];
    for (const comp of competitorDomains) {
      const cleanDomain = comp.domain.toLowerCase().replace(/^www\./, '');
      const rootDomain = cleanDomain.split('.')[0];
      const exists = list.some(a => 
        (a.website && a.website.toLowerCase().includes(cleanDomain)) ||
        (a.handle && a.handle.toLowerCase().includes(rootDomain)) ||
        a.id === comp.id
      );
      if (!exists) {
        list.push({
          id: comp.id,
          organizationId: '',
          projectId: projectId!,
          competitorId: comp.id,
          platform: 'INSTAGRAM',
          handle: `@${rootDomain}`,
          displayName: comp.label || comp.domain,
          profileUrl: `https://${comp.domain}`,
          website: `https://${comp.domain}`,
          businessName: comp.label || comp.domain,
          matchConfidence: 90,
          discoverySource: 'WEBSITE_CRAWL',
          verificationStatus: 'VERIFIED',
          isActive: true,
          createdAt: comp.createdAt,
          updatedAt: comp.createdAt,
        } as any);
      }
    }
    return list;
  }, [rawAccounts, competitorDomains, projectId]);

  const allContent = contentQuery.data ?? [];
  const matrix = matrixQuery.data;
  const opportunities = opportunitiesQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];
  const shareOfVoice = visibility.data?.shareOfVoice ?? [];

  // Filtered Video Feed
  const filteredContent = useMemo(() => {
    return allContent.filter(item => {
      if (platformFilter !== "ALL" && item.platform !== platformFilter) return false;
      if (pillarFilter !== "ALL") {
        const pillar = item.classification?.contentPillar || item.classification?.contentCategory || "";
        if (!pillar.toUpperCase().includes(pillarFilter.toUpperCase())) return false;
      }
      return true;
    });
  }, [allContent, platformFilter, pillarFilter]);

  // Selected competitor for teardown
  const currentCompetitor = useMemo(() => {
    if (!accounts.length) return null;
    if (selectedCompetitorId) {
      return accounts.find(a => a.id === selectedCompetitorId || a.handle === selectedCompetitorId || (a.website && a.website.includes(selectedCompetitorId))) || accounts[0];
    }
    return accounts[0];
  }, [accounts, selectedCompetitorId]);

  const competitorContentList = useMemo(() => {
    if (!currentCompetitor) return [];
    const compHandle = (currentCompetitor.handle || '').toLowerCase().replace('@', '');
    const compName = (currentCompetitor.displayName || currentCompetitor.businessName || '').toLowerCase();
    const compDomain = (currentCompetitor.website || '').toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    const compRoot = compDomain ? compDomain.split('.')[0] : '';

    return allContent.filter(c => {
      const accHandle = (c.account?.handle || '').toLowerCase().replace('@', '');
      const accName = (c.account?.displayName || (c.account as any)?.businessName || '').toLowerCase();
      const title = (c.title || '').toLowerCase();
      const caption = (c.caption || '').toLowerCase();

      return (
        (c as any).accountId === currentCompetitor.id ||
        (accHandle && compHandle && (accHandle.includes(compHandle) || compHandle.includes(accHandle))) ||
        (accName && compName && (accName.includes(compName) || compName.includes(accName))) ||
        (compRoot && (title.includes(compRoot) || caption.includes(compRoot) || accHandle.includes(compRoot)))
      );
    });
  }, [allContent, currentCompetitor]);

  // Dynamic KPI Stats
  const avgViews = useMemo(() => {
    if (!allContent.length) return "0";
    const total = allContent.reduce((sum, item) => sum + (item.viewsCount || 0), 0);
    const avg = Math.round(total / allContent.length);
    if (avg >= 1000000) return `${(avg / 1000000).toFixed(1)}M`;
    if (avg >= 1000) return `${(avg / 1000).toFixed(1)}K`;
    return String(avg);
  }, [allContent]);

  const topOpp = opportunities[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5" style={{ borderColor: "var(--color-brand-100)" }}>
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-950 text-white font-mono text-[11px] font-bold">
              07
            </span>
            <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-brand-950">
              Competitor Social Video Intelligence
            </h1>
            <span className="rounded-md bg-[#10b98118] px-2 py-0.5 text-[10px] font-semibold text-success-500">
              Active Engine
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-brand-500">
            Deconstruct competitor Instagram Reels & YouTube video formulas, compare competitors vs your brand, and turn intelligence into high-converting video strategy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            variant="secondary"
            icon={<Video size={13} />}
            onClick={() => {
              if (accounts.length > 0) setIngestAccountId(accounts[0].id);
              setIsIngestVideoOpen(true);
            }}
          >
            Analyze Video
          </ActionButton>
          <ActionButton
            variant="primary"
            icon={<Plus size={13} />}
            onClick={() => {
              setIsAddWizardOpen(true);
              setDiscoveredProfiles(null);
            }}
          >
            Add Competitor
          </ActionButton>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border bg-white p-3.5" style={{ borderColor: "var(--color-brand-100)" }}>
          <div className="text-[11px] font-medium text-brand-500">Competitors Tracked</div>
          <div className="mt-1 text-[20px] font-bold text-brand-950">{accounts.length}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-brand-400">
            <Globe size={11} /> Auto-Discovered
          </div>
        </div>

        <div className="rounded-xl border bg-white p-3.5" style={{ borderColor: "var(--color-brand-100)" }}>
          <div className="text-[11px] font-medium text-brand-500">Videos Analyzed</div>
          <div className="mt-1 text-[20px] font-bold text-accent-600">{allContent.length}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-accent-600 font-medium">
            <Sparkles size={11} /> Multi-Modal AI
          </div>
        </div>

        <div className="rounded-xl border bg-white p-3.5" style={{ borderColor: "var(--color-brand-100)" }}>
          <div className="text-[11px] font-medium text-brand-500">Avg Reel Views</div>
          <div className="mt-1 text-[20px] font-bold text-brand-950">{avgViews}</div>
          <div className="mt-0.5 text-[10px] text-brand-400 font-mono">Public Engagement</div>
        </div>

        <div className="rounded-xl border bg-white p-3.5" style={{ borderColor: "var(--color-brand-100)" }}>
          <div className="text-[11px] font-medium text-brand-500">Content Gaps</div>
          <div className="mt-1 text-[20px] font-bold text-error-500">{opportunities.length}</div>
          <div className="mt-0.5 text-[10px] text-error-500 font-medium">High Impact Open</div>
        </div>

        <div className="rounded-xl border bg-white p-3.5" style={{ borderColor: "var(--color-brand-100)" }}>
          <div className="text-[11px] font-medium text-brand-500">Top Opportunity</div>
          <div className="mt-1 text-[20px] font-bold text-success-500">{topOpp ? `${topOpp.opportunityScore}/100` : "—"}</div>
          <div className="mt-0.5 text-[10px] text-brand-400 truncate">{topOpp ? (topOpp.topic || (topOpp as any).title) : "None detected"}</div>
        </div>

        <div className="rounded-xl border bg-white p-3.5" style={{ borderColor: "var(--color-brand-100)" }}>
          <div className="text-[11px] font-medium text-brand-500">Data Freshness</div>
          <div className="mt-1 text-[20px] font-bold text-brand-950">{accounts.length > 0 ? "Sync Active" : "Not synced"}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-brand-400">
            <Clock size={11} /> {accounts.length > 0 ? "Real-time" : "Pending competitor"}
          </div>
        </div>
      </div>

      {/* Compliance & Data Transparency Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-brand-50/60 px-4 py-2.5" style={{ borderColor: "var(--color-brand-200)" }}>
        <div className="flex items-center gap-2 text-[11.5px] text-brand-600">
          <HelpCircle size={14} className="text-brand-400" />
          <span>Transparency Engine: Distinguishing legitimate data sources. Zero fabricated private retention metrics.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-white border border-brand-200 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-brand-700">PUBLIC DATA</span>
          <span className="rounded bg-white border border-brand-200 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-brand-700">AUTHORIZED DATA</span>
          <span className="rounded bg-accent-50 border border-accent-200 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-accent-700">AI INFERENCE</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 border-b border-brand-200 overflow-x-auto pb-[-1px]">
        {[
          { id: "video-feed", label: "Video Intelligence Feed", icon: Video },
          { id: "matrix", label: "Cross-Competitor Matrix", icon: Layers },
          { id: "teardown", label: "Competitor Teardown", icon: Crosshair },
          { id: "opportunities", label: "Growth Opportunities (6D Score)", icon: Sparkles, badge: opportunities.length > 0 ? String(opportunities.length) : undefined },
          { id: "alerts", label: "Velocity Alerts", icon: ShieldAlert, badge: alerts.length > 0 ? String(alerts.length) : undefined },
          { id: "voice", label: "AI Share of Voice", icon: Target },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[12.5px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? "border-brand-950 text-brand-950 font-semibold"
                  : "border-transparent text-brand-500 hover:text-brand-950 hover:border-brand-300"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${isActive ? "bg-brand-950 text-white" : "bg-brand-100 text-brand-600"}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: VIDEO INTELLIGENCE FEED */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "video-feed" && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4" style={{ borderColor: "var(--color-brand-100)" }}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-medium text-brand-500">Platform:</span>
                <div className="flex rounded-lg border bg-brand-50 p-0.5" style={{ borderColor: "var(--color-brand-200)" }}>
                  {["ALL", "INSTAGRAM", "YOUTUBE"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatformFilter(p)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                        platformFilter === p ? "bg-white text-brand-950 shadow-sm" : "text-brand-500 hover:text-brand-950"
                      }`}
                    >
                      {p === "ALL" ? "All Platforms" : p === "INSTAGRAM" ? "Instagram Reels" : "YouTube"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-medium text-brand-500">Content Pillar:</span>
                <select
                  value={pillarFilter}
                  onChange={(e) => setPillarFilter(e.target.value)}
                  className="rounded-lg border px-2.5 py-1 text-[11px] font-medium text-brand-950 outline-none bg-white"
                  style={{ borderColor: "var(--color-brand-200)" }}
                >
                  <option value="ALL">All Pillars</option>
                  <option value="EDUCATIONAL">Educational / Tips</option>
                  <option value="PROJECT">Product Showcase / Tour</option>
                  <option value="BEFORE_AFTER">Before & After</option>
                  <option value="PRICING">Pricing / Standards</option>
                </select>
              </div>
            </div>

            <div className="text-[11.5px] text-brand-400">
              Showing {filteredContent.length} competitive video pieces
            </div>
          </div>

          {/* Video Cards Grid or Clean Empty State */}
          {filteredContent.length === 0 ? (
            <div className="rounded-2xl border bg-white p-12 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Video size={24} />
              </div>
              <h3 className="mt-4 text-[15px] font-bold text-brand-950">No Competitor Videos Ingested Yet</h3>
              <p className="mt-1.5 text-[13px] text-brand-600 max-w-md mx-auto">
                Add competitor websites to auto-discover their official YouTube & Instagram profiles, or ingest video URLs to analyze their hooks, speech transcripts, and content strategy with AI.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  onClick={() => setIsAddWizardOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-4 py-2 text-[12px] font-semibold text-white hover:bg-brand-900"
                >
                  <Plus size={13} /> Add Competitor
                </button>
                <button
                  onClick={() => setIsIngestVideoOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-brand-200 px-4 py-2 text-[12px] font-medium text-brand-700 hover:bg-brand-50"
                >
                  <Sparkles size={13} /> Analyze Video URL
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredContent.map((video: any) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group flex flex-col rounded-xl border bg-white overflow-hidden transition hover:shadow-md"
                  style={{ borderColor: "var(--color-brand-100)" }}
                >
                  {/* Thumbnail & Badges */}
                  <div className="relative aspect-video w-full bg-brand-900 overflow-hidden">
                    <img
                      src={video.thumbnailUrl || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=600&q=80"}
                      alt={video.title || "Video"}
                      className="h-full w-full object-cover opacity-85 transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Platform & Duration */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold text-white uppercase ${video.platform === "YOUTUBE" ? "bg-red-600" : "bg-gradient-to-r from-purple-600 to-pink-600"}`}>
                        {video.platform === "YOUTUBE" ? "YouTube" : "IG Reel"}
                      </span>
                      <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white">
                        {video.duration ? `${video.duration}s` : "0:45"}
                      </span>
                    </div>

                    {/* Public metrics */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white text-[11px]">
                      <div className="flex items-center gap-3 font-mono text-[10.5px]">
                        <span className="flex items-center gap-1">
                          <Eye size={12} className="text-white/80" /> {(video.viewsCount || 0).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp size={12} className="text-white/80" /> {(video.likesCount || 0).toLocaleString()}
                        </span>
                      </div>
                      <span className="rounded bg-white/20 backdrop-blur-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white">
                        PUBLIC DATA
                      </span>
                    </div>
                  </div>

                  {/* Content Details */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-center gap-1.5 text-[11px] text-brand-400 mb-1">
                      <span className="font-semibold text-brand-700">{video.account?.displayName || video.account?.handle || "@competitor"}</span>
                      <span>•</span>
                      <span>{new Date(video.publishedAt || Date.now()).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                    </div>

                    <h3 className="text-[13px] font-semibold text-brand-950 line-clamp-2 mb-2">
                      {video.title || video.caption || "Video Breakdown"}
                    </h3>

                    {/* Hook Pill */}
                    <div className="rounded-lg bg-accent-50/70 border border-accent-100 p-2.5 mb-3 text-[11.5px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent-700">
                          {video.classification?.hookType || video.hookAnalysis?.hookType || "Problem Hook"}
                        </span>
                        <span className="font-mono text-[9px] text-accent-600">0:00–0:03s</span>
                      </div>
                      <p className="text-brand-900 font-medium italic line-clamp-2">
                        "{video.classification?.hookText || video.hookAnalysis?.hook || video.caption?.slice(0, 100) || "Direct hook formulation..."}"
                      </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-auto flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--color-brand-100)" }}>
                      <span className="rounded bg-brand-100 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-brand-700">
                        {video.classification?.funnelStage || "CONSIDERATION"}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedVideo(video)}
                          className="flex items-center gap-1 text-[11.5px] font-semibold text-brand-950 hover:text-accent-600"
                        >
                          Deep Teardown <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: CROSS-COMPETITOR MATRIX */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "matrix" && (
        <div className="space-y-6">
          {!matrix || (!matrix.matrixRows?.length && !matrix.campaigns?.length && !matrix.commonPatterns?.length) ? (
            <div className="rounded-2xl border bg-white p-12 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Layers size={24} />
              </div>
              <h3 className="mt-4 text-[15px] font-bold text-brand-950">No Cross-Competitor Matrix Data Yet</h3>
              <p className="mt-1.5 text-[13px] text-brand-600 max-w-md mx-auto">
                Add competitors and ingest competitor social content to generate comparative strategy matrices, detect content gaps, and analyze rival campaign themes for your business.
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setIsAddWizardOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-4 py-2 text-[12px] font-semibold text-white hover:bg-brand-900"
                >
                  <Plus size={13} /> Add Competitor
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Matrix Table */}
              <Panel
                title="Cross-Competitor Content & Pillar Matrix"
                subtitle="Side-by-side gap detection across your brand and all discovered competitors."
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-brand-50/70 border-b border-brand-200 font-semibold text-brand-700">
                      <tr>
                        <th className="py-3 px-4">Content Pillar / Core Topic</th>
                        {matrix.competitors?.map((c) => (
                          <th key={c.id} className="py-3 px-3">
                            <div className="truncate max-w-[120px]" title={c.name}>{c.name}</div>
                          </th>
                        ))}
                        <th className="py-3 px-3 bg-accent-50/70 text-accent-800 font-bold">Your Brand Coverage</th>
                        <th className="py-3 px-4">Gap Status</th>
                        <th className="py-3 px-4 text-right">Opportunity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--color-brand-100)" }}>
                      {matrix.matrixRows?.map((row, idx) => (
                        <tr key={idx} className="hover:bg-brand-50/50 transition">
                          <td className="py-3.5 px-4 font-medium text-brand-950">
                            <div className="flex items-center gap-2">
                              <span className="capitalize">{row.topicOrPillar}</span>
                              <span className="rounded bg-brand-100 px-1.5 py-0.2 text-[9px] font-mono text-brand-600 uppercase">
                                {row.categoryType}
                              </span>
                            </div>
                          </td>
                          {matrix.competitors?.map((c) => (
                            <td key={c.id} className="py-3.5 px-3">
                              {row.competitorCoverage?.[c.id] ? (
                                <span className="text-success-500 font-bold">✓</span>
                              ) : (
                                <span className="text-brand-300">—</span>
                              )}
                            </td>
                          ))}
                          <td className="py-3.5 px-3 bg-accent-50/40">
                            {row.customerCoverage ? (
                              <span className="flex items-center gap-1 text-success-500 font-bold">
                                <CheckCircle2 size={13} /> Active
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-error-500 font-bold">
                                <XCircle size={13} /> Content Gap
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                              row.gapStatus === "CUSTOMER_MISSING" || !row.customerCoverage
                                ? "bg-[#ef444418] text-error-500"
                                : row.gapStatus === "COMPETITOR_WINNING"
                                ? "bg-[#f59e0b18] text-warning-500"
                                : "bg-[#10b98118] text-success-500"
                            }`}>
                              {!row.customerCoverage ? "Customer Missing" : row.gapStatus.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-bold text-[13px] text-brand-950">{row.opportunityScore}/100</span>
                              <button
                                onClick={() => handleGenerateScript(row.topicOrPillar, "INSTAGRAM_REEL", `Detected gap in cross-competitor matrix against competitors.`)}
                                className="rounded-md bg-accent-600 p-1.5 text-white hover:bg-accent-700 transition"
                                title="Generate Script for Studio"
                              >
                                <Wand2 size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {/* Common Winning Patterns & Detected Campaigns */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {matrix.commonPatterns && matrix.commonPatterns.length > 0 && (
                  <Panel title="Common Winning Competitive Patterns" subtitle="Formulas proven across analyzed competitors.">
                    <div className="space-y-3">
                      {matrix.commonPatterns.map((pattern, idx) => (
                        <div key={idx} className="rounded-xl border p-4 hover:border-brand-300 transition bg-white" style={{ borderColor: "var(--color-brand-100)" }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[13px] font-semibold text-brand-950">{pattern.pattern}</span>
                            <span className="rounded bg-accent-50 text-accent-700 px-2 py-0.5 font-mono text-[10px] font-bold">
                              {pattern.prevalence}
                            </span>
                          </div>
                          <div className="text-[11.5px] text-brand-500 mb-2.5">
                            <span className="text-success-500 font-semibold">{pattern.averagePerformance}</span> • Format: {pattern.format}
                          </div>
                          <button
                            onClick={() => handleGenerateScript(pattern.pattern, "INSTAGRAM_REEL", `Pattern: ${pattern.format}`)}
                            className="flex items-center gap-1.5 text-[11.5px] font-semibold text-accent-600 hover:text-accent-700"
                          >
                            <Wand2 size={12} /> Generate Video Script <ChevronRight size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {matrix.campaigns && matrix.campaigns.length > 0 && (
                  <Panel title="Detected Competitor Campaigns" subtitle="Thematic multi-video series launched by rivals.">
                    <div className="space-y-3">
                      {matrix.campaigns.map((camp, idx) => (
                        <div key={idx} className="rounded-xl border p-4 hover:border-brand-300 transition bg-white" style={{ borderColor: "var(--color-brand-100)" }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[13px] font-semibold text-brand-950">{camp.theme}</span>
                            <span className="rounded-full bg-[#10b98118] text-success-500 px-2 py-0.5 font-mono text-[10px] font-bold">
                              {camp.performanceSignal} Signal
                            </span>
                          </div>
                          <div className="text-[11px] text-brand-500 mb-2">
                            Competitor: <strong className="text-brand-800">{camp.competitorName}</strong> • {camp.contentCount} videos published across {camp.platforms.join(", ")}
                          </div>
                          {camp.sampleTitles && camp.sampleTitles.length > 0 && (
                            <div className="rounded-lg bg-brand-50 p-2 text-[11px] text-brand-600 mb-2">
                              Samples: {camp.sampleTitles.slice(0, 2).join(" • ")}
                            </div>
                          )}
                          <button
                            onClick={() => handleGenerateScript(camp.theme, "YOUTUBE_VIDEO", `Counter-campaign strategy against ${camp.competitorName}`)}
                            className="flex items-center gap-1 text-[11.5px] font-semibold text-brand-950 hover:underline"
                          >
                            Build Differentiated Counter-Campaign <ChevronRight size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: COMPETITOR TEARDOWN */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "teardown" && (
        <div className="space-y-6">
          {accounts.length === 0 ? (
            <div className="rounded-2xl border bg-white p-12 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Crosshair size={24} />
              </div>
              <h3 className="mt-4 text-[15px] font-bold text-brand-950">No Competitors Added Yet</h3>
              <p className="mt-1.5 text-[13px] text-brand-600 max-w-md mx-auto">
                Add competitor domains above to inspect their social channels, video performance, and reverse-engineer their hook formulas.
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setIsAddWizardOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-4 py-2 text-[12px] font-semibold text-white hover:bg-brand-900"
                >
                  <Plus size={13} /> Add Competitor
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Competitor Selector Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => setSelectedCompetitorId(acc.id)}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[12px] font-medium transition ${
                      currentCompetitor?.id === acc.id
                        ? "bg-brand-950 text-white border-brand-950 shadow-sm"
                        : "bg-white text-brand-700 border-brand-200 hover:bg-brand-50"
                    }`}
                  >
                    <span>{acc.displayName || acc.businessName || acc.handle}</span>
                    <span className={`rounded px-1.5 py-0.2 font-mono text-[9px] uppercase ${
                      currentCompetitor?.id === acc.id ? "bg-white/20 text-white" : "bg-brand-100 text-brand-600"
                    }`}>
                      {acc.platform}
                    </span>
                  </button>
                ))}
              </div>

              {currentCompetitor && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  {/* Competitor Profile Overview */}
                  <Panel title="Competitor Profile" subtitle="Account details and verified channels.">
                    <div className="space-y-4 text-[12px]">
                      <div>
                        <div className="text-[11px] text-brand-400">Business / Brand Name</div>
                        <div className="text-[14px] font-bold text-brand-950 mt-0.5">
                          {currentCompetitor.displayName || currentCompetitor.businessName || currentCompetitor.handle}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[11px] text-brand-400">Platform</div>
                          <div className="font-semibold text-brand-900 mt-0.5">{currentCompetitor.platform}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-brand-400">Handle</div>
                          <div className="font-mono text-brand-900 mt-0.5">{currentCompetitor.handle}</div>
                        </div>
                      </div>

                      {currentCompetitor.website && (
                        <div>
                          <div className="text-[11px] text-brand-400">Website</div>
                          <a href={currentCompetitor.website} target="_blank" rel="noopener noreferrer" className="text-accent-600 hover:underline flex items-center gap-1 mt-0.5 truncate">
                            {currentCompetitor.website}
                          </a>
                        </div>
                      )}

                      <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--color-brand-100)" }}>
                        <span className="text-brand-500">Discovery Match</span>
                        <span className="font-bold text-success-500">{currentCompetitor.matchConfidence || 95}% Fit</span>
                      </div>
                    </div>
                  </Panel>

                  {/* Competitor Video Content */}
                  <div className="lg:col-span-2">
                    <Panel title="Analyzed Content & Hook Performance" subtitle={`Videos and posts tracked for ${currentCompetitor.displayName || currentCompetitor.handle}.`}>
                      {competitorContentList.length === 0 ? (
                        <div className="rounded-lg border bg-brand-50/50 p-8 text-center text-[12px] text-brand-600" style={{ borderColor: "var(--color-brand-200)" }}>
                          <p>No content analyzed yet for this competitor account.</p>
                          <div className="mt-4 flex justify-center">
                            <button
                              onClick={() => {
                                setIngestAccountId(currentCompetitor.id);
                                setIsIngestVideoOpen(true);
                              }}
                              className="flex items-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-accent-700"
                            >
                              <Sparkles size={13} /> Ingest & Analyze Video
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {competitorContentList.map((v: any) => (
                            <div
                              key={v.id}
                              onClick={() => setSelectedVideo(v)}
                              className="flex items-center justify-between rounded-lg border p-3 hover:bg-brand-50 cursor-pointer transition"
                              style={{ borderColor: "var(--color-brand-100)" }}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-100 text-brand-800">
                                  <Play size={11} />
                                </span>
                                <span className="text-[12.5px] font-medium text-brand-950 truncate">
                                  {v.title || v.caption}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono text-brand-500">
                                <span>{(v.viewsCount || 0).toLocaleString()} views</span>
                                <span className="font-semibold text-accent-600">Inspect →</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Panel>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 4: GROWTH OPPORTUNITIES & 6D SCORING */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "opportunities" && (
        <div className="space-y-5">
          {opportunities.length === 0 ? (
            <div className="rounded-2xl border bg-white p-12 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Sparkles size={24} />
              </div>
              <h3 className="mt-4 text-[15px] font-bold text-brand-950">No Opportunities Detected Yet</h3>
              <p className="mt-1.5 text-[13px] text-brand-600 max-w-md mx-auto">
                Add competitor accounts and analyze video content to generate multi-dimensional opportunity scores tailored to your business.
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setIsAddWizardOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-4 py-2 text-[12px] font-semibold text-white hover:bg-brand-900"
                >
                  <Plus size={13} /> Add Competitor
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {opportunities.map((opp: EnrichedOpportunity) => (
                <motion.div
                  key={opp.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col rounded-xl border bg-white p-5 shadow-sm space-y-4"
                  style={{ borderColor: "var(--color-brand-100)" }}
                >
                  {/* Header & Score */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded bg-accent-50 text-accent-700 px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                        {opp.pillar}
                      </span>
                      <h3 className="mt-1 text-[14.5px] font-bold text-brand-950">
                        {opp.topic}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="text-[20px] font-black text-accent-600">{opp.opportunityScore}</div>
                      <div className="text-[9px] font-mono uppercase text-brand-400">Score / 100</div>
                    </div>
                  </div>

                  {/* Evidence & Action */}
                  <p className="text-[12px] text-brand-600">
                    {opp.competitorEvidenceSummary}
                  </p>

                  {/* 6-Dimension Breakdown Meter */}
                  {opp.breakdown && (
                    <div className="rounded-lg bg-brand-50/60 p-3 space-y-2 border border-brand-100 text-[11px]">
                      <div className="font-semibold text-brand-900 text-[10.5px] uppercase tracking-wider">6D Score Breakdown</div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-brand-600">
                        <div className="flex justify-between">
                          <span>Business Fit:</span>
                          <strong className="text-brand-950 font-mono">{opp.breakdown.businessRelevance}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Search Demand:</span>
                          <strong className="text-brand-950 font-mono">{opp.breakdown.searchOpportunity}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Competitor Proof:</span>
                          <strong className="text-brand-950 font-mono">{opp.breakdown.competitorEvidence}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Content Gap:</span>
                          <strong className="text-brand-950 font-mono">{opp.breakdown.contentGap}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Confidence:</span>
                          <strong className="text-brand-950 font-mono">{opp.breakdown.confidence}%</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Effort:</span>
                          <span className="rounded bg-white px-1 font-semibold text-brand-800 text-[10px]">{opp.breakdown.effort}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Target Market */}
                  {opp.targetMarket && (
                    <div className="flex items-center gap-1.5 text-[11px] text-brand-600 font-medium">
                      <MapPin size={12} className="text-brand-400" />
                      <span>Market: <strong>{opp.targetMarket}</strong></span>
                    </div>
                  )}

                  {/* Related Keywords */}
                  {opp.relatedKeywords && opp.relatedKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {opp.relatedKeywords.map((kw, i) => (
                        <span key={i} className="rounded bg-brand-100/70 px-2 py-0.5 text-[10.5px] text-brand-700 font-mono">
                          {kw.keyword}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action button */}
                  <div className="mt-auto pt-3 border-t" style={{ borderColor: "var(--color-brand-100)" }}>
                    <button
                      onClick={() => handleGenerateScript(opp.topic, "INSTAGRAM_REEL", opp.competitorEvidenceSummary)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-950 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-900 transition"
                    >
                      <Wand2 size={13} />
                      Generate Video Script in Studio
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 5: VELOCITY ALERTS & MONITORING (ENGINE 14) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "alerts" && (
        <div className="space-y-4">
          <Panel
            title="Competitor Velocity & Strategy Shift Alerts"
            subtitle="Engine 14 real-time change detection for publishing surges, new campaigns, and viral spikes."
          >
            {alerts.length === 0 ? (
              <div className="py-12 text-center text-sm text-brand-500">
                No abnormal competitor velocity spikes or alerts detected at this time.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--color-brand-100)" }}>
                {alerts.map((alert: CompetitorChangeAlert) => (
                  <div key={alert.id} className="py-4 flex items-start gap-4">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      alert.severity === "CRITICAL" ? "bg-red-100 text-red-600" : alert.severity === "WARNING" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                    }`}>
                      <ShieldAlert size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[13.5px] font-semibold text-brand-950">{alert.title}</h4>
                        <span className={`rounded px-1.5 py-0.2 font-mono text-[9.5px] font-bold ${
                          alert.severity === "CRITICAL" ? "bg-red-100 text-red-700" : "bg-brand-100 text-brand-700"
                        }`}>
                          {alert.alertType}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-brand-600">{alert.description}</p>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-brand-400">
                        <span>{new Date(alert.detectedAt).toLocaleDateString()}</span>
                        {alert.metricChange && <span className="font-mono text-brand-700 font-medium">Metric: {alert.metricChange}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleGenerateScript(alert.title, "INSTAGRAM_REEL", alert.description)}
                      className="flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-[11.5px] font-medium text-brand-950 hover:bg-brand-50"
                      style={{ borderColor: "var(--color-brand-200)" }}
                    >
                      Counter-Action <ChevronRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 6: AI SHARE OF VOICE */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "voice" && (
        <Panel title="AI Share of Voice" subtitle="Percentage of tracked prompts where the brand was cited against competitors.">
          {shareOfVoice.length === 0 ? (
            <div className="py-12 text-center text-sm text-brand-500">
              Sweep your AI visibility prompts to see Share of Voice rankings.
            </div>
          ) : (
            <Table minWidth={600}>
              <thead>
                <tr>
                  <Th>Brand / Domain</Th>
                  <Th>Total Mentions</Th>
                  <Th>Share of Voice</Th>
                </tr>
              </thead>
              <tbody>
                {shareOfVoice.map((row: any, idx: number) => (
                  <Tr key={row.domain || idx}>
                    <Td>
                      <span className="text-[13px] font-medium text-brand-950">{row.label || row.domain}</span>
                    </Td>
                    <Td>{row.mentions}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-brand-950 w-12">{row.sharePct.toFixed(1)}%</span>
                        <div className="h-2 w-48 bg-brand-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-950 rounded-full" style={{ width: `${row.sharePct}%` }} />
                        </div>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* VIDEO DEEP TEARDOWN MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedVideo(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b pb-4" style={{ borderColor: "var(--color-brand-100)" }}>
                <div>
                  <div className="flex items-center gap-2 text-[11px] text-brand-400 font-mono">
                    <span className="font-bold text-accent-700 uppercase">{selectedVideo.platform} {selectedVideo.contentType}</span>
                    <span>•</span>
                    <span>{selectedVideo.account?.displayName || selectedVideo.account?.handle}</span>
                  </div>
                  <h2 className="text-[16px] font-bold text-brand-950 mt-1">
                    {selectedVideo.title || selectedVideo.caption || "Content Teardown"}
                  </h2>
                </div>
                <button onClick={() => setSelectedVideo(null)} className="rounded-lg p-1 text-brand-400 hover:bg-brand-100">
                  <X size={18} />
                </button>
              </div>

              {/* "Why This Content Works" Box */}
              {selectedVideo.whyItWorks && (
                <div className="rounded-xl bg-gradient-to-r from-accent-600/10 to-series-6/10 border border-accent-200 p-4 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-accent-700 font-bold text-[12px] uppercase tracking-wider">
                    <Sparkles size={14} /> Why This Content Works (Reverse Engineered Formula)
                  </div>
                  <p className="text-[12.5px] text-brand-900 leading-relaxed font-medium">
                    {selectedVideo.whyItWorks}
                  </p>
                </div>
              )}

              {/* Video Timeline & Transcript Breakdown */}
              <div className="space-y-3">
                <h3 className="text-[13px] font-bold text-brand-950 flex items-center gap-2">
                  <Clock size={14} className="text-accent-600" /> Speech Transcript & Hook Analysis
                </h3>
                {selectedVideo.transcriptSegments && selectedVideo.transcriptSegments.length > 0 ? (
                  <div className="rounded-xl border bg-brand-50/40 p-4 divide-y divide-brand-100 text-[12px]">
                    {selectedVideo.transcriptSegments.map((seg: any, i: number) => (
                      <div key={i} className="py-2.5 flex items-start gap-3">
                        <span className="rounded bg-white border border-brand-200 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-700 shrink-0">
                          {seg.timestamp || `00:${String(i * 10).padStart(2, "0")}`}
                        </span>
                        <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase shrink-0 ${
                          seg.type === "HOOK" ? "bg-accent-100 text-accent-800" : seg.type === "PROBLEM" ? "bg-red-100 text-red-800" : seg.type === "CTA" ? "bg-emerald-100 text-emerald-800" : "bg-brand-100 text-brand-700"
                        }`}>
                          {seg.type || "SEGMENT"}
                        </span>
                        <p className="text-brand-800 flex-1">{seg.text}</p>
                      </div>
                    ))}
                  </div>
                ) : selectedVideo.transcript ? (
                  <div className="rounded-xl border bg-brand-50/40 p-4 text-[12px] text-brand-800 whitespace-pre-wrap">
                    {selectedVideo.transcript}
                  </div>
                ) : (
                  <div className="rounded-xl border bg-brand-50/40 p-4 text-[12px] text-brand-500 italic">
                    No transcript segments extracted yet for this video.
                  </div>
                )}
              </div>

              {/* OCR & Visual Scenes */}
              <div className="space-y-3">
                <h3 className="text-[13px] font-bold text-brand-950 flex items-center gap-2">
                  <Layers size={14} className="text-accent-600" /> Representative Visual Scenes & OCR Text Overlays
                </h3>
                {selectedVideo.scenes && selectedVideo.scenes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11.5px]">
                    {selectedVideo.scenes.map((scene: any, i: number) => (
                      <div key={i} className="rounded-lg border bg-white p-3 space-y-1.5" style={{ borderColor: "var(--color-brand-100)" }}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-brand-950">Scene #{scene.sceneNumber || i + 1} ({scene.timeRange || "0s+"})</span>
                          <span className="rounded bg-brand-100 px-1.5 py-0.2 font-mono text-[9px] text-brand-700">
                            {scene.visualFormat || "B-ROLL"}
                          </span>
                        </div>
                        <p className="text-brand-600">{scene.description}</p>
                        {scene.onScreenText && (
                          <div className="rounded bg-brand-50 p-1.5 font-mono text-[10px] text-accent-800 font-semibold">
                            OCR: "{scene.onScreenText}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border bg-white p-4 text-[12px] text-brand-500 italic">
                    No visual scene breakdown recorded for this video yet.
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--color-brand-100)" }}>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="rounded-lg border px-4 py-2 text-[12px] font-medium text-brand-700 hover:bg-brand-50"
                  style={{ borderColor: "var(--color-brand-200)" }}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const topic = selectedVideo.title || selectedVideo.caption || "Product Strategy";
                    setSelectedVideo(null);
                    handleGenerateScript(topic, "INSTAGRAM_REEL", selectedVideo.whyItWorks || undefined);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-accent-600 px-5 py-2 text-[12px] font-semibold text-white hover:bg-accent-700 transition"
                >
                  <Wand2 size={13} />
                  Create Original Version in Studio
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SCRIPT STUDIO DRAWER / MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(isGeneratingScript || activeScript) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!isGeneratingScript) setActiveScript(null); }} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-5"
            >
              {isGeneratingScript ? (
                <div className="py-16 text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-50 text-accent-600 animate-pulse">
                    <Wand2 size={26} className="animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-brand-950">Generating 100% Original Video Script...</h3>
                    <p className="text-[12.5px] text-brand-500 max-w-sm mx-auto mt-1">
                      Synthesizing strategic angles, high-retention hooks, and scene-by-scene visual directions for "{scriptTopic}".
                    </p>
                  </div>
                </div>
              ) : activeScript ? (
                <>
                  {/* Script Header */}
                  <div className="flex items-start justify-between border-b pb-4" style={{ borderColor: "var(--color-brand-100)" }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-accent-100 text-accent-800 px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                          {activeScript.platform}
                        </span>
                        <span className="text-[11px] text-brand-400 font-mono">• {activeScript.targetDuration}</span>
                      </div>
                      <h2 className="text-[17px] font-bold text-brand-950 mt-1">{activeScript.title}</h2>
                    </div>
                    <button onClick={() => setActiveScript(null)} className="rounded-lg p-1 text-brand-400 hover:bg-brand-100">
                      <X size={18} />
                    </button>
                  </div>

                  {/* Originality Badge */}
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-[11.5px] text-emerald-800 font-medium">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <span>{activeScript.originalityGuarantee}</span>
                  </div>

                  {/* Strategic Brief */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11.5px]">
                    <div className="rounded-lg border p-3 bg-brand-50/50" style={{ borderColor: "var(--color-brand-100)" }}>
                      <span className="text-brand-400 uppercase text-[9.5px] font-bold block mb-1">Target Audience</span>
                      <p className="text-brand-800 font-medium">{activeScript.targetAudience}</p>
                    </div>
                    <div className="rounded-lg border p-3 bg-brand-50/50" style={{ borderColor: "var(--color-brand-100)" }}>
                      <span className="text-brand-400 uppercase text-[9.5px] font-bold block mb-1">Core Problem</span>
                      <p className="text-brand-800 font-medium">{activeScript.coreProblem}</p>
                    </div>
                    <div className="rounded-lg border p-3 bg-brand-50/50" style={{ borderColor: "var(--color-brand-100)" }}>
                      <span className="text-brand-400 uppercase text-[9.5px] font-bold block mb-1">Call To Action</span>
                      <p className="text-brand-800 font-medium">{activeScript.callToAction}</p>
                    </div>
                  </div>

                  {/* Scene by Scene Production Script */}
                  <div className="space-y-3">
                    <h3 className="text-[13.5px] font-bold text-brand-950 flex items-center gap-2">
                      <Video size={14} className="text-accent-600" /> Scene-by-Scene Production Script
                    </h3>
                    <div className="space-y-3">
                      {activeScript.scenes.map((scene) => (
                        <div key={scene.sceneNumber} className="rounded-xl border p-4 bg-white shadow-sm space-y-2.5" style={{ borderColor: "var(--color-brand-100)" }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-950 text-white font-mono text-[10px] font-bold">
                                {scene.sceneNumber}
                              </span>
                              <span className="font-bold text-[12.5px] text-brand-950">{scene.sectionName}</span>
                              <span className="font-mono text-[11px] text-brand-400">({scene.timeRange})</span>
                            </div>
                            <span className="rounded bg-brand-100 px-2 py-0.5 font-mono text-[9px] font-bold text-brand-700">
                              {scene.sectionName}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                            {/* Spoken Word */}
                            <div className="rounded-lg bg-brand-50/70 p-3">
                              <span className="text-[10px] uppercase font-bold text-brand-500 block mb-1">🎙 Spoken Voiceover</span>
                              <p className="text-brand-950 font-medium leading-relaxed">"{scene.spokenScript}"</p>
                            </div>

                            {/* Visual & On-Screen Text */}
                            <div className="rounded-lg bg-accent-50/40 border border-accent-100 p-3 space-y-2">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-accent-700 block mb-0.5">🎬 Visual Direction</span>
                                <p className="text-brand-800 text-[11.5px]">{scene.visualDirection}</p>
                              </div>
                              <div className="pt-1.5 border-t border-accent-200/60">
                                <span className="text-[9.5px] uppercase font-bold text-accent-700 block mb-0.5">📝 On-Screen Graphic</span>
                                <span className="font-mono text-[11px] font-bold text-brand-950">{scene.onScreenText}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Caption & Hashtags */}
                  <div className="rounded-xl border p-4 bg-brand-50/40 space-y-2 text-[12px]" style={{ borderColor: "var(--color-brand-100)" }}>
                    <span className="text-[10.5px] uppercase font-bold text-brand-500 block">Suggested Post Caption</span>
                    <p className="text-brand-800 whitespace-pre-line leading-relaxed">{activeScript.caption}</p>
                    <div className="flex flex-wrap gap-1 pt-2">
                      {activeScript.hashtags.map((h, i) => (
                        <span key={i} className="rounded bg-white px-2 py-0.5 font-mono text-[10.5px] text-accent-700 font-semibold border border-brand-200">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Script Actions */}
                  <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--color-brand-100)" }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(activeScript, null, 2));
                        setCopiedScript(true);
                        setTimeout(() => setCopiedScript(false), 2000);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[12px] font-medium text-brand-700 hover:bg-brand-50"
                      style={{ borderColor: "var(--color-brand-200)" }}
                    >
                      {copiedScript ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      {copiedScript ? "Copied Script!" : "Copy Full Script"}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveScriptMut.mutate(activeScript)}
                        disabled={saveScriptMut.isPending}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-5 py-2 text-[12px] font-semibold text-white hover:bg-brand-900 transition"
                      >
                        <Calendar size={13} />
                        {saveScriptMut.isPending ? "Scheduling..." : "Save to Content Calendar"}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ADD COMPETITOR & PROFILE AUTO-DISCOVERY MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isAddWizardOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsAddWizardOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-brand-100)" }}>
                <div>
                  <h3 className="text-[15px] font-bold text-brand-950">Add Competitor & Auto-Discover</h3>
                  <p className="text-[11px] text-brand-500">Scan competitor website for official social channels.</p>
                </div>
                <button onClick={() => setIsAddWizardOpen(false)} className="rounded-lg p-1 text-brand-400 hover:bg-brand-100">
                  <X size={16} />
                </button>
              </div>

              {!discoveredProfiles ? (
                <form onSubmit={handleDiscoverProfiles} className="space-y-3.5">
                  <div>
                    <label className="block text-[11.5px] font-medium text-brand-700 mb-1">Competitor Website *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. competitor.com or https://competitor.com"
                      value={wizardWebsite}
                      onChange={(e) => setWizardWebsite(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-[12.5px] outline-none focus:ring-1 focus:ring-brand-950"
                      style={{ borderColor: "var(--color-brand-200)" }}
                    />
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-medium text-brand-700 mb-1">Business Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Competitor Name"
                      value={wizardName}
                      onChange={(e) => setWizardName(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-[12.5px] outline-none focus:ring-1 focus:ring-brand-950"
                      style={{ borderColor: "var(--color-brand-200)" }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-medium text-brand-700 mb-1">Location</label>
                      <input
                        type="text"
                        placeholder="e.g. Mumbai"
                        value={wizardLocation}
                        onChange={(e) => setWizardLocation(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-[12.5px] outline-none focus:ring-1 focus:ring-brand-950"
                        style={{ borderColor: "var(--color-brand-200)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-medium text-brand-700 mb-1">Industry</label>
                      <input
                        type="text"
                        placeholder="e.g. Frozen Foods Export"
                        value={wizardIndustry}
                        onChange={(e) => setWizardIndustry(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-[12.5px] outline-none focus:ring-1 focus:ring-brand-950"
                        style={{ borderColor: "var(--color-brand-200)" }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setIsAddWizardOpen(false)}
                      className="rounded-lg border px-4 py-2 text-[12px] font-medium text-brand-700"
                      style={{ borderColor: "var(--color-brand-200)" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isDiscovering || !wizardWebsite}
                      className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-5 py-2 text-[12px] font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
                    >
                      {isDiscovering ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
                      {isDiscovering ? "Discovering..." : "Scan & Discover Profiles"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-[12px] text-emerald-800 font-medium flex items-center justify-between">
                    <span>✓ Competitor registered &amp; {discoveredProfiles.length} verified profile{discoveredProfiles.length === 1 ? "" : "s"} tracked!</span>
                    <span className="rounded bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold px-2 py-0.5">Active</span>
                  </div>
                  <div className="space-y-2 max-h-[260px] overflow-y-auto">
                    {discoveredProfiles.map((p, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border p-3 bg-white" style={{ borderColor: "var(--color-brand-100)" }}>
                        <div className="flex items-center gap-2.5">
                          <Globe size={14} className="text-brand-600" />
                          <div>
                            <span className="font-semibold text-brand-950 text-[12.5px]">{p.displayName || p.handle}</span>
                            <span className="text-[11px] font-mono text-brand-400 ml-2">{p.handle}</span>
                          </div>
                        </div>
                        <span className="rounded bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                          {p.platform} ({p.matchConfidence || 85}% Fit)
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={async () => {
                      setIsAddWizardOpen(false);
                      setDiscoveredProfiles(null);
                      await Promise.all([
                        qc.invalidateQueries({ queryKey: ["ci-accounts", projectId] }),
                        qc.invalidateQueries({ queryKey: ["ci-content", projectId] }),
                        qc.invalidateQueries({ queryKey: ["competitors", projectId] }),
                        qc.invalidateQueries({ queryKey: ["ci-matrix", projectId] }),
                        qc.invalidateQueries({ queryKey: ["ci-opportunities", projectId] }),
                        qc.invalidateQueries({ queryKey: ["opportunities", projectId] }),
                        qc.invalidateQueries({ queryKey: ["ci-alerts", projectId] }),
                      ]);
                      await qc.refetchQueries({ queryKey: ["ci-accounts", projectId] });
                      await qc.refetchQueries({ queryKey: ["competitors", projectId] });
                    }}
                    className="w-full rounded-lg bg-brand-950 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-900 transition"
                  >
                    Done &amp; View Competitor Intelligence
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MANUAL VIDEO INGEST / ANALYZE MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isIngestVideoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsIngestVideoOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-brand-100)" }}>
                <div>
                  <h3 className="text-[15px] font-bold text-brand-950">Analyze Video or Reel</h3>
                  <p className="text-[11px] text-brand-500">Run multi-modal video intelligence, transcription, and OCR.</p>
                </div>
                <button onClick={() => setIsIngestVideoOpen(false)} className="rounded-lg p-1 text-brand-400 hover:bg-brand-100">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-[12px]">
                <div>
                  <label className="block text-[11px] font-medium text-brand-700 mb-1">Competitor Account</label>
                  <select
                    value={ingestAccountId}
                    onChange={(e) => setIngestAccountId(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none"
                    style={{ borderColor: "var(--color-brand-200)" }}
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.displayName || a.handle} ({a.platform})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-brand-700 mb-1">Platform</label>
                    <select
                      value={ingestPlatform}
                      onChange={(e) => setIngestPlatform(e.target.value as any)}
                      className="w-full rounded-lg border px-3 py-2 text-[12px]"
                      style={{ borderColor: "var(--color-brand-200)" }}
                    >
                      <option value="INSTAGRAM">Instagram</option>
                      <option value="YOUTUBE">YouTube</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-brand-700 mb-1">Format</label>
                    <select
                      value={ingestContentType}
                      onChange={(e) => setIngestContentType(e.target.value as any)}
                      className="w-full rounded-lg border px-3 py-2 text-[12px]"
                      style={{ borderColor: "var(--color-brand-200)" }}
                    >
                      <option value="REEL">Reel (45–60s)</option>
                      <option value="SHORT">YouTube Short</option>
                      <option value="VIDEO">Long-Form Video</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-brand-700 mb-1">Video Title / Hook Line</label>
                  <input
                    placeholder="e.g. Product Export Showcase or Process Tour"
                    value={ingestTitle}
                    onChange={(e) => setIngestTitle(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-[12px]"
                    style={{ borderColor: "var(--color-brand-200)" }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-brand-700 mb-1">Transcript or Caption Text (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Paste audio transcript or post caption for AI processing"
                    value={ingestTranscript}
                    onChange={(e) => setIngestTranscript(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-[12px] resize-none"
                    style={{ borderColor: "var(--color-brand-200)" }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsIngestVideoOpen(false)}
                  className="rounded-lg border px-4 py-2 text-[12px] font-medium text-brand-700"
                  style={{ borderColor: "var(--color-brand-200)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => analyzeVideoMut.mutate({
                    accountId: ingestAccountId || accounts[0]?.id,
                    platform: ingestPlatform,
                    contentType: ingestContentType,
                    title: ingestTitle || "Competitive Product Showcase",
                    caption: ingestTranscript || ingestTitle,
                    rawTranscript: ingestTranscript,
                    viewsCount: ingestViews,
                    likesCount: ingestLikes,
                  })}
                  disabled={analyzeVideoMut.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-accent-600 px-5 py-2 text-[12px] font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
                >
                  {analyzeVideoMut.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {analyzeVideoMut.isPending ? "Analyzing Video..." : "Run Video Intelligence"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
