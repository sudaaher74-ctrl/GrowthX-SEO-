"use client";

import React, { useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Loader2, MapPin, Search, Star, Users } from "lucide-react";
import type { GbpTabKey } from "../gbp-tabs";
import { GbpStatePanel, formatGbpTimestamp } from "../gbp-states";
import { ActionButton, Kpi, Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import { useGeoGridHistory, usePlacesCompetitors } from "@/hooks/use-growthx";
import type { LocalSeoData, PlacesCompetitor } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";

interface CompetitorsTabProps {
  localSeo: LocalSeoData | null | undefined;
  projectId: string | null;
  onSelectTab?: (tab: GbpTabKey) => void;
  /** Opens the Maps listing search, for a project with no listing attached yet. */
  onFindListing?: () => void;
}

const RADII = [2, 5, 10, 25];

/**
 * Who Google Maps shows for a search, taken from this business's own location.
 *
 * One Places Text Search — the same call each point of a geo-grid makes — so
 * it needs no Business Profile approval. Each search is a billed Places call,
 * which is why it runs on demand rather than on every visit to the tab.
 */
export function CompetitorsTab({ localSeo, projectId, onSelectTab, onFindListing }: CompetitorsTabProps) {
  const search = usePlacesCompetitors(projectId);
  const { data: history = [] } = useGeoGridHistory(projectId);

  const [keyword, setKeyword] = useState("");
  const [radiusKm, setRadiusKm] = useState(5);

  // Searches the operator already tracks on the geo-grid, most recent first.
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const keywords: string[] = [];
    for (const run of history) {
      const key = run.keyword.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keywords.push(run.keyword.trim());
      if (keywords.length === 5) break;
    }
    return keywords;
  }, [history]);

  const run = (value: string) => {
    const query = value.trim();
    if (!query) return;
    setKeyword(query);
    search.mutate({ keyword: query, radiusKm });
  };

  if (!localSeo) {
    return (
      <GbpStatePanel
        icon={MapPin}
        tone="info"
        title="Find your Google Maps listing first"
        body={
          <>
            Competitor searches are run from where your business is, so GrowthX needs your listing on Google
            Maps. Find it once and every search here, and the rank grid, starts from your storefront.
          </>
        }
        action={onFindListing ? { label: "Find my listing", onClick: onFindListing } : undefined}
      />
    );
  }

  const result = search.data;

  return (
    <div className="space-y-6">
      {/* ── Search ─────────────────────────────────────────────── */}
      <Panel
        title="Who shows up on Google Maps"
        subtitle={`Search the way a customer would. Results come from Google Maps around ${localSeo.businessName}, in Google's order.`}
        padded
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(keyword);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[11px] font-semibold text-brand-600 mb-1" htmlFor="competitor-keyword">
              Search
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                id="competitor-keyword"
                type="text"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="e.g. milk delivery Panvel"
                className="w-full h-9 pl-8 pr-3 text-xs rounded-lg border bg-white font-medium text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-brand-600 mb-1" htmlFor="competitor-radius">
              Around you
            </label>
            <select
              id="competitor-radius"
              value={radiusKm}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
              className="h-9 px-3 text-xs rounded-lg border bg-white font-medium text-brand-700 focus:outline-none"
            >
              {RADII.map((radius) => (
                <option key={radius} value={radius}>
                  {radius} km
                </option>
              ))}
            </select>
          </div>
          <ActionButton
            type="submit"
            variant="primary"
            disabled={search.isPending || !keyword.trim()}
            className="h-9"
            icon={search.isPending ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          >
            {search.isPending ? "Searching…" : "Search"}
          </ActionButton>
        </form>

        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-brand-400">Your tracked keywords:</span>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => run(suggestion)}
                disabled={search.isPending}
                className="rounded-full border bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 transition disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </Panel>

      {search.isError && (
        <GbpStatePanel
          compact
          icon={Users}
          tone="danger"
          title="The search didn't run"
          body={<>Google Maps could not be searched for this keyword.</>}
          detail={errorMessage(search.error)}
        />
      )}

      {!result && !search.isPending && !search.isError && (
        <GbpStatePanel
          icon={Users}
          tone="neutral"
          title="Run a search to see your competitors"
          body={
            <>
              Enter what customers type — like &quot;milk delivery Panvel&quot; — to see every business Google
              Maps shows for it, their ratings and review counts, and where you place among them. For how that
              changes across your area, run a rank grid from Local Rankings.
            </>
          }
          action={onSelectTab ? { label: "Go to Local Rankings", onClick: () => onSelectTab("rankings") } : undefined}
        />
      )}

      {result && <CompetitorResults key={result.searchedAt} result={result} onSelectTab={onSelectTab} />}
    </div>
  );
}

function CompetitorResults({
  result,
  onSelectTab,
}: {
  result: NonNullable<ReturnType<typeof usePlacesCompetitors>["data"]>;
  onSelectTab?: (tab: GbpTabKey) => void;
}) {
  const you = result.results.find((entry) => entry.isYou) ?? null;
  const rivals = result.results.filter((entry) => !entry.isYou);
  const topThree = rivals.slice(0, 3);

  const average = (values: (number | null)[]) => {
    const present = values.filter((value): value is number => value != null);
    return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
  };
  const topRating = average(topThree.map((entry) => entry.rating));
  const topReviews = average(topThree.map((entry) => entry.reviewCount));

  if (result.results.length === 0) {
    return (
      <GbpStatePanel
        compact
        icon={Users}
        tone="neutral"
        title={`Google Maps returned no businesses for "${result.keyword}"`}
        body={<>Try the words a customer would use, or a wider radius.</>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi
          label="Your position"
          value={result.yourRank != null ? `#${result.yourRank}` : "Not shown"}
          tone={result.yourRank == null ? "danger" : result.yourRank <= 3 ? "good" : "default"}
          sub={
            result.yourRank != null
              ? `of ${result.results.length} results for "${result.keyword}"`
              : `You're not in Google's top ${result.results.length} for "${result.keyword}"`
          }
        />
        <Kpi
          label="Rating vs top 3"
          value={you?.rating != null ? you.rating.toFixed(1) : "—"}
          tone={you?.rating != null && topRating != null ? (you.rating >= topRating ? "good" : "danger") : "default"}
          sub={topRating != null ? `Top 3 competitors average ${topRating.toFixed(1)}` : "No ratings among the top 3"}
        />
        <Kpi
          label="Reviews vs top 3"
          value={you?.reviewCount != null ? you.reviewCount.toLocaleString() : "—"}
          tone={
            you?.reviewCount != null && topReviews != null
              ? you.reviewCount >= topReviews
                ? "good"
                : "danger"
              : "default"
          }
          sub={
            topReviews != null
              ? `Top 3 competitors average ${Math.round(topReviews).toLocaleString()}`
              : "No review counts among the top 3"
          }
        />
      </div>

      <Panel
        title={`Google Maps results for "${result.keyword}"`}
        subtitle={`Within ~${result.radiusKm} km · searched ${formatGbpTimestamp(result.searchedAt) ?? "just now"}`}
      >
        <Table minWidth={720}>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Business</Th>
              <Th>Category</Th>
              <Th align="right">Rating</Th>
              <Th align="right">Reviews</Th>
              <Th align="right">Distance</Th>
              <Th align="right">{""}</Th>
            </tr>
          </thead>
          <tbody>
            {result.results.map((entry) => (
              <CompetitorRow key={entry.placeId} entry={entry} />
            ))}
          </tbody>
        </Table>
      </Panel>

      {onSelectTab && (
        <button
          type="button"
          onClick={() => onSelectTab("rankings")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-600 hover:text-accent-700"
        >
          See how this changes across your area in Local Rankings <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

function CompetitorRow({ entry }: { entry: PlacesCompetitor }) {
  return (
    <Tr className={cn(entry.isYou && "bg-success-50/60")}>
      <Td className="font-mono text-xs font-bold text-brand-700">{entry.rank}</Td>
      <Td className="min-w-[200px] text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-brand-950">{entry.name}</span>
          {entry.isYou && <Pill tone="good">YOU</Pill>}
        </div>
        {entry.address && <p className="text-[11px] text-brand-400 truncate max-w-[320px]">{entry.address}</p>}
      </Td>
      <Td className="text-xs text-brand-600">{entry.category ?? "—"}</Td>
      <Td align="right" className="text-xs">
        {entry.rating != null ? (
          <span className="inline-flex items-center gap-1 font-semibold text-brand-900">
            <Star size={11} className="fill-warning-500 text-warning-500" />
            {entry.rating.toFixed(1)}
          </span>
        ) : (
          "—"
        )}
      </Td>
      <Td align="right" className="font-mono text-xs text-brand-800">
        {entry.reviewCount != null ? entry.reviewCount.toLocaleString() : "—"}
      </Td>
      <Td align="right" className="font-mono text-xs text-brand-500">
        {entry.distanceKm != null ? `${entry.distanceKm} km` : "—"}
      </Td>
      <Td align="right" className="whitespace-nowrap">
        {entry.googleMapsUri && (
          <a
            href={entry.googleMapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-600 hover:text-accent-700"
          >
            Maps <ExternalLink size={10} />
          </a>
        )}
      </Td>
    </Tr>
  );
}
