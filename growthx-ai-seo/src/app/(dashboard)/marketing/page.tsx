"use client";
import { useState } from "react";
import {
  ActionButton,
  Kpi,
  Mono,
  PageHeader,
  Panel,
  Pill,
  relativeTime,
  StatusNote,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
} from "@/components/ui/console";
import { Lightbulb, Calendar, Target, Megaphone, Loader2, Sparkles, CheckCircle2, ArrowRight, Award, Zap } from "lucide-react";
import { useWorkspace, useStrategies, useStrategy, useContentPieces, useOutreach, useGenerateStrategy, usePlanContent } from "@/hooks/use-growthx";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/error-message";

export default function MarketingPage() {
  const { projectId } = useWorkspace();
  const strategies = useStrategies(projectId);
  const activeStrategyId = strategies.data?.[0]?.id ?? null;
  const report = useStrategy(projectId, activeStrategyId);
  const contentPieces = useContentPieces(projectId);
  const outreach = useOutreach(projectId);
  const generateStrategy = useGenerateStrategy(projectId);
  const planContent = usePlanContent(projectId);

  const [activeTab, setActiveTab] = useState("strategy");
  // Tone travels with the text. Every outcome used to render through the
  // default "good" styling, so a failure arrived as a green success note.
  const [status, setStatus] = useState<{ text: string; tone: "good" | "bad" } | null>(null);

  const tabs = [
    { id: "strategy", label: "Marketing Strategy", icon: Lightbulb },
    { id: "planner", label: "Campaign Planner", icon: Calendar },
    { id: "seo", label: "SEO Strategy", icon: Target },
    { id: "pr", label: "PR & Outreach", icon: Megaphone },
  ];

  const handleGenerateStrategy = async () => {
    if (!projectId) return;
    setStatus(null);
    try {
      await generateStrategy.mutateAsync();
      await strategies.refetch();
      await report.refetch();
      setStatus({ text: "AI Marketing Strategy generated successfully!", tone: "good" });
    } catch (err) {
      console.error(err);
      // This used to read "Ensure site has been crawled" for every failure,
      // whatever it was — so a crawled site hitting a model or provider error
      // was told to go and crawl. The backend already explains itself; show it.
      setStatus({ text: errorMessage(err), tone: "bad" });
    }
  };

  const handlePlanContent = async () => {
    if (!projectId) return;
    setStatus(null);
    try {
      await planContent.mutateAsync();
      await contentPieces.refetch();
      setStatus({ text: "New content campaign planned!", tone: "good" });
    } catch (err) {
      console.error(err);
      // Previously logged to the console and nothing else: the button simply
      // did nothing.
      setStatus({ text: errorMessage(err), tone: "bad" });
    }
  };

  const isLoading = strategies.isLoading || report.isLoading || contentPieces.isLoading || outreach.isLoading;
  const strategyContent = report.data?.content;
  const pieces = contentPieces.data ?? [];
  const campaigns = outreach.data ?? [];
  const totalSent = campaigns.reduce((acc, c) => acc + c.sentCount, 0);
  const totalReplies = campaigns.reduce((acc, c) => acc + c.replyCount, 0);
  const totalLinks = campaigns.reduce((acc, c) => acc + c.linkCount, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Marketing Consultant"
        subtitle="Strategy generation, campaign planning, and automated outreach."
        actions={
          <div className="flex gap-2">
            <ActionButton
              variant="primary"
              icon={generateStrategy.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              onClick={handleGenerateStrategy}
              disabled={generateStrategy.isPending || !projectId}
            >
              {generateStrategy.isPending ? "Analyzing & Generating..." : "Generate AI Strategy"}
            </ActionButton>
          </div>
        }
      />

      {status && (
        <StatusNote tone={status.tone}>{status.text}</StatusNote>
      )}

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <div className="pt-2 flex items-start gap-4">
        <div className="flex-1 space-y-4 w-full">
          
          {isLoading ? (
            <Panel title="Loading">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 size={32} className="text-brand-200 mb-4 animate-spin" />
                <p className="text-sm text-[var(--text-muted)]">Assembling AI Marketing Strategy...</p>
              </div>
            </Panel>
          ) : (
            <>
              {/* ── TAB 1: MARKETING STRATEGY ── */}
              {activeTab === "strategy" && (
                <div className="space-y-4">
                  {strategyContent ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Kpi label="Strategy Model" value={report.data?.generatedByModel || "—"} sub="Engine provider" />
                        <Kpi
                          label="Roadmap Directives"
                          value={(strategyContent.seoRoadmap?.length ?? 0).toString()}
                          sub="Actions in the generated roadmap"
                        />
                        <Kpi
                          label="Generated"
                          value={report.data?.createdAt ? relativeTime(report.data.createdAt) : "—"}
                          sub="Age of this strategy report"
                        />
                      </div>

                      <Panel title="Executive Business Summary & Positioning" subtitle="High-level AI-generated marketing analysis">
                        <div className="p-5 space-y-5 text-sm text-[var(--text-primary)]">
                          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5">Business Overview</h4>
                            <p className="text-[var(--text-secondary)] leading-relaxed">{strategyContent.businessSummary}</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)]">
                              <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-primary)] mb-1.5">Market Positioning</h4>
                              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{strategyContent.marketAnalysis.positioning}</p>
                            </div>
                            <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)]">
                              <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-primary)] mb-1.5">Target Audience</h4>
                              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{strategyContent.marketAnalysis.targetAudience}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                <Zap size={14} /> Key Demand Signals
                              </h4>
                              <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                                {strategyContent.marketAnalysis.demandSignals.map((d, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                                    <span>{d}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                <Award size={14} /> Competitive Counter-Strategies
                              </h4>
                              <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                                {strategyContent.marketAnalysis.competitiveThreats.map((t, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <ArrowRight size={13} className="text-amber-500 mt-0.5 shrink-0" />
                                    <span>{t}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </Panel>
                    </>
                  ) : (
                    <Panel title="No Strategy Generated">
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Lightbulb size={48} className="text-brand-200 mb-4" />
                        <h3 className="text-lg font-medium text-[var(--text-primary)]">No Active Strategy Found</h3>
                        <p className="text-sm text-[var(--text-muted)] max-w-md mt-2 mb-6">
                          Click below to generate a complete AI Marketing & Strategic Positioning report grounded in site data.
                        </p>
                        <Button variant="primary" size="sm" onClick={handleGenerateStrategy} disabled={generateStrategy.isPending}>
                          <Sparkles size={14} className="mr-1.5" /> Auto-generate AI Strategy
                        </Button>
                      </div>
                    </Panel>
                  )}
                </div>
              )}

              {/* ── TAB 2: CAMPAIGN PLANNER ── */}
              {activeTab === "planner" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[var(--text-muted)]">Active marketing content pieces generated for search & AI visibility</span>
                    <Button variant="outline" size="sm" onClick={handlePlanContent} disabled={planContent.isPending}>
                      <Calendar size={13} className="mr-1.5" /> Plan New Content Campaign
                    </Button>
                  </div>

                  <Panel title="Content Campaign Planner" subtitle={`${pieces.length} active campaigns planned`}>
                    {pieces.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                        No content campaigns planned for this project yet. Use &ldquo;Plan New Content Campaign&rdquo; above to create one.
                      </div>
                    ) : (
                      <Table minWidth={700}>
                        <thead>
                          <tr>
                            <Th>Campaign Title</Th>
                            <Th>Target Query</Th>
                            <Th>Format</Th>
                            <Th>Status</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {pieces.map((piece) => (
                            <Tr key={piece.id}>
                              <Td><span className="font-medium text-brand-950">{piece.title}</span></Td>
                              <Td><Mono tone="soft">{piece.targetQuery || "N/A"}</Mono></Td>
                              <Td><span className="text-[13px] text-brand-700">{piece.format || "Blog Post"}</span></Td>
                              <Td>
                                <Pill tone={piece.status === "PUBLISHED" ? "good" : piece.status === "PLANNED" ? "info" : "warn"}>
                                  {piece.status}
                                </Pill>
                              </Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </Panel>
                </div>
              )}

              {/* ── TAB 3: SEO STRATEGY DIRECTIVES ── */}
              {activeTab === "seo" && (
                <div className="space-y-4">
                  <Panel title="Strategic SEO Directives & Roadmap" subtitle="Priority directives derived from technical audit and competitive data">
                    {!strategyContent?.seoRoadmap?.length ? (
                      <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                        No roadmap yet. Generate an AI strategy for this project to produce directives from its own crawl data.
                      </div>
                    ) : (
                      <Table minWidth={750}>
                        <thead>
                          <tr>
                            <Th>Horizon</Th>
                            <Th>Action Directive</Th>
                            <Th>Rationale / Why</Th>
                            <Th>Owner</Th>
                            <Th>Effort</Th>
                            <Th>Expected Impact</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {strategyContent.seoRoadmap.map((item, i) => (
                            <Tr key={i}>
                              <Td><Pill tone="info">{item.horizon}</Pill></Td>
                              <Td><span className="font-medium text-brand-950">{item.action}</span></Td>
                              <Td><span className="text-[13px] text-brand-700">{item.why}</span></Td>
                              <Td><span className="text-[12px] text-brand-500">{item.owner ?? "—"}</span></Td>
                              <Td><span className="text-[12px] text-brand-500">{item.effort}</span></Td>
                              {/* `impact` is the current field; `expectedImpact` is
                                  what reports generated before the agent rewrite used. */}
                              <Td><span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">{item.impact ?? item.expectedImpact ?? "—"}</span></Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </Panel>
                </div>
              )}

              {/* ── TAB 4: PR & OUTREACH ── */}
              {activeTab === "pr" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Kpi
                      label="Active PR Campaigns"
                      value={campaigns.filter((c) => c.status === "ACTIVE").length.toString()}
                      sub="Digital PR & Outreach"
                    />
                    <Kpi
                      label="Secured Backlinks"
                      value={totalLinks.toString()}
                      sub="Links attributed to these campaigns"
                      tone="good"
                    />
                    <Kpi
                      label="Response Rate"
                      value={totalSent > 0 ? `${((totalReplies / totalSent) * 100).toFixed(1)}%` : "—"}
                      sub="Replies across outreach sent"
                    />
                  </div>

                  <Panel title="PR & Digital Outreach Campaigns" subtitle="Brand authority and backlink acquisition campaigns">
                    {campaigns.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                        No outreach campaigns exist for this project yet.
                      </div>
                    ) : (
                      <Table minWidth={700}>
                        <thead>
                          <tr>
                            <Th>Campaign Name</Th>
                            <Th>Status</Th>
                            <Th>Outreach Sent</Th>
                            <Th>Replies</Th>
                            <Th>Links Secured</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.map((campaign) => (
                            <Tr key={campaign.id}>
                              <Td><span className="font-medium text-brand-950">{campaign.name}</span></Td>
                              <Td>
                                <Pill tone={campaign.status === "ACTIVE" ? "good" : "default"}>
                                  {campaign.status}
                                </Pill>
                              </Td>
                              <Td><span className="text-[13px] text-brand-700">{campaign.sentCount}</span></Td>
                              <Td><span className="text-[13px] text-brand-700">{campaign.replyCount}</span></Td>
                              <Td><span className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400">{campaign.linkCount}</span></Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </Panel>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
