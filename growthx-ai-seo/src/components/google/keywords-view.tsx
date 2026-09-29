"use client";
import { useState } from "react";
import { Panel } from "@/components/ui/console";
import { NoDataState } from "@/components/ui/truthful-state";
import { Caveat, Chip, EmptyNote, Gate, SearchRowsTable } from "@/components/google/view-kit";
import { useGscCtrOpportunities, useGscDeclining, useGscQueries, useGscStriking } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import { count, percent, position } from "@/lib/google-format";

type Tab = "top" | "page2" | "ctr" | "declining";
const TABS: { id: Tab; label: string; about: string }[] = [
  { id: "top", label: "Top keywords", about: "Your queries with the most clicks in the period." },
  { id: "page2", label: "Page-2 opportunities", about: "Queries ranking just off page one, where a small lift can win clicks." },
  { id: "ctr", label: "Low CTR", about: "Queries that get fewer clicks than a page at that position normally would." },
  { id: "declining", label: "Declining", about: "Queries whose position got worse against the previous period." },
];

/** The queries that bring people from Google, and the ones worth working on. */
export function KeywordsView() {
  const { projectId } = useWorkspace();
  const [tab, setTab] = useState<Tab>("top");
  const top = useGscQueries(projectId, 100);
  const striking = useGscStriking(projectId);
  const ctr = useGscCtrOpportunities(projectId);
  const declining = useGscDeclining(projectId);
  const current = TABS.find((t) => t.id === tab)!;

  const empty = (
    <NoDataState
      compact
      title="No keywords for this period"
      missing="Search Console has no queries stored for this workspace and range."
      whyItMatters="Keywords come only from Search Console."
      actionRequired="Try a longer range, or use Refresh data above."
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Keyword lists">
        {TABS.map((t) => (
          <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</Chip>
        ))}
      </div>
      <Panel title={current.label} subtitle={current.about}>
        {tab === "top" && (
          <Gate query={top.query} what="keywords">
            {(rows) => (rows.length === 0 ? empty : <SearchRowsTable rows={[...rows].sort((a, b) => b.clicks - a.clicks)} label="Query" />)}
          </Gate>
        )}
        {tab === "page2" && (
          <Gate query={striking.query} what="page-2 opportunities">
            {(rows) =>
              rows.length === 0 ? (
                <EmptyNote>No queries are currently in striking distance.</EmptyNote>
              ) : (
                <>
                  <SearchRowsTable rows={rows} label="Query" />
                  <Caveat>
                    Selected by position {rows[0].criteria.minPosition}–{rows[0].criteria.maxPosition} with at least {count(rows[0].criteria.minImpressions)} impressions in the last {rows[0].criteria.days} days.
                  </Caveat>
                </>
              )
            }
          </Gate>
        )}
        {tab === "ctr" && (
          <Gate query={ctr.query} what="low CTR queries">
            {(rows) =>
              rows.length === 0 ? (
                <EmptyNote>No query is well below the CTR expected for its position.</EmptyNote>
              ) : (
                <>
                  <SearchRowsTable
                    rows={rows}
                    label="Query"
                    extra={[
                      { header: "Expected CTR", cell: (r) => percent((r as (typeof rows)[number]).expectedCtr) },
                      { header: "Missed clicks", cell: (r) => count((r as (typeof rows)[number]).estimatedMissedClicks) },
                    ]}
                  />
                  <Caveat>Missed clicks are an estimate from typical CTR by position, not a measured figure.</Caveat>
                </>
              )
            }
          </Gate>
        )}
        {tab === "declining" && (
          <Gate query={declining.query} what="declining keywords">
            {(rows) =>
              rows.length === 0 ? (
                <EmptyNote>No query lost ground against the previous period, or there is not enough stored history to compare.</EmptyNote>
              ) : (
                <SearchRowsTable
                  rows={rows.map((r) => ({ key: r.query, clicks: r.currentClicks, impressions: r.impressions, ctr: r.impressions > 0 ? r.currentClicks / r.impressions : 0, position: r.currentPosition }))}
                  label="Query"
                  extra={[{ header: "Position before", cell: (r) => position(rows.find((x) => x.query === r.key)?.previousPosition) }]}
                />
              )
            }
          </Gate>
        )}
        <Caveat>New and rising keywords, and cannibalization (two pages competing for one query), need per-query history and a query-by-page breakdown that are not stored yet, so they are not shown.</Caveat>
      </Panel>
    </div>
  );
}
