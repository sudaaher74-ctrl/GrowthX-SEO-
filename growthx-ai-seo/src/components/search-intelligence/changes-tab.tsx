"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShieldAlert, TrendingUp } from "lucide-react";
import { ActionButton, Mono, Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { CHANGE_KINDS, type ChangeImpact, type ChangeKind, type ChangeRiskReport, type ImpactVerdict } from "@/lib/search-intelligence";
import { ErrorNote, Field, ReasonCard, SearchConsoleNeeded, inputClass, pathOf, shortDate } from "./shared";

const VERDICT: Record<ImpactVerdict, { label: string; tone: "good" | "bad" | "default" | "warn" }> = {
  IMPROVED: { label: "Improved", tone: "good" },
  DECLINED: { label: "Declined", tone: "bad" },
  NO_CLEAR_CHANGE: { label: "No clear change", tone: "default" },
  TOO_EARLY: { label: "Too early", tone: "warn" },
  TOO_LITTLE_DATA: { label: "Too little data", tone: "warn" },
};

const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${n}%`);

// ── Did my changes help? ──────────────────────────────────────────────────

export function ChangeResultsTab({ projectId, searchConsoleConnected }: { projectId: string; searchConsoleConnected: boolean }) {
  const [url, setUrl] = useState("");
  const [date, setDate] = useState("");
  const ledger = useQuery({
    queryKey: ["si-changes", projectId],
    queryFn: () => api.searchIntelligence.changes(projectId),
    enabled: searchConsoleConnected,
  });
  const measure = useMutation({
    mutationFn: (v: { url: string; date: string }) => api.searchIntelligence.changeImpact(projectId, v.url, new Date(v.date).toISOString()),
  });

  if (!searchConsoleConnected) {
    return <SearchConsoleNeeded what="Clicks, impressions and positions before and after a change come from Search Console." />;
  }

  return (
    <div className="space-y-4">
      <Panel title="Measure any change" subtitle="Your page's Google numbers in the weeks before and after, read against your whole site over the same days" padded>
        <form
          className="grid gap-3 md:grid-cols-[1.4fr_0.6fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim() && date) measure.mutate({ url: url.trim(), date });
          }}
        >
          <Field label="Page you changed">
            <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yoursite.com/a2-milk" />
          </Field>
          <Field label="Date it went live">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
          </Field>
          <ActionButton type="submit" variant="primary" icon={<TrendingUp size={12} />} disabled={measure.isPending || !url.trim() || !date}>
            {measure.isPending ? "Measuring…" : "Measure"}
          </ActionButton>
        </form>
        {measure.error && <div className="mt-2"><ErrorNote message={errorMessage(measure.error)} /></div>}
      </Panel>

      {measure.data && <ImpactView impact={measure.data} />}

      <QueryState
        isLoading={ledger.isLoading}
        error={ledger.error}
        isEmpty={(ledger.data?.changes.length ?? 0) === 0}
        emptyTitle="No changes recorded yet"
        emptyBody="Fixes shipped through GrowthX and published content changes appear here with their results. Measure anything else above."
      >
        <Panel title="Changes GrowthX knows about" subtitle="Click one to see the full before and after">
          <Table minWidth={860}>
            <thead>
              <tr>
                <Th>Change</Th>
                <Th>Page</Th>
                <Th>Live since</Th>
                <Th>Result</Th>
                <Th align="right">Clicks a day</Th>
                <Th align="right">Position</Th>
              </tr>
            </thead>
            <tbody>
              {ledger.data?.changes.map((c) => {
                const v = c.impact.verdict ? VERDICT[c.impact.verdict] : null;
                return (
                  <Tr
                    key={`${c.kind}-${c.id}`}
                    className={c.liveSince ? "cursor-pointer" : undefined}
                    onClick={() => c.liveSince && measure.mutate({ url: c.url, date: c.liveSince })}
                  >
                    <Td>
                      <span className="text-[12.5px] font-medium text-brand-950">{c.what}</span>
                      <span className="ml-2"><Pill>{c.kind === "FIX" ? "fix" : "content"}</Pill></span>
                    </Td>
                    <Td><Mono tone="soft">{pathOf(c.url)}</Mono></Td>
                    <Td><Mono tone="soft">{c.liveSince ? shortDate(c.liveSince) : "not live yet"}</Mono></Td>
                    <Td>{v ? <Pill tone={v.tone}>{v.label}</Pill> : <span className="text-[11px] text-brand-400">{c.impact.message}</span>}</Td>
                    <Td align="right">
                      <Mono>{c.impact.perDay ? `${c.impact.perDay.clicks.before} → ${c.impact.perDay.clicks.after}` : "—"}</Mono>
                    </Td>
                    <Td align="right">
                      <Mono tone={(c.impact.positionGain ?? 0) > 0 ? "good" : (c.impact.positionGain ?? 0) < 0 ? "bad" : undefined}>
                        {c.impact.positionGain == null ? "—" : `${c.impact.positionGain > 0 ? "+" : ""}${c.impact.positionGain}`}
                      </Mono>
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

function ImpactView({ impact }: { impact: ChangeImpact }) {
  if (impact.status !== "MEASURED" || !impact.page || !impact.site) {
    return <ErrorNote message={impact.message ?? "This change could not be measured."} />;
  }
  const v = VERDICT[impact.verdict!];
  const b = impact.page.before;
  const a = impact.page.after;
  return (
    <Panel
      title={`Before and after ${shortDate(impact.changedAt)}`}
      subtitle={`${pathOf(impact.url)} · ${b.from} to ${b.to} against ${a.from} to ${a.to}`}
      actions={<Pill tone={v.tone}>{v.label}</Pill>}
    >
      <div className="space-y-1 px-4 pt-3">
        <p className="text-[13px] font-medium text-brand-950">{impact.verdictText}</p>
        {impact.readout?.map((line) => <p key={line} className="text-[12px] text-brand-600">{line}</p>)}
      </div>
      <Table minWidth={620}>
        <thead>
          <tr>
            <Th> </Th>
            <Th align="right">Before</Th>
            <Th align="right">After</Th>
            <Th align="right">Change</Th>
            <Th align="right">Whole site</Th>
          </tr>
        </thead>
        <tbody>
          <Tr>
            <Td>Clicks a day</Td>
            <Td align="right"><Mono>{impact.perDay!.clicks.before}</Mono></Td>
            <Td align="right"><Mono>{impact.perDay!.clicks.after}</Mono></Td>
            <Td align="right"><Mono>{pct(impact.perDay!.clicks.changePct)}</Mono></Td>
            <Td align="right"><Mono tone="soft">{pct(impact.siteChange?.clicksChangePct)}</Mono></Td>
          </Tr>
          <Tr>
            <Td>Times shown a day</Td>
            <Td align="right"><Mono>{impact.perDay!.impressions.before}</Mono></Td>
            <Td align="right"><Mono>{impact.perDay!.impressions.after}</Mono></Td>
            <Td align="right"><Mono>{pct(impact.perDay!.impressions.changePct)}</Mono></Td>
            <Td align="right"><Mono tone="soft">{pct(impact.siteChange?.impressionsChangePct)}</Mono></Td>
          </Tr>
          <Tr>
            <Td>Click-through rate</Td>
            <Td align="right"><Mono>{impact.ctr!.before}%</Mono></Td>
            <Td align="right"><Mono>{impact.ctr!.after}%</Mono></Td>
            <Td align="right"> </Td>
            <Td align="right"> </Td>
          </Tr>
          <Tr>
            <Td>Average position</Td>
            <Td align="right"><Mono>{b.position ?? "—"}</Mono></Td>
            <Td align="right"><Mono>{a.position ?? "—"}</Mono></Td>
            <Td align="right">
              <Mono tone={(impact.positionGain ?? 0) > 0 ? "good" : (impact.positionGain ?? 0) < 0 ? "bad" : undefined}>
                {impact.positionGain == null ? "—" : `${impact.positionGain > 0 ? "up " : impact.positionGain < 0 ? "down " : ""}${Math.abs(impact.positionGain)}`}
              </Mono>
            </Td>
            <Td align="right"> </Td>
          </Tr>
          {impact.visits && (
            <Tr>
              <Td>Visits landing here (Analytics)</Td>
              <Td align="right"><Mono>{impact.visits.before.sessions}</Mono></Td>
              <Td align="right"><Mono>{impact.visits.after.sessions}</Mono></Td>
              <Td align="right"><Mono tone="soft">{impact.visits.after.conversions} conversions after</Mono></Td>
              <Td align="right"> </Td>
            </Tr>
          )}
        </tbody>
      </Table>
      {(impact.searches?.length ?? 0) > 0 && (
        <>
          <p className="border-t px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">Searches that moved most</p>
          <Table minWidth={620}>
            <thead>
              <tr>
                <Th>Search</Th>
                <Th align="right">Clicks a day</Th>
                <Th align="right">Position</Th>
              </tr>
            </thead>
            <tbody>
              {impact.searches!.map((s) => (
                <Tr key={s.query}>
                  <Td><span className="text-[12px] text-brand-950">{s.query}</span></Td>
                  <Td align="right"><Mono>{s.clicksPerDayBefore} → {s.clicksPerDayAfter}</Mono></Td>
                  <Td align="right"><Mono>{s.positionBefore ?? "—"} → {s.positionAfter ?? "—"}</Mono></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </Panel>
  );
}

// ── Before you change a page ──────────────────────────────────────────────

export function RiskCheckTab({ projectId }: { projectId: string }) {
  const [url, setUrl] = useState("");
  const [change, setChange] = useState<ChangeKind>("REDIRECT");
  const [target, setTarget] = useState("");
  const needsTarget = CHANGE_KINDS.find((k) => k.id === change)?.needsTarget ?? false;
  const assess = useMutation({
    mutationFn: () => api.searchIntelligence.changeRisk(projectId, { url: url.trim(), change, target: needsTarget ? target.trim() : undefined }),
  });

  return (
    <div className="space-y-4">
      <Panel title="Check before you change a page" subtitle="What depends on this page today, and what the change would break" padded>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim() && (!needsTarget || target.trim())) assess.mutate();
          }}
        >
          <Field label="Page">
            <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yoursite.com/old-page" />
          </Field>
          <Field label="What you want to do">
            <select className={inputClass} value={change} onChange={(e) => setChange(e.target.value as ChangeKind)}>
              {CHANGE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </Field>
          {needsTarget && (
            <Field label={change === "URL_CHANGE" ? "New address" : "Page it should point to"}>
              <input className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="https://yoursite.com/new-page" />
            </Field>
          )}
          <div className="flex items-end">
            <ActionButton type="submit" variant="primary" icon={<ShieldAlert size={12} />} disabled={assess.isPending || !url.trim() || (needsTarget && !target.trim())}>
              {assess.isPending ? "Checking…" : "Check the risk"}
            </ActionButton>
          </div>
        </form>
        {assess.error && <div className="mt-2"><ErrorNote message={errorMessage(assess.error)} /></div>}
      </Panel>

      {assess.data && <RiskView r={assess.data} />}
    </div>
  );
}

function RiskView({ r }: { r: ChangeRiskReport }) {
  const tone = r.level === "HIGH" ? "bad" : r.level === "MEDIUM" ? "warn" : "good";
  const facts: Array<[string, string]> = [
    ["Clicks from Google, 90 days", r.affected.searchClicks90d === null ? "not connected" : r.affected.searchClicks90d.toLocaleString()],
    ["Times shown in Google, 90 days", r.affected.searchImpressions90d === null ? "not connected" : r.affected.searchImpressions90d.toLocaleString()],
    ["Visits landing here, 90 days", r.affected.visits90d === null ? "not connected" : r.affected.visits90d.toLocaleString()],
    ["Your pages linking here", String(r.affected.internalLinks)],
    ["In your sitemap", r.affected.inSitemap ? "yes" : "no"],
    ["Pages naming it as main version", String(r.affected.canonicalReferences)],
  ];
  return (
    <div className="space-y-4">
      <Panel title={`${r.changeLabel}: ${pathOf(r.url)}`} subtitle={r.target ? `to ${r.target}` : undefined} actions={<Pill tone={tone}>{r.level.toLowerCase()} risk</Pill>} padded>
        <p className="text-[13px] font-medium text-brand-950">{r.summary}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-brand-50 px-3 py-2">
              <p className="font-mono text-[15px] font-bold text-brand-950">{value}</p>
              <p className="text-[10.5px] text-brand-500">{label}</p>
            </div>
          ))}
        </div>
        {r.beforeYouDoIt.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">Before you do it</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[12px] text-brand-700">
              {r.beforeYouDoIt.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </div>
        )}
        <p className="mt-3 text-[11px] text-brand-400">Not measured: {r.notMeasured.join("; ")}.</p>
      </Panel>

      <div className="space-y-2">
        {r.risks.map((risk, i) => <ReasonCard key={`${risk.code}-${i}`} reason={risk} index={i} />)}
      </div>

      {r.affected.searches.length > 0 && (
        <Panel title="Searches that bring visitors to this page" subtitle="Search Console, last 90 days">
          <Table minWidth={560}>
            <thead>
              <tr>
                <Th>Search</Th>
                <Th align="right">Clicks</Th>
                <Th align="right">Shown</Th>
                <Th align="right">Position</Th>
              </tr>
            </thead>
            <tbody>
              {r.affected.searches.map((s) => (
                <Tr key={s.query}>
                  <Td><span className="text-[12px] text-brand-950">{s.query}</span></Td>
                  <Td align="right"><Mono>{s.clicks}</Mono></Td>
                  <Td align="right"><Mono>{s.impressions.toLocaleString()}</Mono></Td>
                  <Td align="right"><Mono>{s.position ?? "—"}</Mono></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
