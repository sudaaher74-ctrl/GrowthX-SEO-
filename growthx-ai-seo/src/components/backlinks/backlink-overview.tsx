"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, Kpi, Panel, Pill, StatusNote, Table, Td, Th, Tr } from '@/components/ui/console';
import { QueryState } from '@/components/ui/query-state';
import { api } from '@/lib/api-client';
import type { BacklinkReport } from '@/lib/backlinks';
import type { BacklinkOverviewResponse } from '@/lib/backlink-intelligence';

const number = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat().format(value);
const time = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not synced yet';

export function BacklinkOverview({ projectId, report, onSources, onOpportunities }: {
  projectId: string;
  report?: BacklinkReport;
  onSources: () => void;
  onOpportunities: () => void;
}) {
  const client = useQueryClient();
  const overview = useQuery({
    queryKey: ['backlink-intelligence', projectId],
    queryFn: () => api.backlinks.intelligenceOverview(projectId),
    retry: false,
  });
  const sync = useMutation({
    mutationFn: () => api.backlinks.syncIntelligence(projectId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['backlink-intelligence', projectId] });
    },
  });
  const snapshot = overview.data as BacklinkOverviewResponse | null | undefined;

  return <div className="space-y-4">
    <Panel title="Your backlink snapshot" subtitle="DataForSEO reports what its link index has found. Reigel checks source pages separately before calling a link verified." actions={<ActionButton variant="primary" disabled={sync.isPending} onClick={() => sync.mutate()}>{sync.isPending ? 'Syncing…' : 'Refresh DataForSEO'}</ActionButton>} padded>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-brand-500">
        <Pill tone="info">DataForSEO index</Pill>
        <span>{snapshot ? `Updated ${time(snapshot.checkedAt)}` : 'No provider snapshot yet'}</span>
        {snapshot?.isStale ? <Pill tone="warn">Older than 24 hours</Pill> : null}
        {snapshot?.costUsd != null ? <span>Last sync cost: ${snapshot.costUsd.toFixed(4)}</span> : null}
        <span>Refresh makes up to four billable provider requests.</span>
      </div>
      {snapshot?.warning ? <StatusNote tone="warn">{snapshot.warning}</StatusNote> : null}
      {sync.error ? <div className="mb-3"><StatusNote tone="bad">Sync failed: {sync.error.message}{snapshot ? ' Your previous snapshot is still shown.' : ''}</StatusNote></div> : null}
      {!snapshot ? <QueryState isLoading={overview.isLoading} error={overview.error} isEmpty={!overview.isLoading && !overview.error} emptyTitle="No DataForSEO snapshot yet" emptyBody="Refresh DataForSEO to load the first backlink index snapshot. This will make up to four billable provider requests." /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Backlinks in index" value={number(snapshot.metrics.backlinks)} sub="Provider-reported links; not direct checks" />
          <Kpi label="Referring domains" value={number(snapshot.metrics.referringDomains)} sub="DataForSEO index estimate" />
          <Kpi label="Follow links" value={number(snapshot.metrics.dofollow)} sub={`${number(snapshot.metrics.nofollow)} nofollow`} />
          <Kpi label="Broken in index" value={number(snapshot.metrics.brokenBacklinks)} sub="Provider status; verify before action" tone={snapshot.metrics.brokenBacklinks ? 'danger' : 'default'} />
        </div>
      )}
    </Panel>

    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Reigel verification" subtitle="Source pages checked directly by Reigel crawler." padded>
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Fresh verified links" value={number(report?.summary.verifiedLinks)} sub="Reigel evidence · within 7 days" />
          <Kpi label="Confirmed lost" value={number(report?.summary.confirmedLostLinks)} sub="Requires repeat successful checks" />
        </div>
        <div className="mt-3 flex gap-2"><ActionButton onClick={onSources}>Review source checks</ActionButton><ActionButton onClick={onOpportunities}>View next actions</ActionButton></div>
      </Panel>

      <Panel title="What to do next" subtitle="Turn index discoveries into evidence, then act on confirmed issues." padded>
        <ol className="space-y-3 text-sm text-brand-700">
          <li><strong>1. Discover:</strong> Review referring domains and competitor sources.</li>
          <li><strong>2. Verify:</strong> Ask Reigel to fetch source pages and inspect exact link destinations.</li>
          <li><strong>3. Act:</strong> Revisit confirmed losses or destination problems in Next Actions.</li>
        </ol>
        {report?.queue.available ? <p className="mt-3 text-xs text-brand-500">Verification queue: {number(report.queue.waiting)} waiting · {number(report.queue.active)} active</p> : null}
      </Panel>
    </div>

    {snapshot ? <Panel title="Top referring domains" subtitle="DataForSEO indexed sources · open a domain to inspect its reported links.">
      <QueryState isEmpty={!snapshot.topReferringDomains.length} emptyTitle="No referring domains in this snapshot" emptyBody="Refresh the provider snapshot to check again.">
        <Table>
          <thead><tr><Th>Domain</Th><Th>Indexed links</Th><Th>Rank</Th><Th>First seen</Th></tr></thead>
          <tbody>{snapshot.topReferringDomains.slice(0, 8).map((item) => <Tr key={item.domain}><Td className="font-medium">{item.domain}</Td><Td>{number(item.backlinks)}</Td><Td>{number(item.rank)}</Td><Td>{time(item.firstSeen)}</Td></Tr>)}</tbody>
        </Table>
      </QueryState>
    </Panel> : null}
  </div>;
}
