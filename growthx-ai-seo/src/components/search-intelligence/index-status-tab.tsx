"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import { ActionButton, Kpi, Mono, Panel, Pill, StatusNote, Table, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import type { IndexStatusReport } from "@/lib/search-intelligence";
import { ErrorNote, SearchConsoleNeeded, pathOf } from "./shared";

export function IndexStatusTab({ projectId, searchConsoleConnected }: { projectId: string; searchConsoleConnected: boolean }) {
  const queryClient = useQueryClient();
  const report = useQuery({
    queryKey: ["si-index", projectId],
    queryFn: () => api.searchIntelligence.indexStatus(projectId),
    enabled: searchConsoleConnected,
  });
  const inspect = useMutation({
    mutationFn: () => api.searchIntelligence.inspect(projectId, { limit: 100 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["si-index", projectId] }),
  });

  if (!searchConsoleConnected) {
    return <SearchConsoleNeeded what="Whether Google has indexed each page is something only Google can say. It is read from Search Console's URL Inspection." />;
  }

  const r = report.data;
  const quotaLeft = r?.quota ? r.quota.perDay - r.quota.usedToday : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="In Google" value={String(r?.totals.indexed ?? 0)} sub={`of ${r?.totals.asked ?? 0} pages checked`} tone="good" />
        <Kpi label="Not in Google" value={String(r?.totals.notIndexed ?? 0)} sub="checked and not indexed" tone={(r?.totals.notIndexed ?? 0) > 0 ? "danger" : "default"} />
        <Kpi label="Not checked yet" value={String(r?.totals.notYetAsked ?? 0)} sub="crawled pages" />
        <Kpi label="Checks left today" value={quotaLeft === null ? "—" : quotaLeft.toLocaleString()} sub="Google allows 2,000 a day" />
      </div>

      <Panel
        title="Ask Google about your pages"
        subtitle={`Checks up to 100 pages at a time, oldest answer first. Last checked ${relativeTime(r?.lastInspectedAt)}. Rechecked every Sunday.`}
        actions={
          <ActionButton variant="primary" icon={<RefreshCw size={12} className={inspect.isPending ? "animate-spin" : undefined} />} onClick={() => inspect.mutate()} disabled={inspect.isPending}>
            {inspect.isPending ? "Asking Google…" : "Check pages with Google"}
          </ActionButton>
        }
        padded
      >
        <p className="text-[12px] text-brand-600">Each page is checked one by one, so 100 pages take a minute or two.</p>
        {inspect.error && <div className="mt-2"><ErrorNote message={errorMessage(inspect.error)} /></div>}
        {inspect.data && (
          <div className="mt-2">
            <StatusNote tone={inspect.data.failed ? "bad" : "good"}>
              Checked {inspect.data.inspected} page(s){inspect.data.failed ? `, ${inspect.data.failed} could not be checked` : ""}. {inspect.data.note ?? ""}
            </StatusNote>
          </div>
        )}
      </Panel>

      <QueryState
        isLoading={report.isLoading}
        error={report.error}
        isEmpty={(r?.totals.asked ?? 0) === 0}
        emptyTitle="No pages checked with Google yet"
        emptyBody="Press “Check pages with Google” to find out which of your pages Google has indexed."
      >
        {r && <Report r={r} />}
      </QueryState>
    </div>
  );
}

function Report({ r }: { r: IndexStatusReport }) {
  const [open, setOpen] = useState<string | null>(null);
  const sets: Array<[string, number, string]> = [
    ["Found on your site", r.urlSets.discovered, "every address the crawl came across"],
    ["Listed in your sitemap", r.urlSets.inSitemap, "what you tell Google to index"],
    ["Opened fine", r.urlSets.crawled, "answered without an error"],
    ["Allowed in search", r.urlSets.indexableByOurCheck, "no noindex, no canonical elsewhere"],
    ["Indexed by Google", r.urlSets.indexedByGoogle, "of the pages checked"],
    ["Shown in Google search", r.urlSets.seenInGoogleSearchLast28Days, "had impressions in 28 days"],
  ];

  return (
    <>
      <Panel title="Your site, counted six ways" subtitle="The gaps between these numbers are the pages to look at">
        <div className="grid grid-cols-2 gap-px bg-brand-100 sm:grid-cols-3 lg:grid-cols-6">
          {sets.map(([label, n, hint]) => (
            <div key={label} className="bg-white p-3">
              <p className="font-mono text-[20px] font-bold text-brand-950">{n.toLocaleString()}</p>
              <p className="text-[11.5px] font-medium text-brand-700">{label}</p>
              <p className="text-[10.5px] text-brand-400">{hint}</p>
            </div>
          ))}
        </div>
      </Panel>

      {r.indexableButNotIndexed.length > 0 && (
        <Panel title="Pages that could be in Google but are not" subtitle="Our crawl found nothing blocking them; Google still left them out">
          <Table minWidth={720}>
            <thead>
              <tr>
                <Th>Page</Th>
                <Th>Google says</Th>
                <Th>What to do</Th>
              </tr>
            </thead>
            <tbody>
              {r.indexableButNotIndexed.map((p) => (
                <Tr key={p.url}>
                  <Td><Mono>{pathOf(p.url)}</Mono></Td>
                  <Td>
                    <span className="block text-[12px] font-medium text-brand-950">{p.coverageState ?? "—"}</span>
                    <span className="text-[11px] text-brand-500">{p.meaning}</span>
                  </Td>
                  <Td><span className="text-[11.5px] text-brand-600">{p.action ?? "—"}</span></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      {r.canonicalOverridden.length > 0 && (
        <Panel title="Google picked a different main version" subtitle="Your page names one address as the main version; Google chose another">
          <Table minWidth={720}>
            <thead>
              <tr>
                <Th>Page</Th>
                <Th>You say</Th>
                <Th>Google chose</Th>
              </tr>
            </thead>
            <tbody>
              {r.canonicalOverridden.map((c) => (
                <Tr key={c.url}>
                  <Td><Mono>{pathOf(c.url)}</Mono></Td>
                  <Td><Mono tone="soft">{c.declared ? pathOf(c.declared) : "—"}</Mono></Td>
                  <Td><Mono tone="bad">{c.googleChose ? pathOf(c.googleChose) : "—"}</Mono></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      <Panel title="What Google says about each group of pages" subtitle="Click a row to see the pages">
        <Table minWidth={720}>
          <thead>
            <tr>
              <Th>Status</Th>
              <Th align="right">Pages</Th>
              <Th>What it means</Th>
            </tr>
          </thead>
          <tbody>
            {r.groups.map((g) => (
              <Tr key={g.coverageState} className="cursor-pointer" onClick={() => setOpen(open === g.coverageState ? null : g.coverageState)}>
                <Td>
                  <Pill tone={g.verdict === "PASS" ? "good" : g.verdict === "FAIL" ? "bad" : "warn"}>{g.verdict === "PASS" ? "in Google" : "not in Google"}</Pill>
                  <span className="ml-2 text-[12px] font-medium text-brand-950">{g.coverageState}</span>
                  {open === g.coverageState && (
                    <ul className="mt-2 space-y-0.5">
                      {g.urls.map((u) => <li key={u} className="font-mono text-[10.5px] text-brand-500">{pathOf(u)}</li>)}
                      {g.count > g.urls.length && <li className="text-[10.5px] text-brand-400">and {g.count - g.urls.length} more</li>}
                    </ul>
                  )}
                </Td>
                <Td align="right"><Mono>{g.count}</Mono></Td>
                <Td>
                  <span className="block text-[11.5px] text-brand-700">{g.meaning}</span>
                  {g.action && <span className="text-[11px] text-brand-500">{g.action}</span>}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <Panel title="Every page checked">
        <Table minWidth={820}>
          <thead>
            <tr>
              <Th>Page</Th>
              <Th>Google</Th>
              <Th>Google last read it</Th>
              <Th>Our crawl</Th>
              <Th align="right">Checked</Th>
            </tr>
          </thead>
          <tbody>
            {r.pages.map((p) => (
              <Tr key={p.url}>
                <Td>
                  <Mono>{pathOf(p.url)}</Mono>
                  {p.inspectionLink && (
                    <a href={p.inspectionLink} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex text-brand-400 hover:text-primary-700" title="Open in Search Console">
                      <ExternalLink size={11} />
                    </a>
                  )}
                </Td>
                <Td>
                  {p.error ? (
                    <span className="text-[11px] text-error-600">Could not check: {p.error}</span>
                  ) : (
                    <Pill tone={p.verdict === "PASS" ? "good" : "warn"}>{p.coverageState ?? p.verdict ?? "—"}</Pill>
                  )}
                </Td>
                <Td><Mono tone="soft">{p.lastCrawlTime ? relativeTime(p.lastCrawlTime) : "never"}</Mono></Td>
                <Td><span className="text-[11px] text-brand-500">{p.ourCrawl ? `${p.ourCrawl.statusCode} · ${p.ourCrawl.indexability.toLowerCase().replace(/_/g, " ")}` : "not in last crawl"}</span></Td>
                <Td align="right"><Mono tone="soft">{relativeTime(p.inspectedAt)}</Mono></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
