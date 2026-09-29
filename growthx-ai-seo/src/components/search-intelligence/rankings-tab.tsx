"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { ActionButton, Kpi, Mono, Panel, Pill, StatusNote, Table, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { NoDataState } from "@/components/ui/truthful-state";
import { usePeriodDays } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { positionMove, positionText, type Overtake, type SearchRankingRow } from "@/lib/search-intelligence";
import { AnalyticsNudge, ErrorNote, GoogleConnectGate, SearchConsoleNeeded, inputClass, pathOf, shortDate } from "./shared";

/** What a click on "Diagnose" in a row carries to the diagnosis tab. */
export interface DiagnoseSeed {
  keyword: string;
  pageUrl: string | null;
}

export function RankingsTab({
  projectId,
  searchConsoleConnected,
  analyticsConnected,
  liveResults,
  onDiagnose,
}: {
  projectId: string;
  searchConsoleConnected: boolean;
  analyticsConnected: boolean;
  /** The platform can also look at Google's live results, which adds tracked keywords and competitors. */
  liveResults: boolean;
  onDiagnose: (seed: DiagnoseSeed) => void;
}) {
  if (!searchConsoleConnected && !liveResults) return <GoogleConnectGate analyticsConnected={analyticsConnected} />;

  return (
    <div className="space-y-8">
      {searchConsoleConnected ? (
        <SearchConsoleRankings projectId={projectId} analyticsConnected={analyticsConnected} onDiagnose={onDiagnose} />
      ) : (
        <SearchConsoleNeeded what="Where Google shows your website for each search comes from Search Console." />
      )}
      {liveResults && (
        <section className="space-y-4">
          <div>
            <h2 className="text-[13px] font-semibold text-brand-950">Live tracking and competitors</h2>
            <p className="text-[11.5px] text-brand-500">Keywords checked in Google&apos;s results as they are now, and where competitors stand beside you.</p>
          </div>
          <LiveTracking projectId={projectId} />
        </section>
      )}
    </div>
  );
}

// ── From Search Console ─────────────────────────────────────────────────────

type Band = "all" | "top3" | "four-ten" | "eleven-twenty" | "beyond";

const BANDS: Array<{ id: Band; label: string; holds: (position: number) => boolean }> = [
  { id: "all", label: "All", holds: () => true },
  { id: "top3", label: "Top 3", holds: (p) => p <= 3 },
  { id: "four-ten", label: "4–10", holds: (p) => p > 3 && p <= 10 },
  { id: "eleven-twenty", label: "11–20", holds: (p) => p > 10 && p <= 20 },
  { id: "beyond", label: "21+", holds: (p) => p > 20 },
];

/** Searches listed at first; the rest are a click away, so a large site does not open on a wall of rows. */
const PAGE_SIZE = 25;

/** A position as Search Console shows it: an average, so one decimal. */
const averagePosition = (position: number) => position.toFixed(1);

function SearchConsoleRankings({
  projectId,
  analyticsConnected,
  onDiagnose,
}: {
  projectId: string;
  analyticsConnected: boolean;
  onDiagnose: (seed: DiagnoseSeed) => void;
}) {
  const queryClient = useQueryClient();
  const days = usePeriodDays();
  const [band, setBand] = useState<Band>("all");
  const [shown, setShown] = useState(PAGE_SIZE);

  const report = useQuery({
    queryKey: ["si-search-rankings", projectId, days],
    queryFn: () => api.searchIntelligence.searchRankings(projectId, days),
  });
  const fetchNow = useMutation({
    mutationFn: () => api.gscSync(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["si-search-rankings", projectId] });
      queryClient.invalidateQueries({ queryKey: ["si-status", projectId] });
    },
  });

  const data = report.data;
  if (report.isLoading || report.error) return <QueryState isLoading={report.isLoading} error={report.error} />;
  if (data && !data.connected) {
    return <SearchConsoleNeeded what="Where Google shows your website for each search comes from Search Console." />;
  }
  if (data && !data.hasData) {
    return (
      <div className="space-y-2">
        <NoDataState
          title="No search data has been fetched yet"
          missing="Search Console is connected, but nothing has been read from it yet."
          whyItMatters="The first fetch reads the last 90 days of searches and positions. After that it refreshes on its own every day."
          actionRequired="Fetch your search data now."
          action={{ label: fetchNow.isPending ? "Fetching…" : "Fetch now", onClick: () => fetchNow.mutate(), variant: "primary" }}
        />
        {fetchNow.error && <ErrorNote message={errorMessage(fetchNow.error)} />}
      </div>
    );
  }
  if (!data || !data.summary) return null;

  const { summary } = data;
  const wanted = BANDS.find((b) => b.id === band) ?? BANDS[0];
  const inBand = data.rows.filter((row) => wanted.holds(row.position));
  const rows = inBand.slice(0, shown);
  const compared = data.comparisonRange !== null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Searches you appear for" value={summary.searches.toLocaleString()} sub={`last ${days} days`} />
        <Kpi
          label="On page one"
          value={(summary.top3 + summary.pageOne).toLocaleString()}
          sub={`${summary.top3.toLocaleString()} in the top 3`}
          tone={summary.top3 + summary.pageOne > 0 ? "good" : "default"}
        />
        <Kpi
          label="Moved up"
          value={compared ? summary.movedUp.toLocaleString() : "—"}
          sub={compared ? `against the ${days} days before` : "no earlier data to compare"}
          tone={summary.movedUp > 0 ? "good" : "default"}
        />
        <Kpi
          label="Moved down"
          value={compared ? summary.movedDown.toLocaleString() : "—"}
          sub={compared ? `against the ${days} days before` : "no earlier data to compare"}
          tone={summary.movedDown > 0 ? "danger" : "default"}
        />
      </div>

      <Panel
        title="Where Google shows you"
        subtitle={
          data.range
            ? `The ${days} days to ${shortDate(data.range.end)}, from your Search Console. Positions are averages over the period, not a reading taken now. A move is shown only for searches shown at least 20 times in both periods.`
            : undefined
        }
        actions={
          <div className="flex flex-wrap gap-1" role="group" aria-label="Show searches by position">
            {BANDS.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={band === b.id}
                onClick={() => {
                  setBand(b.id);
                  setShown(PAGE_SIZE);
                }}
                className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium ${
                  band === b.id ? "border-primary-500 bg-primary-50 text-primary-700" : "bg-white text-brand-600 hover:bg-brand-50"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        }
      >
        <QueryState
          isEmpty={inBand.length === 0}
          emptyTitle="No searches in this range"
          emptyBody="None of the searches Google showed you for fall in this range of positions."
        >
          <Table minWidth={analyticsConnected ? 940 : 820}>
            <thead>
              <tr>
                <Th>Search</Th>
                <Th align="right">Position</Th>
                <Th align="right">Clicks</Th>
                <Th align="right">Shown</Th>
                <Th align="right">CTR</Th>
                <Th>Page Google shows</Th>
                {analyticsConnected && <Th align="right">Page visits</Th>}
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <RankingRow key={row.query} row={row} analyticsConnected={analyticsConnected} onDiagnose={onDiagnose} />
              ))}
            </tbody>
          </Table>
        </QueryState>
        {inBand.length > rows.length && (
          <div className="flex justify-center border-t p-3">
            <ActionButton onClick={() => setShown((n) => n + PAGE_SIZE)}>
              Show {Math.min(PAGE_SIZE, inBand.length - rows.length)} more
            </ActionButton>
          </div>
        )}
        <div className="space-y-1 border-t px-4 py-2.5">
          {summary.searches > data.rows.length && (
            <p className="text-[11px] text-brand-500">
              The {data.rows.length.toLocaleString()} searches with the most clicks, of {summary.searches.toLocaleString()}.
            </p>
          )}
          {!analyticsConnected && <AnalyticsNudge what="See the visits and conversions each page gets." />}
          {analyticsConnected && !data.analyticsHasData && (
            <p className="text-[11px] text-brand-500">Google Analytics 4 is connected but has no page data yet, so visits are blank.</p>
          )}
          {analyticsConnected && data.analyticsHasData && (
            <p className="text-[11px] text-brand-500">Visits are every visit that started on that page in Google Analytics 4, from any source.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function RankingRow({
  row,
  analyticsConnected,
  onDiagnose,
}: {
  row: SearchRankingRow;
  analyticsConnected: boolean;
  onDiagnose: (seed: DiagnoseSeed) => void;
}) {
  const moved = row.movement !== null && Math.abs(row.movement) >= 1 ? row.movement : null;
  return (
    <Tr>
      <Td>
        <span className="text-[12.5px] font-medium text-brand-950">{row.query}</span>
      </Td>
      <Td align="right">
        <span className="inline-flex items-center gap-1">
          <Mono tone={row.position <= 10 ? "good" : undefined}>{averagePosition(row.position)}</Mono>
          {moved !== null && (
            <span
              title={`Was ${averagePosition(row.previousPosition ?? row.position)} in the period before`}
              className={`inline-flex items-center font-mono text-[10.5px] ${moved > 0 ? "text-success-600" : "text-error-600"}`}
            >
              {moved > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
              {Math.abs(moved).toFixed(1)}
            </span>
          )}
        </span>
      </Td>
      <Td align="right"><Mono>{row.clicks.toLocaleString()}</Mono></Td>
      <Td align="right"><Mono tone="soft">{row.impressions.toLocaleString()}</Mono></Td>
      <Td align="right"><Mono tone="soft">{(row.ctr * 100).toFixed(1)}%</Mono></Td>
      <Td><Mono tone="soft">{row.page ? pathOf(row.page) : "—"}</Mono></Td>
      {analyticsConnected && (
        <Td align="right">
          {row.visits ? (
            <span title={row.visits.conversions === null ? undefined : `${row.visits.conversions.toLocaleString()} conversions`}>
              <Mono>{row.visits.sessions.toLocaleString()}</Mono>
            </span>
          ) : (
            <Mono tone="soft">—</Mono>
          )}
        </Td>
      )}
      <Td align="right">
        <button
          type="button"
          onClick={() => onDiagnose({ keyword: row.query, pageUrl: row.page })}
          className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium text-brand-600 hover:bg-brand-100"
        >
          <Search size={11} /> Diagnose
        </button>
      </Td>
    </Tr>
  );
}

// ── Live tracking (a paid source the platform may provide) ──────────────────

function LiveTracking({ projectId }: { projectId: string }) {
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
