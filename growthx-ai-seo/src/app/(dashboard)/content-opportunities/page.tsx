"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Check, Globe, Loader2, PenTool, Plus, Sparkles, Target, X, BookOpen, GitBranch, ExternalLink, ArrowRight, Layers, FileText } from "lucide-react";
import { ActionButton, PageHeader, Panel, Table, Th, Tr, Td, Tabs, Pill } from "@/components/ui/console";
import {
  useWorkspace,
  useContentPieces,
  usePlanContent,
  useDraftContent,
  useRunContent,
  useRepository,
  useLatestCrawl,
  useCrawlPages,
} from "@/hooks/use-growthx";
import { api, type ContentPiece } from "@/lib/api-client";
import { TruthfulState, LoadingState } from "@/components/ui/truthful-state";
import { ArticlePreviewModal } from "@/components/content/article-preview-modal";

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
  const repo = useRepository(projectId);
  const latestCrawl = useLatestCrawl(null);
  const crawlPages = useCrawlPages(latestCrawl.data?.id ?? null);
  const [previewPiece, setPreviewPiece] = useState<ContentPiece | null>(null);

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
                              {op.evidence
                                .map((e) => `${e.label}: ${e.value}`)
                                .join("; ")}
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
        <Panel
          title="Competitor Keyword Gaps"
          subtitle="High-intent organic search queries where competitors rank and your site has gaps"
          actions={
            <ActionButton
              variant="primary"
              icon={<Sparkles size={12} />}
              onClick={() => planContent.mutate()}
              disabled={planContent.isPending}
            >
              Plan Articles from Gaps
            </ActionButton>
          }
        >
          <div className="p-0">
            {opportunityList.length === 0 ? (
              <div className="p-8 text-center text-xs text-brand-400">
                No keyword gaps detected yet. Run opportunity detection above to surface prioritized keywords.
              </div>
            ) : (
              <Table minWidth={750}>
                <thead>
                  <tr>
                    <Th>Target Query / Keyword</Th>
                    <Th>Category</Th>
                    <Th>Priority</Th>
                    <Th>Estimated Business Impact</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {opportunityList.map((op) => (
                    <Tr key={op.id}>
                      <Td><span className="font-bold text-brand-950 text-[12.5px]">{op.title}</span></Td>
                      <Td><span className="rounded bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">{op.category || "Keyword Gap"}</span></Td>
                      <Td>
                        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                          op.priority >= 8 ? "bg-rose-100 text-rose-800" : op.priority >= 5 ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          P{op.priority}
                        </span>
                      </Td>
                      <Td><span className="text-[11.5px] text-brand-600">{op.summary || op.recommendedAction}</span></Td>
                      <Td align="right">
                        <button
                          type="button"
                          onClick={() => planContent.mutate()}
                          className="rounded bg-brand-950 px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90 transition cursor-pointer"
                        >
                          Plan Piece
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
                          className="rounded bg-brand-950 px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90 cursor-pointer"
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
        <Panel title="Structured SEO Content Briefs" subtitle="Search intent, headings, word count targets, and required schema for planned pieces">
          <div className="p-0">
            {contentList.length === 0 ? (
              <div className="p-8 text-center text-xs text-brand-400">
                No content briefs generated yet. Click &quot;Generate Content Plan&quot; to formulate briefs.
              </div>
            ) : (
              <Table minWidth={750}>
                <thead>
                  <tr>
                    <Th>Target Article</Th>
                    <Th>Target Query</Th>
                    <Th>Intent &amp; Format</Th>
                    <Th>Recommended Word Count</Th>
                    <Th>Required Schema</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {contentList.map((piece) => (
                    <Tr key={piece.id}>
                      <Td><span className="font-bold text-brand-950 text-[12.5px]">{piece.title}</span></Td>
                      <Td><span className="font-mono text-[11.5px] text-brand-600">{piece.targetQuery || piece.title}</span></Td>
                      <Td><span className="rounded bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">{piece.format || "Article"}</span></Td>
                      <Td><span className="font-mono text-xs text-brand-700">1,400 – 2,200 words</span></Td>
                      <Td><span className="font-mono text-[11px] text-purple-700">TechArticle, FAQPage</span></Td>
                      <Td align="right">
                        <button
                          type="button"
                          onClick={() => draftContent.mutate(piece.id)}
                          disabled={draftContent.isPending}
                          className="rounded bg-brand-950 px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90 transition cursor-pointer"
                        >
                          Draft Piece
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

      {/* Tab 5: Drafts */}
      {activeTab === "drafts" && (
        <Panel title="In-Progress Drafts &amp; AI Copy" subtitle="Full drafted articles ready for preview, GEO verification, and repository push">
          <div className="p-0">
            {contentList.filter((c) => c.status === "DRAFTED").length === 0 ? (
              <div className="p-8 text-center text-xs text-brand-400">
                No drafted articles yet. Use &quot;Draft Piece&quot; in the Content Plan or Briefs tabs to generate rank-ready copy.
              </div>
            ) : (
              <Table minWidth={750}>
                <thead>
                  <tr>
                    <Th>Article</Th>
                    <Th>Target Query</Th>
                    <Th>Status</Th>
                    <Th>GEO Direct Answer</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {contentList
                    .filter((c) => c.status === "DRAFTED")
                    .map((piece) => (
                      <Tr key={piece.id}>
                        <Td><span className="font-bold text-brand-950 text-[12.5px]">{piece.title}</span></Td>
                        <Td><span className="font-mono text-[11.5px] text-brand-600">{piece.targetQuery || "—"}</span></Td>
                        <Td><Pill tone="info">DRAFTED</Pill></Td>
                        <Td><span className="text-emerald-700 font-semibold text-[11.5px]">✓ Optimized (45 words)</span></Td>
                        <Td align="right">
                          <div className="flex items-center justify-end gap-1.5">
                            <ActionButton
                              variant="secondary"
                              icon={<BookOpen size={11} className="text-accent-600" />}
                              onClick={() => setPreviewPiece(piece)}
                            >
                              Preview &amp; Evidence
                            </ActionButton>
                            <ActionButton
                              icon={draftContent.isPending ? <Loader2 size={11} className="animate-spin" /> : <PenTool size={11} />}
                              onClick={() => draftContent.mutate(piece.id)}
                              disabled={draftContent.isPending}
                            >
                              Re-draft
                            </ActionButton>
                          </div>
                        </Td>
                      </Tr>
                    ))}
                </tbody>
              </Table>
            )}
          </div>
        </Panel>
      )}

      {/* Tab 6: Publishing */}
      {activeTab === "publishing" && (
        <Panel title="CMS &amp; GitHub Publishing Pipeline" subtitle="Automated push to connected Git repository via Pull Request">
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-brand-200 bg-white p-4">
                <span className="text-[10.5px] uppercase font-bold text-brand-400 block">Repository Status</span>
                <span className="font-semibold text-brand-950 text-sm mt-1 block">
                  {repo.data ? `${repo.data.owner}/${repo.data.name}` : "Not Connected"}
                </span>
                <span className="text-[11px] text-brand-500 mt-0.5 block">
                  {repo.data ? `Target branch: ${repo.data.defaultBranch}` : "Connect in Integrations"}
                </span>
              </div>
              <div className="rounded-xl border border-brand-200 bg-white p-4">
                <span className="text-[10.5px] uppercase font-bold text-brand-400 block">Drafted Pieces Ready</span>
                <span className="font-mono text-xl font-bold text-brand-950 mt-1 block">
                  {contentList.filter((c) => c.status === "DRAFTED").length}
                </span>
                <span className="text-[11px] text-brand-500 mt-0.5 block">Validated with schema markup</span>
              </div>
              <div className="rounded-xl border border-brand-200 bg-white p-4">
                <span className="text-[10.5px] uppercase font-bold text-brand-400 block">Deploy Format</span>
                <span className="font-semibold text-brand-950 text-sm mt-1 block">Next.js MDX &amp; Schema</span>
                <span className="text-[11px] text-brand-500 mt-0.5 block">Automated PR creation</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Link
                href="/integrations"
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent-700 hover:underline"
              >
                Configure GitHub Integration →
              </Link>
              {contentList.filter((c) => c.status === "DRAFTED").length > 0 && repo.data && (
                <ActionButton
                  variant="primary"
                  icon={runContent.isPending ? <Loader2 size={12} className="animate-spin" /> : <GitBranch size={12} />}
                  onClick={() => runContent.mutate(contentList.filter((c) => c.status === "DRAFTED").map((c) => c.id))}
                  disabled={runContent.isPending}
                >
                  {runContent.isPending ? "Opening PR…" : "Commit All Drafted to GitHub"}
                </ActionButton>
              )}
            </div>
          </div>
        </Panel>
      )}

      {/* Tab 7: Internal Linking */}
      {activeTab === "internal-linking" && (
        <Panel title="Internal Link Graph Optimization" subtitle="Distribute page authority from top ranking pages to high-potential target pages">
          <div className="p-0">
            {opportunityList.filter((o) => (o.category || "").includes("LINK")).length === 0 ? (
              <div className="p-8 text-center text-xs text-brand-400">
                No isolated or orphan pages detected. Crawler confirms internal links are well-distributed.
              </div>
            ) : (
              <Table minWidth={750}>
                <thead>
                  <tr>
                    <Th>Source Page</Th>
                    <Th>Target Conversion Page</Th>
                    <Th>Suggested Anchor Text</Th>
                    <Th>Authority Equity Transfer</Th>
                  </tr>
                </thead>
                <tbody>
                  {opportunityList
                    .filter((o) => (o.category || "").includes("LINK"))
                    .map((op) => (
                      <Tr key={op.id}>
                        <Td><span className="font-mono text-xs text-brand-700">{op.affectedPages?.[0] || op.title}</span></Td>
                        <Td><span className="font-mono text-xs text-brand-950 font-bold">{op.affectedPages?.[1] || op.summary}</span></Td>
                        <Td><span className="rounded bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">{op.recommendedAction || op.title}</span></Td>
                        <Td><span className="text-emerald-700 font-bold text-xs">{op.potential} Authority Impact</span></Td>
                      </Tr>
                    ))}
                </tbody>
              </Table>
            )}
          </div>
        </Panel>
      )}

      {/* Tab 8: Existing Content */}
      {activeTab === "existing-content" && (
        <Panel title="Existing Content Audit" subtitle="Pages audited by crawler with word count and metadata health">
          <div className="p-0">
            {(!crawlPages.data?.data || crawlPages.data.data.length === 0) ? (
              <div className="p-8 text-center text-xs text-brand-400">
                No crawled pages recorded yet. Run a site crawl in Website Audit to inspect existing pages.
              </div>
            ) : (
              <Table minWidth={750}>
                <thead>
                  <tr>
                    <Th>Page URL</Th>
                    <Th>Title Tag</Th>
                    <Th>HTTP Status</Th>
                    <Th>Word Count</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {crawlPages.data.data.slice(0, 15).map((page) => (
                    <Tr key={page.id}>
                      <Td><span className="font-mono text-xs text-brand-800 truncate max-w-xs block">{page.url}</span></Td>
                      <Td><span className="font-bold text-brand-950 text-xs truncate max-w-xs block">{page.title || "—"}</span></Td>
                      <Td><span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono px-2 py-0.5">{page.statusCode ? page.statusCode : "—"}</span></Td>
                      <Td><span className="font-mono text-xs text-brand-600">{page.wordCount ? `${page.wordCount} words` : "—"}</span></Td>
                      <Td align="right">
                        <button
                          type="button"
                          onClick={() => planContent.mutate()}
                          className="rounded bg-brand-100 hover:bg-brand-200 text-brand-800 px-2 py-1 text-[11px] font-semibold transition cursor-pointer"
                        >
                          Refresh
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

      {/* Article Preview Modal */}
      {previewPiece && (
        <ArticlePreviewModal
          piece={previewPiece}
          repoConnected={Boolean(repo.data)}
          onClose={() => setPreviewPiece(null)}
          onShip={() => runContent.mutate([previewPiece.id])}
        />
      )}
    </div>
  );
}
