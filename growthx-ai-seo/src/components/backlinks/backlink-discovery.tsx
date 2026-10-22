"use client";

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, Panel, Pill, StatusNote } from '@/components/ui/console';
import { api } from '@/lib/api-client';

export function BacklinkDiscoveryPanel({projectId}:{projectId:string}) {
  const client=useQueryClient();
  const [message,setMessage]=useState('');
  const status=useQuery({queryKey:['backlink-discovery',projectId],queryFn:()=>api.backlinks.discoveryStatus(projectId),
    refetchInterval:(query)=>{
      const run=query.state.data?.run;
      return run&&(['QUEUED','RUNNING'].includes(run.status)||(run.checked<run.candidates&&Date.now()-new Date(run.finishedAt??run.startedAt).getTime()<15*60000))?5000:30000;
    }});
  const run=status.data?.run;
  const active=!!run&&['QUEUED','RUNNING'].includes(run.status);
  const fingerprint=run?`${run.id}:${run.status}:${run.checked}:${run.verified}`:'';
  const previous=useRef('');
  useEffect(()=>{
    if(!fingerprint||previous.current===fingerprint) return;
    previous.current=fingerprint;
    for(const key of ['backlinks','backlink-profile','backlink-explorer','backlink-changes']) void client.invalidateQueries({queryKey:[key,projectId]});
  },[fingerprint,client,projectId]);
  const start=useMutation({mutationFn:()=>api.backlinks.startDiscovery(projectId),onSuccess:async(result)=>{
    setMessage(result.message);await client.invalidateQueries({queryKey:['backlink-discovery',projectId]});
  }});
  return <Panel title="Discover backlinks" subtitle="Find referring-page candidates for this project and saved competitors, then verify their links automatically."
    actions={<ActionButton variant="primary" disabled={start.isPending||active||!status.data?.available} onClick={()=>start.mutate()}>{active?'Discovery running…':'Discover backlinks'}</ActionButton>} padded>
    <p className="text-sm text-brand-600">{status.data?.coverage??'Search public link records and your website footprint. No paid backlink data provider is required.'}</p>
    {status.error||start.error?<div role="alert" className="mt-3"><StatusNote tone="bad">{(start.error??status.error)?.message}</StatusNote></div>:null}
    {status.data&&!status.data.available?<div className="mt-3"><StatusNote tone="bad">Discovery worker is unavailable. Saved backlink evidence remains accessible.</StatusNote></div>:null}
    {message?<div role="status" className="mt-3"><StatusNote>{message}</StatusNote></div>:null}
    {run?<div className="mt-4 space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2"><Pill>{run.status}</Pill><span className="text-sm text-brand-950">{run.stage}</span></div>
      <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
        <div><dt className="text-brand-500">Candidate pages</dt><dd className="font-semibold text-brand-950">{run.candidates}</dd></div>
        <div><dt className="text-brand-500">New sources saved</dt><dd className="font-semibold text-brand-950">{run.added}</dd></div>
        <div><dt className="text-brand-500">Pages checked or reused</dt><dd className="font-semibold text-brand-950">{run.checked}</dd></div>
        <div><dt className="text-brand-500">Verified own-site links</dt><dd data-testid="discovery-verified" className="font-semibold text-brand-950">{run.verified}</dd></div>
      </dl>
      {run.error?<StatusNote tone="bad">{run.error}</StatusNote>:null}
      {run.finishedAt&&run.candidates===0?<StatusNote>No candidate pages were found within this run’s coverage. This does not mean your website has no backlinks. Import a Search Console Links export to add known referring pages.</StatusNote>:null}
      <details className="text-xs text-brand-600"><summary className="cursor-pointer">Discovery sources and coverage</summary>
        <ul className="mt-2 space-y-2">{run.details.map((detail,index)=><li key={`${detail.provider}:${index}`}><strong>{detail.provider}</strong>: {detail.status} · {detail.candidates} candidates. {detail.reason}</li>)}</ul>
      </details>
    </div>:<p className="mt-3 text-sm text-brand-950">Start discovery to build this website’s observed backlink profile. An empty profile is not evidence that no backlinks exist.</p>}
    {status.data?<p className="mt-3 text-xs text-brand-500">Public archive index: {status.data.index.edges.toLocaleString()} link records from {status.data.index.pages.toLocaleString()} HTML pages. {status.data.index.note} {status.data.index.lastIndexedAt?`Last indexed ${new Date(status.data.index.lastIndexedAt).toLocaleString()}.`:''}</p>:null}
  </Panel>;
}
