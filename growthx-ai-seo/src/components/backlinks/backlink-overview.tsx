"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ExternalLink, ShieldCheck, Layers, Zap } from "lucide-react";
import { ActionButton, Kpi, Panel, Pill, StatusNote, Table, Td, Th, Tr } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { api } from "@/lib/api-client";
import type { BacklinkReport } from "@/lib/backlinks";
import type { BacklinkOverviewResponse } from "@/lib/backlink-intelligence";

const number = (value: number | null | undefined) => (value == null ? "—" : new Intl.NumberFormat().format(value));
const time = (value?: string | null) => (value ? new Date(value).toLocaleString() : "Not synced yet");

export function BacklinkOverview({
  projectId,
  report,
  onSources,
  onOpportunities,
}: {
  projectId: string;
  report?: BacklinkReport;
  onSources: () => void;
  onOpportunities: () => void;
}) {
  const client = useQueryClient();
  const overview = useQuery({
    queryKey: ["backlink-intelligence", projectId],
    queryFn: () => api.backlinks.intelligenceOverview(projectId),
    retry: false,
  });
  const sync = useMutation({
    mutationFn: () => api.backlinks.syncIntelligence(projectId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["backlink-intelligence", projectId] });
    },
  });
  const snapshot = overview.data as BacklinkOverviewResponse | null | undefined;

  const totalFollow = snapshot ? (snapshot.metrics.dofollow || 0) + (snapshot.metrics.nofollow || 0) : 0;
  const dofollowPct = totalFollow > 0 && snapshot ? Math.round(((snapshot.metrics.dofollow || 0) / totalFollow) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ── SNAPSHOT PANEL ── */}
      <Panel
        title="Your backlink snapshot"
        subtitle="DataForSEO link index monitoring with Reigel live page destination verification."
        actions={
          <ActionButton variant="primary" disabled={sync.isPending} onClick={() => sync.mutate()}>
            {sync.isPending ? "Syncing…" : "Refresh DataForSEO"}
          </ActionButton>
        }
        padded
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-brand-500">
          <Pill tone="info">DataForSEO index</Pill>
          <span>{snapshot ? `Updated ${time(snapshot.checkedAt)}` : "No provider snapshot yet"}</span>
          {snapshot?.isStale ? <Pill tone="warn">Older than 24 hours</Pill> : null}
          {snapshot?.costUsd != null ? <span>Last sync cost: ${snapshot.costUsd.toFixed(4)}</span> : null}
          <span>Refresh makes up to four billable provider requests.</span>
        </div>
        {snapshot?.warning ? <StatusNote tone="warn">{snapshot.warning}</StatusNote> : null}
        {sync.error ? (
          <div className="mb-3">
            <StatusNote tone="bad">
              Sync failed: {sync.error.message}
              {snapshot ? " Your previous snapshot is still shown." : ""}
            </StatusNote>
          </div>
        ) : null}

        {!snapshot ? (
          <QueryState
            isLoading={overview.isLoading}
            error={overview.error}
            isEmpty={!overview.isLoading && !overview.error}
            emptyTitle="No DataForSEO snapshot yet"
            emptyBody="Refresh DataForSEO to load the first backlink index snapshot. This will make up to four billable provider requests."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label="Backlinks in index"
                value={number(snapshot.metrics.backlinks)}
                sub="Provider-reported links; not direct checks"
              />
              <Kpi
                label="Referring domains"
                value={number(snapshot.metrics.referringDomains)}
                sub="DataForSEO index estimate"
              />
              <Kpi
                label="Follow links"
                value={number(snapshot.metrics.dofollow)}
                sub={`${dofollowPct}% dofollow ratio · ${number(snapshot.metrics.nofollow)} nofollow`}
              />
              <Kpi
                label="Broken in index"
                value={number(snapshot.metrics.brokenBacklinks)}
                sub="Provider status; verify before action"
                tone={snapshot.metrics.brokenBacklinks ? "danger" : "default"}
              />
            </div>

            {/* Dofollow / Nofollow Quality Meter Bar */}
            {totalFollow > 0 && (
              <div className="rounded-xl border border-line bg-surface-2/40 p-3">
                <div className="flex items-center justify-between text-xs text-brand-600 mb-1.5">
                  <span className="font-semibold text-brand-950 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-success-600" /> Link Profile Natural Balance
                  </span>
                  <span className="font-mono text-[11px]">
                    <strong className="text-success-700">{dofollowPct}% Dofollow</strong> ({number(snapshot.metrics.dofollow)}) &middot;{" "}
                    <span className="text-brand-500">{100 - dofollowPct}% Nofollow</span> ({number(snapshot.metrics.nofollow)})
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-brand-200/70 flex">
                  <div
                    className="h-full bg-success-500 transition-all"
                    style={{ width: `${dofollowPct}%` }}
                    title={`Dofollow: ${dofollowPct}%`}
                  />
                  <div
                    className="h-full bg-brand-400 transition-all"
                    style={{ width: `${100 - dofollowPct}%` }}
                    title={`Nofollow: ${100 - dofollowPct}%`}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* ── VERIFICATION & NEXT ACTIONS ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Reigel verification" subtitle="Source pages checked directly by Reigel crawler." padded>
          <div className="grid grid-cols-2 gap-3">
            <Kpi
              label="Fresh verified links"
              value={number(report?.summary.verifiedLinks)}
              sub="Reigel evidence · within 7 days"
            />
            <Kpi
              label="Confirmed lost"
              value={number(report?.summary.confirmedLostLinks)}
              sub="Requires repeat successful checks"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <ActionButton onClick={onSources}>Review source checks</ActionButton>
            <ActionButton onClick={onOpportunities}>View next actions</ActionButton>
          </div>
        </Panel>

        <Panel title="What to do next" subtitle="Turn index discoveries into evidence, then act on confirmed issues." padded>
          <ol className="space-y-3 text-sm text-brand-700">
            <li>
              <strong>1. Discover:</strong> Review referring domains and competitor link sources.
            </li>
            <li>
              <strong>2. Verify:</strong> Ask Reigel to fetch source pages and inspect exact link destinations.
            </li>
            <li>
              <strong>3. Act:</strong> Revisit confirmed losses or destination problems in Next Actions.
            </li>
          </ol>
          {report?.queue.available ? (
            <p className="mt-3 text-xs text-brand-500">
              Verification queue: {number(report.queue.waiting)} waiting · {number(report.queue.active)} active
            </p>
          ) : null}
        </Panel>
      </div>

      {/* ── TOP REFERRING DOMAINS TABLE ── */}
      {snapshot ? (
        <Panel
          title="Top referring domains"
          subtitle="DataForSEO indexed sources · open a domain to inspect its reported links."
        >
          <QueryState
            isEmpty={!snapshot.topReferringDomains.length}
            emptyTitle="No referring domains in this snapshot"
            emptyBody="Refresh the provider snapshot to check again."
          >
            <Table minWidth={600}>
              <thead>
                <tr>
                  <Th>Referring Domain</Th>
                  <Th>Authority Tier</Th>
                  <Th align="right">Indexed Links</Th>
                  <Th align="right">Domain Rank</Th>
                  <Th align="right">First Seen</Th>
                </tr>
              </thead>
              <tbody>
                {snapshot.topReferringDomains.slice(0, 10).map((item) => {
                  const rankVal = item.rank ?? 0;
                  return (
                    <Tr key={item.domain}>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-brand-950 font-mono text-xs">{item.domain}</span>
                          <a
                            href={`https://${item.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-400 hover:text-brand-950 transition-colors"
                            title={`Visit ${item.domain}`}
                          >
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      </Td>
                      <Td>
                        {rankVal >= 70 ? (
                          <span className="inline-flex items-center gap-1 rounded border border-success-500/20 bg-success-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-success-700">
                            High Authority
                          </span>
                        ) : rankVal >= 40 ? (
                          <span className="inline-flex items-center gap-1 rounded border border-primary-500/20 bg-primary-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-primary-700">
                            Established
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-brand-500">
                            Niche
                          </span>
                        )}
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-xs text-brand-950">{number(item.backlinks)}</span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-xs font-bold text-brand-950">#{number(item.rank)}</span>
                      </Td>
                      <Td align="right">
                        <span className="text-xs text-brand-500">{time(item.firstSeen)}</span>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </QueryState>
        </Panel>
      ) : null}

      {/* ── AUTHORITY LINK ACQUISITION STRATEGY ── */}
      <Panel
        title="Authority Link Acquisition Playbook"
        subtitle="Proven outreach and digital PR playbooks to win high-quality inbound backlinks."
        padded
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface-2/30 p-3.5">
            <div className="flex items-center gap-2 text-primary-700">
              <Zap size={16} aria-hidden="true" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-950">Unlinked Mentions</h4>
            </div>
            <p className="mt-2 text-xs leading-5 text-brand-600">
              Scan editorial articles and blogs that mention your brand name or founders without linking. A lightweight email request converts over 30% into live dofollow links.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-surface-2/30 p-3.5">
            <div className="flex items-center gap-2 text-warning-700">
              <Layers size={16} aria-hidden="true" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-950">Broken Link Interception</h4>
            </div>
            <p className="mt-2 text-xs leading-5 text-brand-600">
              Identify 404 dead links pointing to discontinued competitor pages in your niche. Reach out to the webmaster with your updated guide as a turnkey replacement.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-surface-2/30 p-3.5">
            <div className="flex items-center gap-2 text-success-700">
              <ShieldCheck size={16} aria-hidden="true" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-950">Competitor Gap Outreach</h4>
            </div>
            <p className="mt-2 text-xs leading-5 text-brand-600">
              Use the Competitor Link Gap tab to find trusted resource directories that link to 2+ rivals. Request inclusion in their industry vendor directory.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
