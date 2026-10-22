"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, Kpi, PageHeader, Panel, Pill, StatusNote, Table, Td, Th, Tr } from '@/components/ui/console';
import { QueryState } from '@/components/ui/query-state';
import { useWorkspace } from '@/hooks/use-growthx';
import { api } from '@/lib/api-client';
import type { BacklinkMutationResult, BacklinkSource } from '@/lib/backlinks';

const date = (value: string | null) => value ? new Date(value).toLocaleString() : 'Not checked';
const inputClass = 'w-full rounded-lg border bg-white p-2 text-sm text-brand-950 focus:outline-primary-600';

function PublicLink({ url }: { url: string }) {
  // Imported data and evidence remain text; never render source HTML.
  if (!/^https?:\/\//i.test(url)) return <span>{url}</span>;
  return <a className="break-all text-primary-700 hover:underline" href={url} target="_blank" rel="noopener noreferrer">{url}</a>;
}

export function BacklinkWorkspace() {
  const { projectId } = useWorkspace();
  return projectId ? <ProjectBacklinks key={projectId} projectId={projectId} />
    : <QueryState isEmpty emptyTitle="Choose a project" emptyBody="Select a website in the workspace switcher to monitor its backlinks." />;
}

function ProjectBacklinks({ projectId }: { projectId: string }) {
  const client = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [text, setText] = useState('');
  const [discovery, setDiscovery] = useState<'MANUAL' | 'GSC_CSV' | 'CSV'>('MANUAL');
  const [note, setNote] = useState('');
  const [fileError, setFileError] = useState('');
  const [historySource, setHistorySource] = useState<string | null>(null);
  const [tab, setTab] = useState<'evidence' | 'actions' | 'prospects'>('evidence');
  const report = useQuery({
    queryKey: ['backlinks', projectId, offset], queryFn: () => api.backlinks.report(projectId, offset),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.queue.available && (data.queue.active + data.queue.waiting > 0 || data.sources.some((source) => source.status === 'PENDING')) ? 5000 : false;
    },
  });
  const mutation = useMutation({
    mutationFn: async (operation: { kind: 'import' | 'discover' | 'verify' | 'reconcile' | 'remove'; sourceId?: string }): Promise<BacklinkMutationResult> => {
      if (operation.kind === 'import') return api.backlinks.import(projectId, text, discovery);
      if (operation.kind === 'discover') return api.backlinks.discover(projectId);
      if (operation.kind === 'reconcile') return api.backlinks.reconcile(projectId);
      if (operation.kind === 'remove') { await api.backlinks.remove(projectId, operation.sourceId!); return { message: 'Source page and its monitoring history removed.' }; }
      return api.backlinks.verify(projectId, operation.sourceId);
    },
    onSuccess: async (result, operation) => {
      setNote(result.message ?? (result.reconciled !== undefined ? `Rechecked actions against the latest audits for ${result.reconciled} source pages.` : 'Saved.'));
      if (operation.kind === 'import') { setText(''); setOffset(0); }
      if (operation.kind === 'remove') { setHistorySource(null); setOffset(0); }
      await Promise.all([
        client.invalidateQueries({ queryKey: ['backlinks', projectId] }),
        client.invalidateQueries({ queryKey: ['backlink-history', projectId] }),
        client.invalidateQueries({ queryKey: ['growth-opportunities', projectId] }),
        client.invalidateQueries({ queryKey: ['findings', projectId] }),
      ]);
    },
  });
  const data = report.data;
  const busy = mutation.isPending;

  return <div className="space-y-5">
    <PageHeader title="Backlink intelligence" subtitle="Protect existing links. Prepare the destination. Verify what changed."
      actions={<><Link className="self-center text-xs text-primary-700 hover:underline" href="/fix-engine?tab=ledger">Verification ledger</Link><ActionButton disabled={busy} onClick={() => report.refetch()}>Refresh</ActionButton>
        <ActionButton variant="primary" disabled={busy || !data?.queue.available} onClick={() => mutation.mutate({ kind: 'verify' })}>Verify next 25 sources</ActionButton></>} />
    <Panel padded>
      <p className="text-sm text-brand-600">{data?.coverage ?? 'Monitor source pages you import or discover in your project crawls. No paid backlink data service is required.'}</p>
      <p className="mt-2 text-xs text-brand-500">A source can be checked once every ten minutes. Loss needs repeat successful checks at least 24 hours apart. First observed means first seen by GrowthX. The latest 30 observations per source are retained.</p>
    </Panel>
    {note ? <div role="status"><StatusNote>{note}</StatusNote></div> : null}
    {mutation.error ? <div role="alert"><StatusNote tone="bad">{mutation.error.message}</StatusNote></div> : null}
    {fileError ? <div role="alert"><StatusNote tone="bad">{fileError}</StatusNote></div> : null}
    {data && !data.queue.available ? <StatusNote tone="bad">{data.queue.reason}</StatusNote> : null}
    {data ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi label="Monitored source pages" value={String(data.summary.totalSources)} sub={`Limit ${data.limits.sources} per project`} />
      <Kpi label="Verified backlinks" value={String(data.summary.verifiedLinks)} sub="Own site · verified within seven days" />
      <Kpi label="Referring hosts observed" value={String(data.summary.referringDomains)} sub="Own site · www aliases combined" />
      <Kpi label="Confirmed missing" value={String(data.summary.confirmedLostLinks)} sub="Previously verified own-site links" />
      <Kpi label="Open actions" value={String(data.summary.openActions)} sub="Shown in your Opportunities queue" />
    </div> : null}
    <Panel title="Add evidence" subtitle="Paste referring page URLs, or import a Search Console Links CSV. Source pages are inspected for links to your website and saved competitors." padded>
      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); setNote(''); mutation.mutate({ kind: 'import' }); }}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-brand-600">Import source
            <select className={`${inputClass} mt-1`} value={discovery} onChange={(event) => setDiscovery(event.target.value as typeof discovery)}>
              <option value="MANUAL">Source URLs</option><option value="GSC_CSV">Search Console CSV</option><option value="CSV">Other CSV</option>
            </select>
          </label>
          <label className="text-xs text-brand-600">CSV or text file (up to 500 KB)
            <input className="mt-1 block text-xs" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={async (event) => {
              const file = event.target.files?.[0]; setFileError('');
              if (!file) return;
              if (file.size > 500000) { setFileError('Choose a file under 500 KB.'); return; }
              try { setText(await file.text()); } catch { setFileError('Could not read that file.'); }
            }} />
          </label>
        </div>
        <label className="block text-xs text-brand-600" htmlFor="backlink-import">One source URL per line, or CSV with sourceUrl and optional targetUrl columns (up to 200 rows)</label>
        <textarea id="backlink-import" className={`${inputClass} min-h-28 font-mono`} value={text} maxLength={500000} onChange={(event) => setText(event.target.value)} required />
        <div className="flex flex-wrap gap-2">
          <ActionButton type="submit" variant="primary" disabled={busy || !text.trim()}>Save candidates</ActionButton>
          <ActionButton type="button" disabled={busy} onClick={() => mutation.mutate({ kind: 'discover' })}>Find links in project crawls</ActionButton>
        </div>
        <p className="text-xs text-brand-500">Search Console exports are imported manually; connecting Google does not import its Links report. Your own crawl finds outbound links, so external source URLs are needed for wider discovery.</p>
      </form>
    </Panel>
    <nav aria-label="Backlink views" className="flex flex-wrap gap-2">
      {(['evidence', 'actions', 'prospects'] as const).map((item) => <ActionButton key={item} aria-pressed={tab === item} variant={tab === item ? 'primary' : 'secondary'} onClick={() => setTab(item)}>
        {item === 'evidence' ? 'Source evidence' : item === 'actions' ? 'Next actions' : 'Observed competitor sources'}
      </ActionButton>)}
    </nav>
    <QueryState isLoading={report.isLoading} error={report.error}>
      {data && tab === 'evidence' ? <Panel title="Source evidence" subtitle="Open a page to see link destinations, readiness, and verification history.">
        <QueryState isEmpty={!data.sources.length} emptyTitle="No source pages yet" emptyBody="Import URLs from the Search Console Links report or add referring pages you already know.">
          <Table><thead><tr><Th>Referring page</Th><Th>Latest attempt</Th><Th>Observed links</Th><Th>Actions</Th></tr></thead>
            <tbody>{data.sources.map((source) => <SourceRow key={source.id} source={source} busy={busy} available={data.queue.available}
              onVerify={() => mutation.mutate({ kind: 'verify', sourceId: source.id })}
              onHistory={() => setHistorySource(source.id)}
              onRemove={() => { if (window.confirm('Remove this monitored source, its history, and related backlink tasks?')) mutation.mutate({ kind: 'remove', sourceId: source.id }); }} />)}</tbody>
          </Table>
          <div className="flex items-center justify-between gap-2 border-t p-3 text-xs text-brand-500">
            <span>{offset + 1}–{Math.min(offset + 25, data.summary.totalSources)} of {data.summary.totalSources} sources</span>
            <div className="flex gap-2"><ActionButton disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</ActionButton>
              <ActionButton disabled={offset + 25 >= data.summary.totalSources} onClick={() => setOffset(offset + 25)}>Next</ActionButton></div>
          </div>
        </QueryState>
      </Panel> : null}
      {data && tab === 'actions' ? <Panel title="Next actions" subtitle="Repair destinations before seeking links. Completion is verified against fresh evidence."
        actions={<ActionButton disabled={busy} onClick={() => mutation.mutate({ kind: 'reconcile' })}>Recheck latest audits</ActionButton>}>
        <QueryState isEmpty={!data.opportunities.length} emptyTitle="No verified link actions yet" emptyBody="Verify source pages and run a website audit. Actions appear when evidence shows a broken destination or confirmed link loss.">
          <div className="divide-y">{data.opportunities.map((action) => <div className="space-y-2 p-4" key={action.id}>
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold text-brand-950">{action.title}</h2><Pill>{action.lifecycle}</Pill></div>
            <p className="text-sm text-brand-600">{action.summary}</p><p className="text-sm text-brand-950">{action.recommendedAction}</p>
            <dl className="space-y-1 text-xs text-brand-500">{action.evidence.map((item) => <div key={item.label}><dt className="inline font-semibold">{item.label}: </dt><dd className="inline break-all">{item.value}</dd></div>)}</dl>
            <div className="flex flex-wrap gap-3"><ActionButton disabled={busy || !data.queue.available} onClick={() => mutation.mutate({ kind: 'verify', sourceId: action.detailRef })}>Verify source again</ActionButton>
              <Link className="text-xs text-primary-700 hover:underline" href="/website?tab=issues">Open website audit</Link>
              <Link className="text-xs text-primary-700 hover:underline" href="/google/opportunities">Open Opportunities</Link></div>
          </div>)}</div>
        </QueryState>
      </Panel> : null}
      {data && tab === 'prospects' ? <Panel title="Observed competitor sources" subtitle="These pages link to a saved competitor. No fresh own-site link was found from their domain in the observed data. Review relevance before acting.">
        <QueryState isEmpty={!data.prospects.length} emptyTitle="No observed competitor-only sources yet" emptyBody="Import external pages linking to your saved competitors, then verify them. This comparison covers only monitored sources.">
          <Table><thead><tr><Th>Source page</Th><Th>Competitor destination</Th><Th>Your plan</Th></tr></thead><tbody>{data.prospects.map((item) => <Tr key={`${item.source.id}:${item.targetUrl}`}>
            <Td><PublicLink url={item.source.sourceUrl} /></Td><Td><PublicLink url={item.targetUrl} /></Td><Td><ProspectPlan projectId={projectId} sourceId={item.source.id} /></Td>
          </Tr>)}</tbody></Table>
        </QueryState>
        {data.limits.graphTruncated ? <p className="p-4 text-xs text-warning-700">Comparison is limited to {data.limits.graphRows} observed links.</p> : null}
      </Panel> : null}
    </QueryState>
    {historySource ? <SourceHistory key={historySource} projectId={projectId} sourceId={historySource} onClose={() => setHistorySource(null)} /> : null}
  </div>;
}

function ProspectPlan({ projectId, sourceId }: { projectId: string; sourceId: string }) {
  const client = useQueryClient();
  const [targetUrl, setTargetUrl] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const plan = useMutation({
    mutationFn: () => api.backlinks.plan(projectId, sourceId, targetUrl, reviewed),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['backlinks', projectId] }); void client.invalidateQueries({ queryKey: ['findings', projectId] }); },
  });
  return <form className="min-w-56 space-y-2" onSubmit={(event) => { event.preventDefault(); plan.mutate(); }}>
    <label className="block text-xs text-brand-600">Your business page URL<input type="url" required className={`${inputClass} mt-1`} value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} /></label>
    <label className="flex gap-2 text-xs text-brand-600"><input type="checkbox" required checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />I reviewed this source and it is relevant to this page.</label>
    <ActionButton disabled={plan.isPending || !reviewed || !targetUrl} type="submit">Check readiness and save plan</ActionButton>
    {plan.error ? <p role="alert" className="text-xs text-error-700">{plan.error.message}</p> : null}
    {plan.data?.message ? <p role="status" className="text-xs text-brand-600">{plan.data.message}</p> : null}
  </form>;
}

function SourceRow({ source, busy, available, onVerify, onHistory, onRemove }: {
  source: BacklinkSource; busy: boolean; available: boolean; onVerify: () => void; onHistory: () => void; onRemove: () => void;
}) {
  return <Tr>
    <Td className="max-w-xs"><PublicLink url={source.sourceUrl} /><p className="mt-1 text-xs text-brand-500">{source.discovery}</p></Td>
    <Td><Pill tone={source.status === 'READ' ? 'good' : source.status === 'BLOCKED' ? 'warn' : 'default'}>{source.status}</Pill>
      <p className="mt-1 text-xs text-brand-500">{date(source.lastAttemptAt)}</p>
      <p className="mt-1 max-w-xs text-xs text-brand-500">{source.observations[0]?.reason ?? 'Waiting for verification.'}</p></Td>
    <Td className="max-w-lg"><details><summary className="cursor-pointer text-sm text-primary-700">{source._count.links} destination{source._count.links === 1 ? '' : 's'}</summary>
      <div className="mt-2 space-y-3">{source.links.map((link) => <div key={link.id} className="space-y-1 text-xs">
        <PublicLink url={link.targetUrl} /><div className="flex flex-wrap gap-1"><Pill tone={link.status === 'VERIFIED' && link.fresh ? 'good' : link.status === 'LOST' ? 'bad' : 'default'}>{link.status}{link.status === 'VERIFIED' && !link.fresh ? ' · stale' : ''}</Pill><Pill>{link.targetKind}</Pill></div>
        <p className="text-brand-600">Anchor: {link.anchorText || 'No text recorded'} · Rel observed: {link.rel.join(', ') || 'none recorded'}</p>
        <p className="text-brand-500">First observed: {date(link.firstObservedAt)} · Last verified: {date(link.lastVerifiedAt)}</p>
        {link.readiness ? <p className="text-brand-600"><strong>{link.readiness.state.replace('_', ' ')}:</strong> {link.readiness.reason} · {date(link.readiness.checkedAt)}</p> : null}
      </div>)}{source._count.links > source.links.length ? <p className="text-xs text-brand-500">First {source.links.length} destinations shown. Full occurrences are available in verification history.</p> : null}</div>
    </details></Td>
    <Td><div className="flex flex-wrap gap-2"><ActionButton disabled={busy || !available} onClick={onVerify}>Verify</ActionButton><ActionButton onClick={onHistory}>History</ActionButton><ActionButton disabled={busy} onClick={onRemove}>Remove</ActionButton></div></Td>
  </Tr>;
}

function SourceHistory({ projectId, sourceId, onClose }: { projectId: string; sourceId: string; onClose: () => void }) {
  const [offset, setOffset] = useState(0);
  const history = useQuery({ queryKey: ['backlink-history', projectId, sourceId, offset], queryFn: () => api.backlinks.history(projectId, sourceId, offset) });
  return <Panel title="Verification history" actions={<ActionButton onClick={onClose}>Close history</ActionButton>} padded>
    <QueryState isLoading={history.isLoading} error={history.error} isEmpty={!history.data?.observations.length} emptyTitle="No verification attempts yet">
      <p className="mb-3 text-xs text-brand-500">{history.data?.sourceUrl}</p>
      <div className="space-y-4">{history.data?.observations.map((observation) => <div key={observation.id} className="space-y-1 border-b pb-3 text-xs text-brand-600">
        <p><Pill>{observation.outcome}</Pill> {date(observation.checkedAt)} · HTTP {observation.statusCode ?? 'not obtained'}</p>
        <p>{observation.reason}</p>{observation.finalUrl ? <p>Final URL: <PublicLink url={observation.finalUrl} /></p> : null}
        {observation.contentHash ? <p className="break-all font-mono text-brand-400">Evidence SHA-256: {observation.contentHash}</p> : null}
        <details><summary className="cursor-pointer text-primary-700">{observation.evidence.length} observed link occurrences</summary>
          {observation.evidence.map((link, index) => <p className="mt-1 break-all" key={`${link.targetUrl}:${index}`}>{link.targetUrl} · Anchor: {link.anchorText || '(empty)'} · Rel: {link.rel.join(', ') || '(none)'}</p>)}
        </details>
      </div>)}</div>
      <div className="mt-3 flex gap-2"><ActionButton disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 25))}>Newer</ActionButton><ActionButton disabled={(history.data?.observations.length ?? 0) < 25} onClick={() => setOffset(offset + 25)}>Older</ActionButton></div>
    </QueryState>
  </Panel>;
}
