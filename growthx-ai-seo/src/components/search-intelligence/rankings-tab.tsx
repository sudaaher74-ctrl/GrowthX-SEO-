"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, RefreshCw, Trash2 } from "lucide-react";
import { ActionButton, Kpi, Mono, Panel, Pill, StatusNote, Table, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { positionMove, positionText, type Overtake } from "@/lib/search-intelligence";
import { ErrorNote, GoogleResultsNotConnected, inputClass, pathOf } from "./shared";

export function RankingsTab({ projectId, connected }: { projectId: string; connected: boolean }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const rankings = useQuery({
    queryKey: ["si-rankings", projectId],
    queryFn: () => api.searchIntelligence.rankings(projectId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["si-rankings", projectId] });

  const add = useMutation({
    mutationFn: () =>
      api.searchIntelligence.track(
        projectId,
        draft.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean),
      ),
    onSuccess: () => {
      setDraft("");
      refresh();
    },
  });
  const check = useMutation({ mutationFn: () => api.searchIntelligence.checkRankings(projectId), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api.searchIntelligence.untrack(projectId, id), onSuccess: refresh });

  if (!connected) return <GoogleResultsNotConnected />;

  const data = rankings.data;
  const ranked = data?.keywords.filter((k) => k.position !== null) ?? [];
  const top10 = ranked.filter((k) => k.position !== null && k.position <= 10).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Keywords tracked" value={String(data?.keywords.length ?? 0)} sub={`up to ${data?.limit ?? "—"}`} />
        <Kpi label="In Google's top 10" value={String(top10)} sub={`of ${data?.keywords.length ?? 0}`} tone={top10 > 0 ? "good" : "default"} />
        <Kpi label="Overtaken by a competitor" value={String(data?.overtakenBy.length ?? 0)} sub="since the previous check" tone={(data?.overtakenBy.length ?? 0) > 0 ? "danger" : "default"} />
        <Kpi label="You overtook a competitor" value={String(data?.youOvertook.length ?? 0)} sub="since the previous check" tone={(data?.youOvertook.length ?? 0) > 0 ? "good" : "default"} />
      </div>

      <Panel
        title="Track keywords"
        subtitle={`Checked in Google ${data?.market.country ?? ""} every Monday, or now. Positions are only ever what Google showed at each check.`}
        actions={
          <ActionButton icon={<RefreshCw size={12} className={check.isPending ? "animate-spin" : undefined} />} onClick={() => check.mutate()} disabled={check.isPending}>
            {check.isPending ? "Checking Google…" : "Check all now"}
          </ActionButton>
        }
        padded
      >
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) add.mutate();
          }}
        >
          <input
            className={`${inputClass} min-w-[240px] flex-1`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="a2 milk pune, cow milk delivery, organic ghee"
          />
          <ActionButton type="submit" variant="primary" icon={<Plus size={12} />} disabled={add.isPending || !draft.trim()}>
            Track
          </ActionButton>
        </form>
        {(data?.keywords.length ?? 0) === 0 && (
          <p className="mt-2 text-[11.5px] text-brand-500">
            Nothing tracked yet. &ldquo;Check all now&rdquo; starts with the searches your site already appears for in Search Console.
          </p>
        )}
        {add.error && <div className="mt-2"><ErrorNote message={errorMessage(add.error)} /></div>}
        {check.error && <div className="mt-2"><ErrorNote message={errorMessage(check.error)} /></div>}
        {check.data && (
          <div className="mt-2">
            <StatusNote tone={check.data.failed.length ? "bad" : "good"}>
              Checked {check.data.checked} keyword(s) in Google.{check.data.failed.length > 0 && ` ${check.data.failed.length} could not be checked: ${check.data.failed[0]}`}
            </StatusNote>
          </div>
        )}
      </Panel>

      {(data?.overtakenBy.length ?? 0) > 0 && <OvertakeTable title="Competitors that moved above you" rows={data!.overtakenBy} bad />}
      {(data?.youOvertook.length ?? 0) > 0 && <OvertakeTable title="Where you moved above a competitor" rows={data!.youOvertook} />}

      <QueryState isLoading={rankings.isLoading} error={rankings.error} isEmpty={(data?.keywords.length ?? 0) === 0} emptyTitle="No keywords tracked yet">
        <Panel title="Positions in Google" subtitle="Your best-ranking page for each search, and where tracked competitors stand">
          <Table minWidth={860}>
            <thead>
              <tr>
                <Th>Search</Th>
                <Th align="right">You</Th>
                <Th>Your page</Th>
                <Th>Competitors</Th>
                <Th align="right">Checked</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {data?.keywords.map((k) => {
                const move = k.previousCheckedAt ? positionMove(k.previousPosition, k.position) : null;
                return (
                  <Tr key={k.id}>
                    <Td>
                      <span className="text-[12.5px] font-medium text-brand-950">{k.keyword}</span>
                      {k.source !== "USER" && <span className="ml-2"><Pill>{k.source === "SEARCH_CONSOLE" ? "from Search Console" : "competitor gap"}</Pill></span>}
                    </Td>
                    <Td align="right">
                      <span className="inline-flex items-center gap-1">
                        <Mono tone={k.position !== null && k.position <= 10 ? "good" : k.position === null && k.lastCheckedAt ? "bad" : undefined}>
                          {k.lastCheckedAt ? positionText(k.position) : "not checked"}
                        </Mono>
                        {move !== null && move !== 0 && (
                          <span className={`inline-flex items-center font-mono text-[10.5px] ${move > 0 ? "text-success-600" : "text-error-600"}`}>
                            {move > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                            {Math.abs(move)}
                          </span>
                        )}
                      </span>
                    </Td>
                    <Td><Mono tone="soft">{k.url ? pathOf(k.url) : "—"}</Mono></Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(k.competitors).length === 0 && <span className="text-[11px] text-brand-400">{k.lastCheckedAt ? "none in top 20" : "—"}</span>}
                        {Object.entries(k.competitors)
                          .sort((a, b) => a[1].position - b[1].position)
                          .map(([domain, p]) => (
                            <Pill key={domain} tone={k.position === null || p.position < k.position ? "bad" : "default"}>
                              {domain} #{p.position}
                            </Pill>
                          ))}
                      </div>
                    </Td>
                    <Td align="right"><Mono tone="soft">{relativeTime(k.lastCheckedAt)}</Mono></Td>
                    <Td align="right">
                      <button type="button" title="Stop tracking" onClick={() => remove.mutate(k.id)} className="rounded p-1 text-brand-400 hover:bg-brand-100 hover:text-error-600">
                        <Trash2 size={13} />
                      </button>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>
      </QueryState>
    </div>
  );
}

function OvertakeTable({ title, rows, bad = false }: { title: string; rows: Overtake[]; bad?: boolean }) {
  return (
    <Panel title={title} subtitle="Between the last two checks of each keyword">
      <Table minWidth={720}>
        <thead>
          <tr>
            <Th>Search</Th>
            <Th>Competitor</Th>
            <Th>Before</Th>
            <Th>Now</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <Tr key={`${o.keyword}-${o.competitor}`}>
              <Td><span className="text-[12.5px] font-medium text-brand-950">{o.keyword}</span></Td>
              <Td>
                <span className="text-[12px] text-brand-700">{o.competitor}</span>
                {o.competitorUrl && <span className="block font-mono text-[10.5px] text-brand-400">{pathOf(o.competitorUrl)}</span>}
              </Td>
              <Td>
                <span className="text-[11.5px] text-brand-600">
                  you {positionText(o.before.own)}, them {positionText(o.before.competitor)}
                </span>
                <span className="block text-[10.5px] text-brand-400">{relativeTime(o.before.checkedAt)}</span>
              </Td>
              <Td>
                <span className={`text-[11.5px] font-semibold ${bad ? "text-error-600" : "text-success-600"}`}>
                  you {positionText(o.now.own)}, them {positionText(o.now.competitor)}
                </span>
                <span className="block text-[10.5px] text-brand-400">{relativeTime(o.now.checkedAt)}</span>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}
