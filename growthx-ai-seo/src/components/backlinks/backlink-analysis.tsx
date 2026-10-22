"use client";

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ActionButton, Kpi, Panel, Pill, StatusNote, Table, Td, Th, Tr } from '@/components/ui/console';
import { QueryState } from '@/components/ui/query-state';
import { api } from '@/lib/api-client';
import type { BacklinkFilters, BacklinkProfile } from '@/lib/backlink-analysis';

const input = 'rounded-lg border bg-white px-2 py-1.5 text-xs text-brand-950 focus:outline-primary-600';
const when = (value: string | null) => value ? new Date(value).toLocaleString() : 'Not measured';

function Url({ value }: { value: string }) {
  return /^https?:\/\//i.test(value) ? <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-primary-700 hover:underline">{value}</a> : <span className="break-all">{value}</span>;
}

const VIEWS = [
  ['overview', 'Overview'], ['explorer', 'Backlinks'], ['domains', 'Referring domains'], ['anchors', 'Anchors'],
  ['pages', 'Top linked pages'], ['intersect', 'Link intersect'], ['changes', 'New / lost / changed'],
] as const;
type View = typeof VIEWS[number][0];

export function BacklinkAnalysis({ projectId, onAddSources, refreshing }: { projectId: string; onAddSources: () => void; refreshing: boolean }) {
  const [view, setView] = useState<View>('overview');
  const [days, setDays] = useState(30);
  const profile = useQuery({ queryKey: ['backlink-profile', projectId, days, refreshing], queryFn: () => api.backlinks.profile(projectId, days), staleTime: 0,
    enabled: view !== 'explorer' && view !== 'changes', refetchInterval: refreshing ? 15000 : false });
  const data = profile.data;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Backlink analysis reports" className="flex flex-wrap gap-2">{VIEWS.map(([id, label]) => <ActionButton key={id} aria-pressed={view === id} variant={view === id ? 'primary' : 'secondary'} onClick={() => setView(id)}>{label}</ActionButton>)}</nav>
      <label className="text-xs text-brand-600">Trend window <select aria-label="Backlink trend window" className={input} value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>
    </div>
    {view === 'explorer' ? <BacklinkExplorer projectId={projectId} refreshing={refreshing} /> : view === 'changes' ? <Changes projectId={projectId} refreshing={refreshing} /> : <QueryState isLoading={profile.isLoading} error={profile.error}>
      {data ? <>
        <p className="text-xs text-brand-500">{data.coverage} Measured {when(data.measuredAt)}.</p>
        {view === 'overview' ? <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Verified backlinks" value={String(data.counts.verified)} sub="Own site · verified within seven days" />
            <Kpi label="Referring domains" value={String(data.counts.referringDomains)} sub="Registrable domains, including private suffixes" />
            <Kpi label="First observed" value={String(data.counts.newlyObserved)} sub={`Seen by GrowthX in the last ${days} UTC days`} />
            <Kpi label="Confirmed losses" value={String(data.counts.confirmedLost)} sub="Awaiting verified recovery; blocks do not erase a confirmed loss" />
          </div>
          {!data.counts.observed ? <QueryState isEmpty emptyTitle="Build your backlink profile" emptyBody="Add referring pages or import a Search Console Links export. GrowthX will discover and verify the exact destinations." emptyAction={<ActionButton onClick={onAddSources}>Add sources</ActionButton>} /> : null}
          <Trend profile={data} />
          <Panel title="Follow and qualification profile" subtitle="Counts are source/destination pairs. Mixed means the page contains both followed and qualified occurrences." padded>
            <div className="grid grid-cols-2 gap-4 text-sm text-brand-700">{([
              ['Followed', data.counts.followed], ['Qualified: nofollow / sponsored / UGC / page-level nofollow', data.counts.qualified], ['Mixed occurrences', data.counts.mixed], ['Not classified — verify again', data.counts.unclassified],
            ] as const).map(([label, value]) => <div key={label}><span className="font-mono font-semibold">{value}</span> <span>{label}</span></div>)}</div>
          </Panel>
          <Panel title="Data quality" padded><p className="text-sm text-brand-600">{data.counts.observed} own-site source/destination pairs have been observed across the retained dataset. {data.counts.tracked - data.counts.observed} submitted candidates have never been verified.</p><p className="mt-2 text-xs text-brand-500">{data.authority.reason}</p></Panel>
        </> : null}
        {view === 'domains' ? <Panel title="Referring domains" subtitle="Ranked by fresh verified own-site links. Several subdomains can belong to one registrable domain.">
          <QueryState isEmpty={!data.referringDomains.length} emptyTitle="No verified referring domains yet"><Table><thead><tr><Th>Domain</Th><Th>Backlinks</Th><Th>Source pages</Th><Th>With followed occurrence</Th><Th>First / last verified</Th></tr></thead><tbody>{data.referringDomains.map((row) => <Tr key={row.domain}><Td>{row.domain}</Td><Td>{row.links}</Td><Td>{row.sourcePages}</Td><Td>{row.followed}</Td><Td>{when(row.firstObservedAt)}<br />{when(row.lastVerifiedAt)}</Td></Tr>)}</tbody></Table></QueryState>
        </Panel> : null}
        {view === 'anchors' ? <Panel title="Anchor profile" subtitle="One representative anchor per source/destination pair. Full occurrence-level anchors remain in source verification history.">
          <QueryState isEmpty={!data.anchors.length} emptyTitle="No verified anchors yet"><Table><thead><tr><Th>Anchor</Th><Th>Backlinks</Th><Th>Share of fresh links</Th><Th>Referring domains</Th></tr></thead><tbody>{data.anchors.map((row) => <Tr key={row.anchor}><Td>{row.anchor || '(empty / image without alt)'}</Td><Td>{row.links}</Td><Td>{(row.share * 100).toFixed(1)}%</Td><Td>{row.referringDomains}</Td></Tr>)}</tbody></Table></QueryState>
        </Panel> : null}
        {view === 'pages' ? <Panel title="Top linked pages" subtitle="Ranked by fresh referring-domain count, then backlink count. Review destination health before building more links.">
          <QueryState isEmpty={!data.topPages.length} emptyTitle="No verified linked pages yet"><Table><thead><tr><Th>Destination</Th><Th>Referring domains</Th><Th>Backlinks</Th><Th>With followed occurrence</Th><Th>Destination readiness</Th></tr></thead><tbody>{data.topPages.map((row) => <Tr key={row.targetUrl}><Td><Url value={row.targetUrl} /></Td><Td>{row.referringDomains}</Td><Td>{row.links}</Td><Td>{row.followed}</Td><Td><Pill tone={row.readiness.state === 'READY' ? 'good' : row.readiness.state === 'NEEDS_FIX' ? 'bad' : 'default'}>{row.readiness.state}</Pill><p className="mt-1 max-w-xs text-xs text-brand-500">{row.readiness.reason}</p></Td></Tr>)}</tbody></Table></QueryState>
        </Panel> : null}
        {view === 'intersect' ? <Intersection profile={data} /> : null}
        {view !== 'overview' && view !== 'intersect' ? <p className="text-xs text-brand-500">Top {data.limits.tableRows} groups shown. Counts are computed over the full observed project dataset, not just this table.</p> : null}
      </> : null}
    </QueryState>}
  </div>;
}

function Trend({ profile }: { profile: BacklinkProfile }) {
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(1, ...profile.timeline.map((day) => day.found + day.lost + day.recovered + day.changed));
  const active = profile.timeline.find((day) => day.date === selected);
  const series = [['found', 'First observed', 'bg-success-600'], ['lost', 'Confirmed lost', 'bg-error-600'], ['recovered', 'Recovered', 'bg-primary-600'], ['changed', 'Attributes changed', 'bg-warning-500']] as const;
  return <Panel title="New, lost and recovered links" subtitle="UTC days. First observed is when GrowthX saw a link, not when it was created." padded>
    <div className="mb-3 flex flex-wrap gap-3 text-xs text-brand-600">{series.map(([key, label, color]) => <span className="flex items-center gap-1" key={key}><span className={`h-2 w-2 rounded-sm ${color}`} />{label}</span>)}</div>
    <div className="overflow-x-auto"><div className="flex h-36 items-end gap-1 border-b" style={{ minWidth: profile.days * 9 }}>
      {profile.timeline.map((day) => <button key={day.date} onClick={() => setSelected(day.date)} aria-label={`${day.date}: ${day.found} first observed, ${day.lost} lost, ${day.recovered} recovered, ${day.changed} changed`} aria-pressed={selected === day.date} className="flex h-full min-w-2 flex-1 flex-col justify-end rounded-t-sm focus:outline-primary-600">
        {series.map(([key, , color]) => day[key] ? <span key={key} className={`block w-full ${color}`} style={{ height: `${day[key] / max * 100}%` }} /> : null)}
      </button>)}
    </div></div>
    <div className="mt-2 flex justify-between text-xs text-brand-400"><span>{profile.timeline[0]?.date}</span><span>{profile.timeline[profile.timeline.length - 1]?.date}</span></div>
    <p role="status" className="mt-2 text-xs text-brand-600">{active ? `${active.date}: ${active.found} first observed · ${active.lost} lost · ${active.recovered} recovered · ${active.changed} changed` : 'Select a day to inspect its observed changes.'}</p>
    {profile.historyLimited ? <p className="mt-2 text-xs text-warning-700">Some source event history was pruned by retention limits. Historical loss/recovery totals cover retained events.</p> : null}
  </Panel>;
}

function Intersection({ profile }: { profile: BacklinkProfile }) {
  const [mode, setMode] = useState('missing');
  const [minimum, setMinimum] = useState(1);
  const rows = profile.intersection.filter((row) => row.competitorsCount >= minimum && (mode === 'all' || (mode === 'missing' ? row.ownLinks === 0 : row.ownLinks > 0)));
  return <Panel title="Competitor link intersection" subtitle="Observed referring domains linking to saved competitors. A missing own-site link means none was freshly verified in this dataset." padded>
    {profile.intersectionLimited ? <StatusNote tone="bad">The comparison exceeded 50,000 source/domain groups. No missing-link conclusions are shown from an incomplete comparison.</StatusNote> : null}
    <div className="mb-4 flex flex-wrap gap-3"><label className="text-xs text-brand-600">Comparison <select aria-label="Link intersection mode" className={input} value={mode} onChange={(event) => setMode(event.target.value)}><option value="missing">Missing from our observed profile</option><option value="shared">Shared with competitors</option><option value="all">All observed competitor sources</option></select></label>
      <label className="text-xs text-brand-600">At least <input aria-label="Minimum competitors" className={`${input} w-16`} type="number" min={1} max={Math.max(1, profile.competitors.length)} value={minimum} onChange={(event) => setMinimum(Math.max(1, Number(event.target.value)))} /> competitors</label></div>
    <QueryState isEmpty={!rows.length} emptyTitle="No matching observed link intersections" emptyBody="Add your competitors and verify their external referring pages to build a comparison. This does not imply they have no other backlinks.">
      <Table><thead><tr><Th>Referring domain</Th><Th>Your links</Th><Th>Competitors linked</Th><Th>Observed competitor links</Th></tr></thead><tbody>{rows.slice(0, 100).map((row) => <Tr key={row.domain}><Td>{row.domain}</Td><Td>{row.ownLinks}</Td><Td>{row.competitorsCount}</Td><Td>{Object.entries(row.competitors).map(([domain, count]) => <p key={domain} className="text-xs text-brand-600">{domain}: {count}</p>)}</Td></Tr>)}</tbody></Table>
    </QueryState><p className="mt-3 text-xs text-brand-500">{rows.length} matching observed domains; first 100 shown. Review relevance in Link prospects before saving an action.</p>
  </Panel>;
}

function BacklinkExplorer({ projectId, refreshing }: { projectId: string; refreshing: boolean }) {
  const [filters, setFilters] = useState<BacklinkFilters>({ targetKind: 'OWN', status: 'VERIFIED', freshness: 'FRESH', sort: 'newest', offset: 0 });
  const [search, setSearch] = useState('');
  const [exportNote, setExportNote] = useState('');
  const links = useQuery({ queryKey: ['backlink-explorer', projectId, filters, refreshing], queryFn: () => api.backlinks.explore(projectId, filters), staleTime: 0, refetchInterval: refreshing ? 10000 : false });
  const exportRows = useMutation({ mutationFn: () => api.backlinks.export(projectId, filters), onSuccess: (data) => {
    const url = URL.createObjectURL(new Blob([data.csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = data.filename; anchor.click(); URL.revokeObjectURL(url);
    setExportNote(`Exported ${data.exported} of ${data.total} matching rows.${data.truncated ? ' Export capped at 10,000 rows; narrow your filters for the remaining data.' : ''} ${data.coverage}`);
  } });
  const update = (key: keyof BacklinkFilters, value: string) => setFilters((previous) => ({ ...previous, [key]: value, offset: 0, ...(key === 'status' && value !== 'VERIFIED' ? { freshness: 'ALL' } : {}) }));
  const selects = [
    ['targetKind', 'Destinations', [['OWN', 'Our website'], ['COMPETITOR', 'Competitors'], ['ALL', 'All tracked sites']]],
    ['status', 'Status', ['ALL', 'VERIFIED', 'LOST', 'MISSING', 'UNKNOWN', 'BLOCKED', 'UNVERIFIED'].map((value) => [value, value])],
    ['followState', 'Follow state', [['ALL', 'All follow states'], ['FOLLOWED', 'Followed'], ['QUALIFIED', 'Qualified: nofollow / sponsored / UGC'], ['MIXED', 'Mixed occurrences'], ['UNKNOWN', 'Not classified']]],
    ['linkType', 'Link type', ['ALL', 'TEXT', 'IMAGE', 'OTHER'].map((value) => [value, value])],
    ['placement', 'Placement', ['ALL', 'CONTENT', 'NAVIGATION', 'FOOTER', 'SIDEBAR', 'UNKNOWN'].map((value) => [value, value])],
    ['freshness', 'Freshness', [['ALL', 'Any verification age'], ['FRESH', 'Verified within seven days'], ['STALE', 'Last verified over seven days ago']]],
    ['sort', 'Sort', [['newest', 'Newest observed'], ['oldest', 'Oldest observed'], ['changed', 'Last changed'], ['verified', 'Last verified']]],
  ] as const;
  return <Panel title="Backlink explorer" subtitle="Filter exact source/destination pairs. Unverified candidates and stale observations are explicitly labelled." actions={<ActionButton disabled={exportRows.isPending} onClick={() => exportRows.mutate()}>Export filtered CSV</ActionButton>}>
    <div className="space-y-3 border-b p-4"><div className="flex flex-wrap gap-3">{selects.map(([key, label, options]) => <label className="text-xs text-brand-600" key={key}>{label}<select aria-label={`Backlink ${label.toLowerCase()}`} className={`${input} ml-1`} value={String(filters[key as keyof BacklinkFilters] ?? 'ALL')} onChange={(event) => update(key as keyof BacklinkFilters, event.target.value)}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}</div>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); update('search', search); }}><input aria-label="Search backlink source, destination or anchor" placeholder="Search source, destination or anchor" className={`${input} min-w-56 flex-1`} value={search} onChange={(event) => setSearch(event.target.value)} maxLength={200} /><ActionButton type="submit">Apply search</ActionButton></form>
      {exportNote ? <div role="status"><StatusNote>{exportNote}</StatusNote></div> : null}{exportRows.error ? <StatusNote tone="bad">{exportRows.error.message}</StatusNote> : null}
    </div>
    <QueryState isLoading={links.isLoading} error={links.error} isEmpty={!links.data?.links.length} emptyTitle="No backlinks match these filters" emptyBody="Try another status or freshness setting, or add and verify more referring pages.">
      <Table minWidth={1100}><thead><tr><Th>Source / referring domain</Th><Th>Destination / anchor</Th><Th>Status / follow</Th><Th>Type / placement</Th><Th>First observed / last verified</Th><Th>Destination readiness</Th></tr></thead><tbody>{links.data?.links.map((link) => <Tr key={link.id}>
        <Td className="max-w-xs"><Url value={link.source.sourceUrl} /><p className="mt-1 text-xs text-brand-500">{link.referringDomain}</p></Td><Td className="max-w-xs"><Url value={link.targetUrl} /><p className="mt-1 text-xs text-brand-600">{link.anchorText || '(empty anchor)'} · {link.targetKind}</p></Td>
        <Td><Pill tone={link.status === 'VERIFIED' && link.fresh ? 'good' : link.status === 'LOST' ? 'bad' : 'default'}>{link.status}{link.status === 'VERIFIED' && !link.fresh ? ' · stale' : ''}</Pill><p className="mt-1 text-xs text-brand-600">{link.followState}</p><p className="text-xs text-brand-400">{link.rel.join(', ') || 'No rel recorded'}</p></Td>
        <Td className="text-xs text-brand-600">{link.linkTypes.join(', ') || 'Not measured'}<br />{link.placements.join(', ') || 'Not measured'}</Td><Td className="text-xs text-brand-500">{when(link.firstObservedAt)}<br />{when(link.lastVerifiedAt)}</Td><Td className="max-w-xs text-xs text-brand-600">{link.readiness?.reason ?? 'Competitor destination · not audited as your website'}</Td>
      </Tr>)}</tbody></Table>
      <Pagination offset={links.data?.offset ?? 0} total={links.data?.total ?? 0} pageSize={50} onChange={(offset) => setFilters((previous) => ({ ...previous, offset }))} />
    </QueryState>
  </Panel>;
}

function Changes({ projectId, refreshing }: { projectId: string; refreshing: boolean }) {
  const [offset, setOffset] = useState(0);
  const changes = useQuery({ queryKey: ['backlink-changes', projectId, offset, refreshing], queryFn: () => api.backlinks.changes(projectId, offset), staleTime: 0, refetchInterval: refreshing ? 10000 : false });
  return <Panel title="Observed backlink changes" subtitle="First discovery, confirmed loss, recovery, and attribute changes. Blocked requests never manufacture a loss event.">
    <QueryState isLoading={changes.isLoading} error={changes.error} isEmpty={!changes.data?.events.length} emptyTitle="No retained backlink changes yet" emptyBody="Events are recorded as sources are verified. No history is invented for dates before observation.">
      <Table><thead><tr><Th>Observed at</Th><Th>Change</Th><Th>Source</Th><Th>Destination / evidence</Th></tr></thead><tbody>{changes.data?.events.map((event) => <Tr key={event.id}><Td>{when(event.occurredAt)}</Td><Td><Pill tone={event.kind === 'LOST' ? 'bad' : event.kind === 'FOUND' || event.kind === 'RECOVERED' ? 'good' : 'default'}>{event.kind}</Pill></Td><Td className="max-w-xs"><Url value={event.backlink.source.sourceUrl} /></Td><Td className="max-w-md"><Url value={event.backlink.targetUrl} /><details className="mt-1 text-xs text-brand-600"><summary className="cursor-pointer">Before / after evidence</summary><pre className="mt-1 max-w-xs overflow-auto whitespace-pre-wrap break-all">{JSON.stringify({ before: event.before, after: event.after }, null, 2)}</pre></details></Td></Tr>)}</tbody></Table>
      <Pagination offset={offset} total={changes.data?.total ?? 0} pageSize={50} onChange={setOffset} />
    </QueryState>
  </Panel>;
}

function Pagination({ offset, total, pageSize, onChange }: { offset: number; total: number; pageSize: number; onChange: (offset: number) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs text-brand-500"><span>{total ? offset + 1 : 0}–{Math.min(offset + pageSize, total)} of {total}</span><div className="flex gap-2"><ActionButton disabled={!offset} onClick={() => onChange(Math.max(0, offset - pageSize))}>Previous</ActionButton><ActionButton disabled={offset + pageSize >= total} onClick={() => onChange(offset + pageSize)}>Next</ActionButton></div></div>;
}
