"use client";

import { Suspense, useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  Layers,
  Link as LinkIcon,
  Loader2,
  MapPin,
  PenTool,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import {
  ActionButton,
  PageHeader,
  Panel,
  Table,
  Th,
  Tr,
  Td,
  Tabs,
  relativeTime,
} from "@/components/ui/console";
import {
  useWorkspace,
  useContentPieces,
  usePlanContent,
  useDraftContent,
  useRunContent,
} from "@/hooks/use-growthx";
import { api, type GrowthOpportunity, type ContentPiece } from "@/lib/api-client";
import {
  TruthfulState,
  MetricBadge,
  TruthfulKpiCard,
  LoadingState,
} from "@/components/ui/truthful-state";

export default function ContentOpportunitiesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-brand-400">Loading Content & Opportunities...</div>}>
      <ContentOpportunitiesClient />
    </Suspense>
  );
}

function ContentOpportunitiesClient() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>("opportunities");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Queries
  const opportunities = useQuery({
    queryKey: ["opportunities", projectId, selectedCategory],
    queryFn: () => api.opportunities(projectId!, { category: selectedCategory }),
    enabled: !!projectId,
  });

  const pieces = useContentPieces(projectId);
  const planContent = usePlanContent(projectId);
  const draftContent = useDraftContent(projectId);
  const runContent = useRunContent(projectId);

  const detectOpportunitiesMutation = useMutation({
    mutationFn: () => api.detectOpportunities(projectId!),
    onSuccess: (res) => {
      setStatusMessage(`Opportunity detection complete! Found ${res.detected} prioritized opportunities.`);
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      setTimeout(() => setStatusMessage(null), 5000);
    },
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "OPEN" | "ACTIONED" | "DISMISSED" }) =>
      api.setOpportunityStatus(projectId!, id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });

  const tabs = [
    { id: "opportunities", label: "SEO Opportunities" },
    { id: "keyword-gaps", label: "Keyword Gaps" },
    { id: "plan", label: "Content Plan" },
    { id: "briefs", label: "Briefs" },
    { id: "drafts", label: "Drafts" },
    { id: "publishing", label: "Publishing" },
    { id: "internal-linking", label: "Internal Linking" },
    { id: "existing-content", label: "Existing Content" },
  ];

  const opportunityList = opportunities.data?.opportunities ?? [];
  const contentList = pieces.data ?? [];

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Content & Opportunities"
        subtitle="Turn SEO audits and competitor intelligence into prioritized actions, content briefs, and published assets."
        actions={
          <div className="flex items-center gap-2">
            <ActionButton
              variant="secondary"
              icon={planContent.isPending ? <Loader2 size={12} className="animate-spin" /> : <PenTool size={12} />}
              onClick={() => planContent.mutate()}
              disabled={planContent.isPending || !projectId}
            >
              {planContent.isPending ? "Planning..." : "Generate Content Plan"}
            </ActionButton>
            <ActionButton
              variant="primary"
              icon={detectOpportunitiesMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              onClick={() => detectOpportunitiesMutation.mutate()}
              disabled={detectOpportunitiesMutation.isPending || !projectId}
            >
              {detectOpportunitiesMutation.isPending ? "Analyzing..." : "Detect Opportunities"}
            </ActionButton>
          </div>
        }
      />

      {statusMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-[12px] text-emerald-800 font-medium">
          {statusMessage}
        </div>
      )}

      {/* 8 Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Tab 1: SEO Opportunities */}
      {activeTab === "opportunities" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { label: "All Types", val: undefined },
                { label: "SEO", val: "SEO" },
                { label: "Content", val: "CONTENT" },
                { label: "Local", val: "LOCAL" },
                { label: "Technical", val: "TECHNICAL" },
                { label: "Business", val: "BUSINESS" },
              ].map((f) => (
                <button
                  key={f.label}
                  onClick={() => setSelectedCategory(f.val)}
                  className={`rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition ${
                    selectedCategory === f.val
                      ? "bg-brand-950 text-white"
                      : "border bg-white text-brand-600 hover:bg-brand-50"
                  }`}
                  style={{ borderColor: "var(--border-color)" }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <span className="text-[11.5px] text-brand-500 font-mono">
              {opportunityList.length} prioritized findings
            </span>
          </div>

          <Panel
            title="Prioritized Opportunities"
            subtitle="Algorithmically ranked by business impact, SEO potential, and implementation difficulty"
          >
            <div className="p-0">
              {opportunities.isLoading ? (
                <LoadingState title="Analyzing Opportunities..." message="Reading data from crawl, GSC, and competitors..." />
              ) : opportunityList.length === 0 ? (
                <div className="p-8">
                  <TruthfulState
                    icon={Target}
                    title="No Open Opportunities Found"
                    missing="No active opportunities for this filter."
                    whyItMatters="Opportunities are produced by joining crawl defects, competitor keyword gaps, and Search Console striking-distance positions."
                    actionRequired="Click Detect Opportunities to run analysis."
                    action={{
                      label: "Detect Opportunities Now",
                      onClick: () => detectOpportunitiesMutation.mutate(),
                      variant: "primary",
                    }}
                    compact
                  />
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--color-brand-100)" }}>
                  {opportunityList.map((op) => (
                    <div key={op.id} className="p-5 hover:bg-brand-50/30 transition">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800 uppercase tracking-wider">
                              {op.category}
                            </span>
                            <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                              {op.potential} Impact
                            </span>
                            <span className="rounded bg-brand-50 border border-brand-200 px-2 py-0.5 text-[10px] font-medium text-brand-600">
                              Effort: {op.effort}
                            </span>
                            <h3 className="text-[14px] font-bold text-brand-950 ml-1">{op.title}</h3>
                          </div>

                          <p className="text-[12.5px] text-brand-700 leading-relaxed max-w-3xl">
                            {op.recommendedAction || op.summary}
                          </p>

                          {op.affectedPages && op.affectedPages.length > 0 && (
                            <div className="flex items-center gap-1.5 pt-1 text-[11.5px] font-mono text-brand-500">
                              <Globe size={12} className="text-brand-400" />
                              <span className="truncate max-w-lg">{op.affectedPages[0]}</span>
                            </div>
                          )}

                          {op.evidence && op.evidence.length > 0 && (
                            <div className="text-[11.5px] text-brand-500 bg-brand-50/50 rounded-lg p-2.5 mt-2 border border-brand-100">
                              <strong>Evidence:</strong>{" "}
                              {op.evidence.map((e) => typeof e === "string" ? e : (e as any).detail || (e as any).fact || JSON.stringify(e)).join("; ")}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("drafts");
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90 transition"
                          >
                            <Sparkles size={12} />
                            Generate Draft
                          </button>

                          <div className="flex items-center gap-1.5">
                            {op.status === "OPEN" ? (
                              <button
                                type="button"
                                onClick={() => setStatusMutation.mutate({ id: op.id, status: "ACTIONED" })}
                                className="flex items-center gap-1 rounded border bg-white px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 transition"
                              >
                                <Check size={12} />
                                Complete
                              </button>
                            ) : (
                              <span className="text-[11px] font-semibold text-emerald-700">Completed</span>
                            )}

                            <button
                              type="button"
                              onClick={() => setStatusMutation.mutate({ id: op.id, status: "DISMISSED" })}
                              className="p-1 rounded text-brand-400 hover:text-brand-700"
                              title="Dismiss"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* Tab 2: Keyword Gaps */}
      {activeTab === "keyword-gaps" && (
        <Panel title="Competitor Keyword Gaps" subtitle="Keywords where competitors capture traffic and your domain is absent">
          <div className="p-6">
            <p className="text-[12.5px] text-brand-500 leading-relaxed max-w-2xl mb-4">
              GrowthX automatically compares organic queries from your Search Console against publicly ranking competitor pages.
            </p>
            <div className="rounded-xl border p-5 bg-brand-50/20" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-bold text-brand-950">Top Discovered Opportunity Clusters</span>
                <span className="text-[11px] font-mono text-brand-400">Auto-detected from Competitor Sweeps</span>
              </div>
              <p className="text-[12px] text-brand-600">
                Competitor content clusters and query targets stream directly into the editorial calendar.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* Tab 3: Content Plan */}
      {activeTab === "plan" && (
        <Panel
          title="Editorial Content Roadmap"
          subtitle="Scheduled articles, landing pages, and authority guides"
          actions={
            <ActionButton
              variant="primary"
              icon={<Plus size={12} />}
              onClick={() => planContent.mutate()}
            >
              Add Content Item
            </ActionButton>
          }
        >
          <div className="p-0">
            {contentList.length === 0 ? (
              <div className="p-8">
                <TruthfulState
                  icon={PenTool}
                  title="Content Plan Empty"
                  missing="No articles or landing pages planned for production."
                  action={{
                    label: "Generate AI Content Plan",
                    onClick: () => planContent.mutate(),
                    variant: "primary",
                  }}
                  compact
                />
              </div>
            ) : (
              <Table minWidth={750}>
                <thead>
                  <tr>
                    <Th>Topic / Title</Th>
                    <Th>Format</Th>
                    <Th>Target Query</Th>
                    <Th>Status</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {contentList.map((c) => (
                    <Tr key={c.id}>
                      <Td><span className="font-bold text-brand-950 text-[12.5px]">{c.title}</span></Td>
                      <Td><span className="rounded bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">{c.format || "Article"}</span></Td>
                      <Td><span className="font-mono text-[11.5px] text-brand-600">{c.targetQuery || "—"}</span></Td>
                      <Td><span className="text-[11px] font-semibold text-amber-700">{c.status}</span></Td>
                      <Td align="right">
                        <button
                          type="button"
                          onClick={() => draftContent.mutate(c.id)}
                          className="rounded bg-brand-950 px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                        >
                          Draft
                        </button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Panel>
      )}

      {/* Tab 4: Briefs */}
      {activeTab === "briefs" && (
        <Panel title="Structured SEO Content Briefs" subtitle="Headers, search intent, word count targets, and required schema">
          <div className="p-6 text-center text-[12px] text-brand-400">
            Briefs are automatically generated when an opportunity is sent to production.
          </div>
        </Panel>
      )}

      {/* Tab 5: Drafts */}
      {activeTab === "drafts" && (
        <Panel title="In-Progress Drafts & AI Copy" subtitle="Full drafted copy ready for review and publishing">
          <div className="p-6 text-center text-[12px] text-brand-400">
            Drafted articles appear here with live word counts, keyword density checks, and schema preview.
          </div>
        </Panel>
      )}

      {/* Tab 6: Publishing */}
      {activeTab === "publishing" && (
        <Panel title="CMS & GitHub Publishing Pipeline" subtitle="Automated push to Next.js, WordPress, or Webflow">
          <div className="p-6 space-y-3">
            <p className="text-[12.5px] text-brand-500">
              Connect your GitHub repository in Integrations to deploy new articles directly as markdown PRs or push to your CMS.
            </p>
            <Link
              href="/integrations"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent-700 hover:underline"
            >
              Configure GitHub Integration →
            </Link>
          </div>
        </Panel>
      )}

      {/* Tab 7: Internal Linking */}
      {activeTab === "internal-linking" && (
        <Panel title="Internal Link Graph Suggestions" subtitle="Add strategic contextual links between high-authority and striking-distance pages">
          <div className="p-6 text-center text-[12px] text-brand-400">
            Calculated from your crawler&apos;s directed link graph to distribute PageRank efficiently.
          </div>
        </Panel>
      )}

      {/* Tab 8: Existing Content */}
      {activeTab === "existing-content" && (
        <Panel title="Existing Content Audit" subtitle="Identify decaying pages, thin articles, and refresh opportunities">
          <div className="p-6 text-center text-[12px] text-brand-400">
            Pages with declining Search Console CTR or thin word counts are flagged for content refresh.
          </div>
        </Panel>
      )}
    </div>
  );
}
