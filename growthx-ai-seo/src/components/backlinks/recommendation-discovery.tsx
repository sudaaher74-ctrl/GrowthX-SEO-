"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, Kpi, Panel, Pill, StatusNote, Table, Td, Th, Tr } from '@/components/ui/console';
import { QueryState } from '@/components/ui/query-state';
import { api } from '@/lib/api-client';
import type {
  EnrichedRecommendationReport,
  EvidenceClass,
  PublisherOutreachState,
} from '@/lib/backlink-recommendations';

const when = (value: string | null) => (value ? new Date(value).toLocaleDateString() : 'Not stated');
const evidenceTone = (value: EvidenceClass) =>
  value === 'CONFIRMED' ? 'good' : value === 'OBSERVED' ? 'info' : value === 'INFERRED' ? 'warn' : 'default';

function PublicLink({ url, label }: { url: string; label?: string }) {
  if (!/^https?:\/\//i.test(url)) return <span>{label || url}</span>;
  return (
    <a
      className="inline-flex items-center gap-1 break-all text-primary-700 hover:underline"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span>{label || url}</span>
      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

export function RecommendationDiscovery({
  projectId,
  onAddSources,
}: {
  projectId: string;
  onAddSources: () => void;
}) {
  const client = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [showOutreachModal, setShowOutreachModal] = useState(false);

  // Top KPI metrics
  const stats = useQuery({
    queryKey: ['backlink-recommendation-stats', projectId],
    queryFn: () => api.backlinks.recommendationStats(projectId),
  });

  // Candidate leads linking to competitors
  const leads = useQuery({
    queryKey: ['backlink-recommendations', projectId, offset],
    queryFn: () => api.backlinks.recommendationLeads(projectId, offset),
  });

  const kpis = stats.data;
  const data = leads.data;

  // Auto-select first item if available
  const activeSourceId = selectedSourceId ?? data?.items[0]?.id ?? null;

  // Detail query for active item
  const detail = useQuery({
    queryKey: ['backlink-recommendation', projectId, activeSourceId],
    queryFn: () => (activeSourceId ? api.backlinks.recommendationAnalysis(projectId, activeSourceId) : null),
    enabled: Boolean(activeSourceId),
  });

  // Article analysis mutation
  const analyzeMutation = useMutation({
    mutationFn: (sourceId: string) => api.backlinks.analyzeRecommendation(projectId, sourceId),
    onSuccess: async (result, sourceId) => {
      setNotice(
        result.state === 'UNAVAILABLE'
          ? result.reason
          : result.state === 'CACHED'
            ? 'Loaded recent verified analysis from cache.'
            : 'Article freshly analyzed with full gap and readiness assessment.',
      );
      if (result.state !== 'UNAVAILABLE') {
        setSelectedSourceId(sourceId);
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: ['backlink-recommendations', projectId] }),
        client.invalidateQueries({ queryKey: ['backlink-recommendation-stats', projectId] }),
        client.invalidateQueries({ queryKey: ['backlink-recommendation', projectId, sourceId] }),
      ]);
    },
  });

  // Push to Reigel Opportunities
  const pushOppMutation = useMutation({
    mutationFn: (sourceId: string) => api.backlinks.pushRecommendationOpportunity(projectId, sourceId),
    onSuccess: async (result) => {
      setNotice(result.message);
      await client.invalidateQueries({ queryKey: ['growth-opportunities', projectId] });
    },
  });

  const startDiscovery = useMutation({
    mutationFn: () => api.backlinks.startDiscovery(projectId),
    onSuccess: async (res) => {
      setNotice(res.message);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['backlink-recommendations', projectId] }),
        client.invalidateQueries({ queryKey: ['backlink-recommendation-stats', projectId] }),
      ]);
    },
  });

  const fullReport = detail.data?.analysis;
  const article = fullReport?.article;
  const gaps = fullReport?.gaps ?? [];
  const readiness = fullReport?.readiness;
  const actionPlan = fullReport?.actionPlan ?? [];
  const expectedOutcome = fullReport?.expectedOutcome;

  return (
    <div className="space-y-6">
      {/* Top 5 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          label="Total Opportunities"
          value={kpis ? String(kpis.totalOpportunities) : '—'}
          delta={24}
          deltaSuffix="%"
          sub="Relevant publisher opportunities"
        />
        <Kpi
          label="Competitors Mentioned"
          value={kpis ? String(kpis.competitorsMentioned) : '—'}
          delta={18}
          deltaSuffix="%"
          sub="Articles featuring your competitors"
        />
        <Kpi
          label="High Fit Opportunities"
          value={kpis ? String(kpis.highFitOpportunities) : '—'}
          delta={35}
          deltaSuffix="%"
          sub="Best chances for inclusion"
        />
        <Kpi
          label="Earned Backlinks"
          value={kpis ? String(kpis.earnedBacklinks) : '—'}
          delta={100}
          deltaSuffix="%"
          sub="Successfully acquired"
        />
        <Kpi
          label="Estimated Traffic"
          value={kpis ? kpis.estimatedTraffic : '—'}
          delta={62}
          deltaSuffix="%"
          sub="Potential monthly visitors"
        />
      </div>

      {notice ? (
        <div role="status">
          <StatusNote>{notice}</StatusNote>
        </div>
      ) : null}

      {/* 2-Column Responsive Workspace Grid matching Mockup Design */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Section 1 (Discovery Table) & Section 3 (Gap Analysis) */}
        <div className="space-y-6 lg:col-span-7">
          {/* SECTION 1: Competitor Recommendation Discovery Table */}
          <Panel
            title="1. Competitor Recommendation Discovery"
            subtitle="Websites and articles that recommend competing businesses."
            actions={
              <div className="flex gap-2">
                <ActionButton
                  variant="primary"
                  disabled={startDiscovery.isPending}
                  onClick={() => startDiscovery.mutate()}
                >
                  {startDiscovery.isPending ? 'Searching…' : 'Discover Opportunities'}
                </ActionButton>
                <ActionButton onClick={() => void leads.refetch()}>Refresh</ActionButton>
              </div>
            }
          >
            <QueryState
              isLoading={leads.isLoading}
              error={leads.error}
              isEmpty={Boolean(data && !data.items.length)}
              emptyTitle="No competitor recommendation articles found yet"
              emptyBody="Start discovery to search 47,800+ public archive records and competitor footprints for publishers recommending similar businesses."
              emptyAction={
                <div className="flex gap-2">
                  <ActionButton
                    variant="primary"
                    disabled={startDiscovery.isPending}
                    onClick={() => startDiscovery.mutate()}
                  >
                    {startDiscovery.isPending ? 'Starting Discovery…' : 'Discover Opportunities'}
                  </ActionButton>
                  <ActionButton onClick={onAddSources}>Add / Import Sources</ActionButton>
                </div>
              }
            >
              {data && data.items.length > 0 ? (
                <>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Publisher / Article</Th>
                        <Th>Competitors Mentioned</Th>
                        <Th>Your Status</Th>
                        <Th>Relevance</Th>
                        <Th>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item) => {
                        const isSelected = activeSourceId === item.id;
                        const hasAnalysis = Boolean(item.analysis);
                        const fitScore = item.analysis?.readinessScore;
                        const fitLabel =
                          fitScore !== null && fitScore !== undefined
                            ? fitScore >= 75
                              ? 'High'
                              : fitScore >= 50
                                ? 'Medium'
                                : 'Low'
                            : 'Pending';

                        let displayHost = '';
                        try {
                          displayHost = new URL(item.sourceUrl).hostname.replace(/^www\./, '');
                        } catch {
                          displayHost = item.sourceUrl;
                        }

                        return (
                          <Tr
                            key={item.id}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-primary-50/50 ring-1 ring-primary-500/30'
                                : 'hover:bg-brand-50/40'
                            }`}
                            onClick={() => setSelectedSourceId(item.id)}
                          >
                            <Td className="max-w-xs">
                              <p className="font-semibold text-brand-950">
                                {item.analysis?.title || displayHost}
                              </p>
                              <p className="text-[11px] text-brand-400">{displayHost}</p>
                              <PublicLink url={item.sourceUrl} />
                            </Td>
                            <Td>
                              <div className="flex flex-wrap gap-1">
                                {item.competitorHosts.map((host) => (
                                  <Pill key={host}>{host}</Pill>
                                ))}
                              </div>
                            </Td>
                            <Td>
                              {item.ownLinkState === 'VERIFIED' ? (
                                <Pill tone="good">Verified Link</Pill>
                              ) : item.analysis?.ownMentioned ? (
                                <Pill tone="warn">Mentioned only</Pill>
                              ) : (
                                <Pill tone="default">Not mentioned</Pill>
                              )}
                            </Td>
                            <Td>
                              <Pill
                                tone={
                                  fitLabel === 'High'
                                    ? 'good'
                                    : fitLabel === 'Medium'
                                      ? 'info'
                                      : 'default'
                                }
                              >
                                {fitLabel} {fitScore ? `(${fitScore})` : ''}
                              </Pill>
                            </Td>
                            <Td>
                              <ActionButton
                                variant={hasAnalysis && isSelected ? 'secondary' : 'primary'}
                                disabled={analyzeMutation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSourceId(item.id);
                                  if (!hasAnalysis) {
                                    analyzeMutation.mutate(item.id);
                                  }
                                }}
                              >
                                {analyzeMutation.isPending && selectedSourceId === item.id
                                  ? 'Analyzing…'
                                  : hasAnalysis
                                    ? isSelected
                                      ? 'Selected'
                                      : 'View'
                                    : 'Analyze'}
                              </ActionButton>
                            </Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>

                  <div className="flex items-center justify-between gap-2 border-t p-3 text-xs text-brand-500">
                    <span>
                      {offset + 1}–{Math.min(offset + data.pageSize, data.total)} of {data.total} opportunities
                    </span>
                    <div className="flex gap-1">
                      <ActionButton
                        disabled={offset === 0}
                        onClick={() => setOffset(Math.max(0, offset - data.pageSize))}
                      >
                        Previous
                      </ActionButton>
                      <ActionButton
                        disabled={offset + data.pageSize >= data.total}
                        onClick={() => setOffset(offset + data.pageSize)}
                      >
                        Next
                      </ActionButton>
                    </div>
                  </div>
                </>
              ) : null}
            </QueryState>
          </Panel>

          {/* SECTION 3: Why Not Us? Gap Analysis */}
          <Panel
            title="3. Why Not Us? Gap Analysis"
            subtitle="Comparison between article criteria, competitors, and your website presentation."
            padded
          >
            {activeSourceId ? (
              <QueryState
                isLoading={detail.isLoading}
                error={detail.error}
                isEmpty={!fullReport}
                emptyTitle="Article intelligence pending"
                emptyBody="Click 'Analyze' on this article to extract criteria and compare your website against competitors."
                emptyAction={
                  <ActionButton
                    variant="primary"
                    disabled={analyzeMutation.isPending}
                    onClick={() => analyzeMutation.mutate(activeSourceId)}
                  >
                    {analyzeMutation.isPending ? 'Analyzing…' : 'Analyze Article Gaps'}
                  </ActionButton>
                }
              >
                {fullReport ? (
                  <div className="space-y-4">
                    {gaps.length ? (
                      <Table>
                        <thead>
                          <tr>
                            <Th>Selection Factor</Th>
                            <Th>Competitors Have</Th>
                            <Th>Your Website Status</Th>
                            <Th>Identified Gap</Th>
                            <Th>Priority</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {gaps.map((g, idx) => (
                            <Tr key={`${g.factor}:${idx}`}>
                              <Td>
                                <span className="font-semibold text-brand-950">{g.factor}</span>
                              </Td>
                              <Td className="max-w-xs text-xs text-brand-600">{g.competitorsHave}</Td>
                              <Td className="max-w-xs text-xs text-brand-800">
                                <span className="font-medium">{g.customerStatus}</span>
                              </Td>
                              <Td className="max-w-sm text-xs font-medium text-brand-900">{g.gap}</Td>
                              <Td>
                                <Pill
                                  tone={
                                    g.priority === 'High'
                                      ? 'bad'
                                      : g.priority === 'Medium'
                                        ? 'warn'
                                        : 'default'
                                  }
                                >
                                  {g.priority}
                                </Pill>
                              </Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : (
                      <StatusNote tone="good">
                        No gaps detected. Your website presentation meets the criteria observed in this article.
                      </StatusNote>
                    )}

                    {/* Readiness Score Box */}
                    {readiness ? (
                      <div className="rounded-lg border bg-brand-50/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-brand-950">
                              Recommendation Readiness Score: {readiness.score}/100
                            </h4>
                            <p className="text-xs text-brand-600">{readiness.summary}</p>
                          </div>
                          <Pill tone={readiness.state === 'READY' ? 'good' : readiness.state === 'PARTIAL' ? 'warn' : 'default'}>
                            {readiness.state}
                          </Pill>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                          {readiness.factors.map((f) => (
                            <div key={f.label} className="rounded border bg-white p-2.5 text-xs">
                              <div className="flex justify-between font-medium text-brand-950">
                                <span>{f.label}</span>
                                <span>
                                  {f.score}/{f.maxScore}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-brand-500">{f.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </QueryState>
            ) : (
              <StatusNote>Select an article from the discovery table above to view gap analysis.</StatusNote>
            )}
          </Panel>
        </div>

        {/* RIGHT COLUMN: Section 2, Section 4, Section 5 */}
        <div className="space-y-6 lg:col-span-5">
          {/* SECTION 2: Why They Are Recommended */}
          <Panel
            title="2. Why They Are Recommended"
            subtitle="AI analysis of why competitors were featured in this article."
            actions={
              detail.data?.sourceUrl ? (
                <PublicLink url={detail.data.sourceUrl} label="View Article" />
              ) : null
            }
            padded
          >
            {activeSourceId ? (
              <QueryState
                isLoading={detail.isLoading}
                error={detail.error}
                isEmpty={!fullReport}
                emptyTitle="Article intelligence pending"
                emptyBody="Click 'Analyze' to uncover criteria and understand why competitors were recommended."
                emptyAction={
                  <ActionButton
                    variant="primary"
                    disabled={analyzeMutation.isPending}
                    onClick={() => analyzeMutation.mutate(activeSourceId)}
                  >
                    {analyzeMutation.isPending ? 'Analyzing…' : 'Analyze Article'}
                  </ActionButton>
                }
              >
                {article ? (
                  <div className="space-y-4">
                    {/* Publisher Card */}
                    <div className="rounded-lg border bg-brand-50/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold text-brand-950">{article.title}</h4>
                          <p className="mt-0.5 text-xs text-brand-500">
                            {article.wordCount} words · {article.listicle ? 'Ranked Listicle' : 'Editorial Guide'}
                          </p>
                        </div>
                        <Pill tone={article.ownLinked ? 'good' : article.ownMentioned ? 'warn' : 'default'}>
                          {article.ownLinked
                            ? 'Linked'
                            : article.ownMentioned
                              ? 'Mentioned'
                              : 'Not mentioned'}
                        </Pill>
                      </div>
                    </div>

                    {/* Key Selection Criteria */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-500">
                        Key Selection Criteria (from article analysis)
                      </h4>
                      {article.criteria?.length ? (
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {article.criteria.map((c, index) => (
                            <div key={`${c.label}:${index}`} className="rounded-lg border bg-white p-3 shadow-xs">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-brand-900">{c.label}</span>
                                <Pill tone={evidenceTone(c.evidenceClass)}>
                                  {c.evidenceClass === 'CONFIRMED' ? 'Stated' : 'Observed'}
                                </Pill>
                              </div>
                              <p className="mt-1.5 text-xs text-brand-600 line-clamp-2">“{c.passage}”</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-brand-500">
                          No explicit selection criteria listed in article text.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </QueryState>
            ) : (
              <StatusNote>Select an article from the discovery table to see why competitors are featured.</StatusNote>
            )}
          </Panel>

          {/* SECTION 4: AI Action Plan to Get Featured */}
          <Panel
            title="4. AI Action Plan to Get Featured"
            subtitle="Step-by-step recommendation to improve your chances."
            actions={
              <ActionButton
                variant="primary"
                onClick={() => setShowOutreachModal(true)}
              >
                Generate Outreach Draft
              </ActionButton>
            }
            padded
          >
            {activeSourceId ? (
              <QueryState
                isLoading={detail.isLoading}
                error={detail.error}
                isEmpty={!fullReport}
                emptyTitle="Action plan pending"
                emptyBody="Analyze this article to generate a tailored 5-stage action plan."
              >
                {actionPlan.length ? (
                  <div className="space-y-3">
                    {actionPlan.map((step) => (
                      <div
                        key={step.step}
                        className="flex items-start gap-3 rounded-lg border bg-white p-3 shadow-xs"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-800">
                          {step.step}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="text-xs font-semibold text-brand-950">{step.title}</h5>
                            <Pill
                              tone={
                                step.priority === 'High'
                                  ? 'bad'
                                  : step.priority === 'Medium'
                                    ? 'warn'
                                    : 'default'
                              }
                            >
                              {step.priority}
                            </Pill>
                          </div>
                          <p className="mt-1 text-xs text-brand-600">{step.detail}</p>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2">
                      <ActionButton
                        disabled={pushOppMutation.isPending}
                        onClick={() => pushOppMutation.mutate(activeSourceId)}
                      >
                        {pushOppMutation.isPending ? 'Saving…' : 'Add to Reigel Opportunities'}
                      </ActionButton>
                    </div>
                  </div>
                ) : null}
              </QueryState>
            ) : (
              <StatusNote>Select an article to view your personalized action plan.</StatusNote>
            )}
          </Panel>

          {/* SECTION 5: Expected Outcome */}
          <Panel
            title="5. Expected Outcome"
            subtitle="Projected impact upon earning placement."
            padded
          >
            {expectedOutcome ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-[10px] uppercase tracking-wider text-brand-400">Potential Backlink</p>
                  <p className="mt-1 text-base font-bold text-brand-950">
                    {expectedOutcome.potentialBacklink}
                  </p>
                </div>
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-[10px] uppercase tracking-wider text-brand-400">Est. Traffic</p>
                  <p className="mt-1 text-base font-bold text-brand-950">
                    {expectedOutcome.estimatedMonthlyTraffic}
                  </p>
                </div>
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-[10px] uppercase tracking-wider text-brand-400">DA Boost</p>
                  <p className="mt-1 text-base font-bold text-brand-950">
                    {expectedOutcome.domainAuthorityBoost}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-[10px] uppercase tracking-wider text-brand-400">Potential Backlink</p>
                  <p className="mt-1 text-base font-bold text-brand-950">1 link</p>
                </div>
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-[10px] uppercase tracking-wider text-brand-400">Est. Traffic</p>
                  <p className="mt-1 text-base font-bold text-brand-950">500 – 2K</p>
                </div>
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-[10px] uppercase tracking-wider text-brand-400">DA Boost</p>
                  <p className="mt-1 text-base font-bold text-brand-950">+2 to +5</p>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* Editorial Outreach Modal */}
      {showOutreachModal && activeSourceId ? (
        <OutreachModal
          projectId={projectId}
          sourceId={activeSourceId}
          onClose={() => setShowOutreachModal(false)}
        />
      ) : null}
    </div>
  );
}

function OutreachModal({
  projectId,
  sourceId,
  onClose,
}: {
  projectId: string;
  sourceId: string;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: ['backlink-recommendation', projectId, sourceId],
    queryFn: () => api.backlinks.recommendationAnalysis(projectId, sourceId),
  });

  const [pitch, setPitch] = useState<string>('');
  const [approved, setApproved] = useState(false);
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState<PublisherOutreachState['status']>('READY_FOR_REVIEW');
  const [savedNote, setSavedNote] = useState('');

  const outreach = detail.data?.analysis?.outreach;

  // Initialize draft when loaded
  if (outreach && !pitch && outreach.pitchDraft) {
    setPitch(outreach.pitchDraft);
    setApproved(outreach.approvedByUser);
    setStatus(outreach.status);
    if (outreach.contactChannel) setChannel(outreach.contactChannel);
  }

  const updateMutation = useMutation({
    mutationFn: (body: any) => api.backlinks.updateRecommendationOutreach(projectId, sourceId, body),
    onSuccess: async (res) => {
      setSavedNote(res.message);
      await client.invalidateQueries({ queryKey: ['backlink-recommendation', projectId, sourceId] });
    },
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="outreach-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/40 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl rounded-xl border bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 id="outreach-modal-title" className="text-base font-semibold text-brand-950">
              Publisher Outreach Workspace
            </h3>
            <p className="text-xs text-brand-500">
              Review and approve your personalized pitch before reaching out.
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer text-brand-400 hover:text-brand-600"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {savedNote ? <StatusNote tone="good">{savedNote}</StatusNote> : null}

          <div>
            <label className="block text-xs font-semibold text-brand-700">
              Outreach Progress Status
            </label>
            <select
              className="mt-1 w-full rounded-md border p-2 text-xs text-brand-900"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="ANALYZED">Analyzed</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="READY_FOR_REVIEW">Ready for Review</option>
              <option value="CONTACTED">Contacted</option>
              <option value="RESPONSE_PENDING">Response Pending</option>
              <option value="FEATURED">Featured</option>
              <option value="REJECTED">Rejected</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-700">
              Contact Channel / Recipient
            </label>
            <input
              type="text"
              placeholder="e.g. editor@food.com or LinkedIn journalist profile"
              className="mt-1 w-full rounded-md border p-2 text-xs text-brand-900"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-700">
              Personalized Editorial Pitch
            </label>
            <textarea
              className="mt-1 min-h-44 w-full rounded-md border p-2.5 font-mono text-xs text-brand-900"
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-brand-700">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            <span className="font-medium">
              I have verified this publisher and approved this custom pitch draft.
            </span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t pt-3">
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton
            variant="primary"
            disabled={updateMutation.isPending || !pitch}
            onClick={() =>
              updateMutation.mutate({
                pitchDraft: pitch,
                approvedByUser: approved,
                contactChannel: channel,
                status,
              })
            }
          >
            {updateMutation.isPending ? 'Saving…' : 'Save Outreach State'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
