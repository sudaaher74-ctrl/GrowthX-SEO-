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

  const data = leads.data;
  const kpis = stats.data;

  return (
    <div className="space-y-6">
      {/* Top Overview KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          label="Total Opportunities"
          value={kpis ? String(kpis.totalOpportunities) : '—'}
          sub="Relevant publisher opportunities"
        />
        <Kpi
          label="Competitors Mentioned"
          value={kpis ? String(kpis.competitorsMentioned) : '—'}
          sub="Articles featuring your competitors"
        />
        <Kpi
          label="High Fit Opportunities"
          value={kpis ? String(kpis.highFitOpportunities) : '—'}
          sub="Best chances for inclusion"
        />
        <Kpi
          label="Earned Backlinks"
          value={kpis ? String(kpis.earnedBacklinks) : '—'}
          sub="Successfully acquired & verified"
        />
        <Kpi
          label="Estimated Traffic"
          value={kpis ? kpis.estimatedTraffic : '—'}
          sub="Potential monthly visitors"
        />
      </div>

      {notice ? (
        <div role="status">
          <StatusNote>{notice}</StatusNote>
        </div>
      ) : null}

      {/* Section 1: Competitor Recommendation Discovery Table */}
      <Panel
        title="1. Competitor Recommendation Discovery"
        subtitle="Websites and articles that recommend competing businesses. Analyze an article to uncover visible selection criteria and identify presentation gaps."
        actions={
          <ActionButton onClick={() => void leads.refetch()}>
            Refresh Leads
          </ActionButton>
        }
      >
        <div className="p-4">
          <p className="text-xs text-brand-500">
            {data?.definitions.candidate ?? 'Monitored pages that link to your saved competitors.'}{' '}
            A discovered publisher is not automatically an earned backlink. Live link verification and editorial analysis are required.
          </p>
        </div>

        <QueryState
          isLoading={leads.isLoading}
          error={leads.error}
          isEmpty={!!data && !data.items.length}
          emptyTitle="No competitor-linking pages found yet"
          emptyBody="Discover backlinks using the archive index above or import referring pages linking to your saved competitors."
          emptyAction={<ActionButton onClick={onAddSources}>Add sources</ActionButton>}
        >
          {data ? (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Publisher / Article</Th>
                    <Th>Competitors Mentioned</Th>
                    <Th>Your Status</Th>
                    <Th>Relevance / Fit</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const isSelected = selectedSourceId === item.id;
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

                    return (
                      <Tr key={item.id}>
                        <Td className="max-w-xs">
                          <p className="font-medium text-brand-950">
                            {item.analysis?.title || new URL(item.sourceUrl).hostname}
                          </p>
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
                          <div className="flex flex-wrap gap-2">
                            <ActionButton
                              variant={hasAnalysis && isSelected ? 'secondary' : 'primary'}
                              disabled={analyzeMutation.isPending}
                              onClick={() => {
                                if (hasAnalysis) {
                                  setSelectedSourceId(item.id);
                                } else {
                                  analyzeMutation.mutate(item.id);
                                }
                              }}
                            >
                              {analyzeMutation.isPending && selectedSourceId === item.id
                                ? 'Analyzing…'
                                : hasAnalysis
                                  ? isSelected
                                    ? 'Viewing'
                                    : 'View Intelligence'
                                  : 'Analyze Article'}
                            </ActionButton>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>

              <div className="flex items-center justify-between gap-2 border-t p-3 text-xs text-brand-500">
                <span>
                  {offset + 1}–{Math.min(offset + data.pageSize, data.total)} of {data.total} publisher opportunities
                </span>
                <div className="flex gap-2">
                  <ActionButton
                    disabled={!offset}
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

      {/* Intelligence Workspace (Sections 2, 3, 4, 5) when an article is selected */}
      {selectedSourceId ? (
        <SelectedArticleWorkspace
          key={selectedSourceId}
          projectId={projectId}
          sourceId={selectedSourceId}
          onClose={() => setSelectedSourceId(null)}
          onPushOpportunity={() => pushOppMutation.mutate(selectedSourceId)}
          onOpenOutreach={() => setShowOutreachModal(true)}
          isPushingOpp={pushOppMutation.isPending}
        />
      ) : null}

      {/* Section 6: Editorial Outreach Drawer/Modal */}
      {showOutreachModal && selectedSourceId ? (
        <OutreachModal
          projectId={projectId}
          sourceId={selectedSourceId}
          onClose={() => setShowOutreachModal(false)}
        />
      ) : null}
    </div>
  );
}

function SelectedArticleWorkspace({
  projectId,
  sourceId,
  onClose,
  onPushOpportunity,
  onOpenOutreach,
  isPushingOpp,
}: {
  projectId: string;
  sourceId: string;
  onClose: () => void;
  onPushOpportunity: () => void;
  onOpenOutreach: () => void;
  isPushingOpp: boolean;
}) {
  const detail = useQuery({
    queryKey: ['backlink-recommendation', projectId, sourceId],
    queryFn: () => api.backlinks.recommendationAnalysis(projectId, sourceId),
  });

  const fullReport = detail.data?.analysis;
  const article = fullReport?.article ?? (fullReport as any);
  const gaps = fullReport?.gaps ?? [];
  const readiness = fullReport?.readiness;
  const actionPlan = fullReport?.actionPlan ?? [];
  const expectedOutcome = fullReport?.expectedOutcome;

  return (
    <div className="space-y-6">
      <QueryState
        isLoading={detail.isLoading}
        error={detail.error}
        isEmpty={!fullReport}
        emptyTitle="Article intelligence pending"
        emptyBody="Click 'Analyze Article' to fetch and extract criteria, gaps, and readiness."
      >
        {fullReport && article ? (
          <>
            {/* Section 2: Why They Are Recommended */}
            <Panel
              title="2. Why They Are Recommended"
              subtitle="Evidence-based analysis of why competing businesses were featured in this publication."
              actions={
                <div className="flex gap-2">
                  <PublicLink url={detail.data!.sourceUrl} label="View Original Article" />
                  <ActionButton onClick={onClose}>Close Detail</ActionButton>
                </div>
              }
              padded
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-brand-50/50 p-4">
                  <div>
                    <h3 className="text-base font-semibold text-brand-950">{article.title}</h3>
                    <p className="mt-1 text-xs text-brand-500">
                      {article.wordCount} words · Published {when(article.publishedAt)} ·{' '}
                      {article.listicle ? 'Ranked Listicle Format' : 'Editorial Guide'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={article.ownLinked ? 'good' : article.ownMentioned ? 'warn' : 'default'}>
                      {article.ownLinked
                        ? 'Your business is linked'
                        : article.ownMentioned
                          ? 'Mentioned without link'
                          : 'Your business is not mentioned'}
                    </Pill>
                    <Pill tone={article.sponsorship?.state === 'DISCLOSED' ? 'warn' : 'default'}>
                      {article.sponsorship?.state === 'DISCLOSED'
                        ? 'Sponsorship Disclosed'
                        : 'No Sponsorship Observed'}
                    </Pill>
                  </div>
                </div>

                {/* Key Selection Criteria */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-brand-950">
                    Key Selection Criteria (from publisher article)
                  </h4>
                  {article.criteria?.length ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {article.criteria.map((c: any, index: number) => (
                        <div key={`${c.label}:${index}`} className="rounded-lg border bg-white p-3 shadow-xs">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-brand-900">{c.label}</span>
                            <Pill tone={evidenceTone(c.evidenceClass)}>
                              {c.evidenceClass === 'CONFIRMED' ? 'Stated Criteria' : 'Observed Topic'}
                            </Pill>
                          </div>
                          <p className="mt-1.5 text-xs text-brand-600 line-clamp-2">“{c.passage}”</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <StatusNote>
                      The publisher does not explicitly list selection criteria in readable text.
                    </StatusNote>
                  )}
                </div>

                {/* Featured Businesses Table */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-brand-950">
                    Featured Businesses in Article
                  </h4>
                  <Table>
                    <thead>
                      <tr>
                        <Th>#</Th>
                        <Th>Business</Th>
                        <Th>Role</Th>
                        <Th>Observed Link</Th>
                        <Th>Extracted Evidence</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {article.featured?.map((b: any) => (
                        <Tr key={`${b.kind}:${b.host ?? b.name}`}>
                          <Td>{b.position ?? '—'}</Td>
                          <Td>
                            <span className="font-medium text-brand-950">{b.name}</span>
                            <p className="text-xs text-brand-500">
                              {b.kind === 'OWN' ? 'Your business' : 'Competitor'}{' '}
                              {b.host ? `· ${b.host}` : ''}
                            </p>
                          </Td>
                          <Td>
                            <Pill>{b.role === 'LISTED' ? 'Ranked List' : 'Mentioned'}</Pill>
                          </Td>
                          <Td>
                            {b.linked ? (
                              <Pill tone="good">
                                Linked {b.rel?.length ? `(${b.rel.join(', ')})` : ''}
                              </Pill>
                            ) : (
                              <Pill tone="default">Unlinked mention</Pill>
                            )}
                          </Td>
                          <Td className="max-w-md text-xs text-brand-600">“{b.passage}”</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            </Panel>

            {/* Section 3: Why Not Us? Gap Analysis */}
            <Panel
              title="3. Why Not Us? Gap Analysis"
              subtitle="Direct comparison between the publisher's observed criteria, featured competitors, and your website presentation."
              padded
            >
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
                          <span className="font-medium text-brand-950">{g.factor}</span>
                          <p className="mt-0.5 text-xs text-brand-500">Category: {g.category}</p>
                        </Td>
                        <Td className="max-w-xs text-xs text-brand-600">{g.competitorsHave}</Td>
                        <Td className="max-w-xs text-xs text-brand-800">
                          <span className="font-medium">{g.customerStatus}</span>
                        </Td>
                        <Td className="max-w-sm text-xs text-brand-900 font-medium">{g.gap}</Td>
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
                <StatusNote>
                  No presentation gaps detected! Your website presents all factors discussed in this article.
                </StatusNote>
              )}

              {/* Recommendation Readiness Assessment Card */}
              {readiness ? (
                <div className="mt-4 rounded-lg border bg-brand-50/40 p-4">
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
                        <p className="mt-1 text-brand-500 text-[11px]">{f.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Panel>

            {/* Section 4: AI Action Plan to Get Featured */}
            <Panel
              title="4. AI Action Plan to Get Featured"
              subtitle="Step-by-step evidence-based recommendations to maximize editorial consideration."
              actions={
                <div className="flex gap-2">
                  <ActionButton
                    variant="primary"
                    disabled={isPushingOpp}
                    onClick={onPushOpportunity}
                  >
                    {isPushingOpp ? 'Pushing…' : 'Add to Opportunities'}
                  </ActionButton>
                  <ActionButton onClick={onOpenOutreach}>
                    Review Outreach Draft
                  </ActionButton>
                </div>
              }
              padded
            >
              <div className="space-y-3">
                {actionPlan.map((step) => (
                  <div
                    key={step.step}
                    className="flex items-start gap-3 rounded-lg border bg-white p-3.5 shadow-xs"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-800">
                      {step.step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-brand-950">{step.title}</h4>
                        <Pill
                          tone={
                            step.priority === 'High'
                              ? 'bad'
                              : step.priority === 'Medium'
                                ? 'warn'
                                : 'default'
                          }
                        >
                          {step.priority} Priority
                        </Pill>
                      </div>
                      <p className="mt-1 text-xs text-brand-600">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Section 5: Expected Outcome */}
            {expectedOutcome ? (
              <Panel title="5. Expected Outcome" subtitle="Realistic impact projection upon earning editorial placement." padded>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg border bg-white p-4">
                    <p className="text-xs text-brand-500">Potential Backlink</p>
                    <p className="mt-1 text-lg font-bold text-brand-950">
                      {expectedOutcome.potentialBacklink}
                    </p>
                    <p className="mt-1 text-[11px] text-brand-500">
                      Editorial dofollow or brand mention
                    </p>
                  </div>
                  <div className="rounded-lg border bg-white p-4">
                    <p className="text-xs text-brand-500">Estimated Monthly Traffic</p>
                    <p className="mt-1 text-lg font-bold text-brand-950">
                      {expectedOutcome.estimatedMonthlyTraffic} visits
                    </p>
                    <p className="mt-1 text-[11px] text-brand-500">
                      Referral clicks from engaged readership
                    </p>
                  </div>
                  <div className="rounded-lg border bg-white p-4">
                    <p className="text-xs text-brand-500">Domain Authority Boost</p>
                    <p className="mt-1 text-lg font-bold text-brand-950">
                      {expectedOutcome.domainAuthorityBoost}
                    </p>
                    <p className="mt-1 text-[11px] text-brand-500">
                      High-trust contextual publisher link
                    </p>
                  </div>
                </div>
              </Panel>
            ) : null}
          </>
        ) : null}
      </QueryState>
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
              Review and approve your personalized pitch before reaching out. Unsolicited mass automated email is strictly forbidden.
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
