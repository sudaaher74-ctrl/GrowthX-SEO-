"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { ActionButton, Mono, Panel, Pill, StatusNote, Table, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import type { GapRow } from "@/lib/search-intelligence";
import { ErrorNote, pathOf } from "./shared";

/**
 * Only offered where the platform has a source of competitor rankings, so it
 * has no not-connected state of its own: the page leaves the tab out instead.
 */
export function KeywordGapsTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const gaps = useQuery({
    queryKey: ["si-gaps", projectId],
    queryFn: () => api.searchIntelligence.keywordGaps(projectId),
  });

  const fetchGaps = useMutation({
    mutationFn: (force: boolean) => api.searchIntelligence.refreshKeywordGaps(projectId, { force }),
    onSuccess: (data) => queryClient.setQueryData(["si-gaps", projectId], data),
  });
  const track = useMutation({
    mutationFn: (keyword: string) => api.searchIntelligence.track(projectId, [keyword], "COMPETITOR_GAP"),
    onSuccess: (_r, keyword) => {
      setTracked((s) => new Set(s).add(keyword.toLowerCase()));
      queryClient.invalidateQueries({ queryKey: ["si-rankings", projectId] });
    },
  });

  const data = gaps.data;
  const neverFetched = (data?.competitors ?? []).every((c) => !c.fetchedAt);

  const trackButton = (keyword: string) =>
    tracked.has(keyword.toLowerCase()) ? (
      <Pill tone="good">tracking</Pill>
    ) : (
      <button
        type="button"
        onClick={() => track.mutate(keyword)}
        className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium text-brand-600 hover:bg-brand-100"
      >
        <Plus size={11} /> Track
      </button>
    );

  return (
    <div className="space-y-4">
      <Panel
        title="Keywords your competitors win and you don't"
        subtitle={`From Google's rankings in ${data?.market.country ?? "your market"}, checked against your own Search Console so nothing you already appear for is listed.`}
        actions={
          <div className="flex gap-2">
            <ActionButton variant="primary" icon={<RefreshCw size={12} className={fetchGaps.isPending ? "animate-spin" : undefined} />} onClick={() => fetchGaps.mutate(false)} disabled={fetchGaps.isPending}>
              {fetchGaps.isPending ? "Reading Google rankings…" : neverFetched ? "Find keyword gaps" : "Update"}
            </ActionButton>
            {!neverFetched && (
              <ActionButton onClick={() => fetchGaps.mutate(true)} disabled={fetchGaps.isPending} title="Fetches again even if last week's data is stored. Each fetch is paid.">
                Fetch again
              </ActionButton>
            )}
          </div>
        }
        padded
      >
        <p className="text-[12px] text-brand-600">
          Results from the last 7 days are reused so you are not charged twice. &ldquo;Missing&rdquo; means you are not in Google&apos;s top 100; &ldquo;behind&rdquo; means they are on page one and you are below 20.
        </p>
        {fetchGaps.error && <div className="mt-2"><ErrorNote message={errorMessage(fetchGaps.error)} /></div>}
        {fetchGaps.data && (
          <div className="mt-2">
            <StatusNote>
              {fetchGaps.data.fetched ? `Read ${fetchGaps.data.fetched} competitor(s) from Google rankings.` : "Nothing new to fetch: this week's results are already here."}
            </StatusNote>
          </div>
        )}
        {track.error && <div className="mt-2"><ErrorNote message={errorMessage(track.error)} /></div>}
      </Panel>

      <QueryState
        isLoading={gaps.isLoading}
        error={gaps.error}
        isEmpty={(data?.competitors.length ?? 0) === 0}
        emptyTitle="No competitors added yet"
        emptyBody="Add competitors in Competitor Intelligence first, then find the keywords they win."
      >
        {(data?.shared.length ?? 0) > 0 && (
          <Panel title="Searches several competitors win and you are missing" subtitle="The clearest gaps: more than one rival ranks, you do not">
            <Table minWidth={680}>
              <thead>
                <tr>
                  <Th>Search</Th>
                  <Th align="right">Monthly searches</Th>
                  <Th>Who ranks</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {data!.shared.map((g) => (
                  <Tr key={g.keyword}>
                    <Td><span className="text-[12.5px] font-medium text-brand-950">{g.keyword}</span></Td>
                    <Td align="right"><Mono>{g.searchVolume?.toLocaleString() ?? "—"}</Mono></Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {g.competitors.map((c) => <Pill key={c.domain}>{c.domain} #{c.position}</Pill>)}
                      </div>
                    </Td>
                    <Td align="right">{trackButton(g.keyword)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        )}

        {data?.competitors.map((c) => (
          <Panel
            key={c.domain}
            title={c.label ? `${c.label} (${c.domain})` : c.domain}
            subtitle={
              c.fetchedAt
                ? `${c.missing} missing, ${c.behind} behind, from ${c.competitorKeywordsRead} of their keywords · ${relativeTime(c.fetchedAt)}`
                : "Not fetched yet"
            }
          >
            {c.error ? (
              <div className="p-4"><ErrorNote message={c.error} /></div>
            ) : c.rows.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-brand-500">
                {c.fetchedAt ? "No gaps: you rank for every keyword of theirs that was read." : "Press “Find keyword gaps” to read their rankings."}
              </p>
            ) : (
              <GapTable rows={c.rows} trackButton={trackButton} />
            )}
          </Panel>
        ))}
      </QueryState>
    </div>
  );
}

function GapTable({ rows, trackButton }: { rows: GapRow[]; trackButton: (keyword: string) => React.ReactNode }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 25);
  return (
    <>
      <Table minWidth={760}>
        <thead>
          <tr>
            <Th>Search</Th>
            <Th align="right">Monthly searches</Th>
            <Th align="right">Them</Th>
            <Th align="right">You</Th>
            <Th>Their page</Th>
            <Th> </Th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <Tr key={r.keyword}>
              <Td>
                <span className="text-[12.5px] font-medium text-brand-950">{r.keyword}</span>
                {r.intent && <span className="ml-2 text-[10.5px] text-brand-400">{r.intent}</span>}
              </Td>
              <Td align="right"><Mono>{r.searchVolume?.toLocaleString() ?? "—"}</Mono></Td>
              <Td align="right"><Mono>#{r.competitorPosition}</Mono></Td>
              <Td align="right">
                {r.ownPosition === null ? <Pill tone="bad">missing</Pill> : <Pill tone="warn">#{r.ownPosition}</Pill>}
              </Td>
              <Td>
                {r.competitorUrl ? (
                  <a href={r.competitorUrl} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-brand-600 hover:underline">
                    {pathOf(r.competitorUrl)}
                  </a>
                ) : (
                  "—"
                )}
              </Td>
              <Td align="right">{trackButton(r.keyword)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {rows.length > 25 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t py-2 text-[11.5px] font-medium text-primary-700 hover:bg-brand-50">
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}
