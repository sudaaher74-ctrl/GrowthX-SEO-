"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { CrawlJob, CrawlPage, CrawlHistoryPoint } from "@/lib/api-client";
import { ActionButton, Kpi, Panel, Table, Th, Tr, Td } from "@/components/ui/console";

type Metric = "lcpMs" | "inpMs" | "clsScore";
const metrics: Record<Metric,{label:string;unit:string;scale:number}> = {
  lcpMs:{label:"LCP",unit:"s",scale:1000}, inpMs:{label:"INP",unit:"ms",scale:1}, clsScore:{label:"CLS",unit:"",scale:1},
};
const measured = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const average = (values: unknown[]) => {const valid=values.filter(measured);return valid.length?valid.reduce((sum,n)=>sum+n,0)/valid.length:null;};
const display = (value: number|null|undefined, scale=1, digits=1) => measured(value)?(value/scale).toFixed(digits):"—";

export function PerformanceTab({pages,historyRuns=[]}: {crawl:CrawlJob|null;pages:CrawlPage[];historyRuns?:CrawlHistoryPoint[]}) {
  const [metric,setMetric]=useState<Metric>("lcpMs");
  const [search,setSearch]=useState("");
  const [showAll,setShowAll]=useState(false);
  const values = useMemo(()=>({
    score:average(pages.map(p=>p.performance?.performanceScore)),
    lcp:average(pages.map(p=>p.performance?.lcpMs)),
    inp:average(pages.map(p=>p.performance?.inpMs)),
    cls:average(pages.map(p=>p.performance?.clsScore)),
    count:pages.filter(p=>p.performance && [p.performance.performanceScore,p.performance.lcpMs,p.performance.inpMs,p.performance.clsScore].some(measured)).length,
  }),[pages]);
  const definition=metrics[metric];
  const points=useMemo(()=>historyRuns.filter(r=>r.finishedAt && measured(r.performance?.[metric])).map(r=>({
    id:r.id,date:new Date(r.finishedAt!).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),
    value:r.performance![metric]!/metrics[metric].scale,
  })),[historyRuns,metric]);
  const filtered=useMemo(()=>pages.filter(p=>`${p.url} ${p.title??""}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(b.responseTimeMs??0)-(a.responseTimeMs??0)),[pages,search]);
  return <div className="space-y-5">
    <Panel padded title="Speed measurements" subtitle={`${values.count} of ${pages.length} audited URLs have recorded performance measurements.`}>
      <p className="text-sm leading-6 text-brand-600">LCP and CLS come from PageSpeed’s Lighthouse lab test. INP uses PageSpeed’s real-user field data when available. Crawl fetch duration is shown separately and is not a Core Web Vital.</p>
      {!values.count && <div role="status" className="mt-3 rounded-lg border p-3 text-sm text-brand-600"><strong className="text-brand-950">Speed measurements unavailable for this audit.</strong> Google PageSpeed has not returned usable measurements. No speed score or Core Web Vital is estimated from crawl timings. A future successful measurement will populate these cards.</div>}
    </Panel>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Performance score" value={values.score==null?"—":String(Math.round(values.score))} sub={values.score==null?"No PageSpeed score recorded":"Measured Lighthouse score / 100"}/>
      <Kpi label="LCP" value={values.lcp==null?"—":`${display(values.lcp,1000)}s`} sub={values.lcp==null?"No LCP measurement recorded":"Lab measurement · Good ≤ 2.5s"}/>
      <Kpi label="INP" value={values.inp==null?"—":`${display(values.inp,1,0)}ms`} sub={values.inp==null?"No real-user INP data recorded":"Field measurement · Good ≤ 200ms"}/>
      <Kpi label="CLS" value={display(values.cls,1,3)} sub={values.cls==null?"No CLS measurement recorded":"Lab measurement · Good ≤ 0.1"}/>
    </div>
    <Panel title="Core Web Vitals Trend" subtitle="Recorded measurements from completed audits. Missing measurements are not plotted." padded>
      <label className="mb-4 flex flex-wrap items-center gap-3 text-xs text-brand-600">Metric
        <select aria-label="Trend metric" value={metric} onChange={e=>setMetric(e.target.value as Metric)} className="rounded-lg border bg-white px-3 py-2 text-sm text-brand-950">{Object.entries(metrics).map(([key,m])=><option key={key} value={key}>{m.label}{m.unit?` (${m.unit})`:""}</option>)}</select>
        <span>{points.length} measured audit{points.length===1?"":"s"}</span>
      </label>
      {!points.length?<div className="py-10 text-center text-sm text-brand-500">No recorded {definition.label} history yet. A trend appears after successful speed measurements are saved.</div>:<>
        {points.length===1 && <p className="mb-3 text-xs text-brand-500">One measured audit is available. At least two are needed to show change over time.</p>}
        <div className="h-60 min-w-0" role="img" aria-label={`${definition.label} recorded audit measurements`}><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{top:12,right:20,bottom:8,left:0}}><CartesianGrid stroke="var(--color-brand-100)" strokeDasharray="3 3"/><XAxis dataKey="date" tick={{fontSize:10}}/><YAxis unit={definition.unit} tick={{fontSize:10}} domain={[0,"auto"]}/><Tooltip/><Line dataKey="value" name={`${definition.label}${definition.unit?` (${definition.unit})`:""}`} stroke="var(--color-primary-600)" strokeWidth={2} dot={{r:4}} connectNulls={false}/></LineChart></ResponsiveContainer></div>
        <details className="mt-3 text-xs text-brand-600"><summary className="cursor-pointer">View recorded values</summary><ul className="mt-2 space-y-1">{points.map(p=><li key={p.id}>{p.date}: {p.value.toFixed(metric==="clsScore"?3:1)}{definition.unit}</li>)}</ul></details>
      </>}
    </Panel>
    <Panel title="Audited URL timings" subtitle="Sorted by recorded crawl fetch duration. These timings include crawler processing and do not measure page rendering speed." padded>
      <label className="mb-4 block text-xs text-brand-600">Search audited URLs<input aria-label="Search speed URLs" value={search} onChange={e=>{setSearch(e.target.value);setShowAll(false);}} className="mt-2 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-brand-950"/></label>
      <Table minWidth={650}><thead><tr><Th>URL</Th><Th>LCP</Th><Th>INP</Th><Th>CLS</Th><Th>Crawl fetch duration</Th></tr></thead><tbody>{(showAll?filtered:filtered.slice(0,10)).map(p=><Tr key={p.id}><Td><a href={p.url} target="_blank" rel="noreferrer" className="break-all text-primary-700">{p.url}</a></Td><Td>{measured(p.performance?.lcpMs)?`${display(p.performance!.lcpMs,1000)}s`:"—"}</Td><Td>{measured(p.performance?.inpMs)?`${display(p.performance!.inpMs,1,0)}ms`:"—"}</Td><Td>{display(p.performance?.clsScore,1,3)}</Td><Td>{measured(p.responseTimeMs)?`${display(p.responseTimeMs,1000)}s`:"—"}</Td></Tr>)}</tbody></Table>
      {!filtered.length && <p className="py-6 text-center text-sm text-brand-500">No matching audited URLs.</p>}
      {filtered.length>10 && <ActionButton className="mt-4" onClick={()=>setShowAll(!showAll)}>{showAll?"Show fewer URLs":`Show all ${filtered.length} URLs`}</ActionButton>}
    </Panel>
  </div>;
}