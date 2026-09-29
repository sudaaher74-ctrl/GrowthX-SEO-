"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSearch, GitCompareArrows, ListChecks, ShieldAlert, TrendingUp, Trophy } from "lucide-react";
import { PageHeader, Pill, Tabs } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { Ga4OrganicPill } from "@/components/ga4/ga4-panels";
import { DiagnosisTab } from "@/components/search-intelligence/diagnosis-tab";
import { RankingsTab, type DiagnoseSeed } from "@/components/search-intelligence/rankings-tab";
import { KeywordGapsTab } from "@/components/search-intelligence/keyword-gaps-tab";
import { IndexStatusTab } from "@/components/search-intelligence/index-status-tab";
import { ChangeResultsTab, RiskCheckTab } from "@/components/search-intelligence/changes-tab";

type Tab = "diagnose" | "rankings" | "gaps" | "index" | "results" | "risk";

/** Country names as Google results take them. "" means automatic. */
const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "United Arab Emirates",
  "Saudi Arabia",
  "Singapore",
  "Malaysia",
  "Bangladesh",
  "Nepal",
  "Sri Lanka",
  "South Africa",
  "Germany",
  "France",
  "Netherlands",
  "Ireland",
  "New Zealand",
];

const MARKET_SOURCE = {
  SET: "chosen",
  SEARCH_CONSOLE: "from Search Console",
  DEFAULT: "default",
} as const;

/**
 * Google Search: what Google itself shows and records about the site — where
 * pages rank and why they do or do not, which pages are indexed, and search
 * results before and after a change.
 *
 * It runs on the customer's own Search Console (and Google Analytics 4 for the
 * visits and conversions that follow). Live results and competitor keywords
 * are a paid source only the platform can provide; where it does, they add to
 * the page, and where it does not they are not mentioned.
 */
export default function SearchIntelligencePage() {
  const { projectId } = useWorkspace();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("rankings");
  // A search picked from the rankings table, carried to the diagnosis tab. The
  // number makes each pick a fresh start even when it is the same search twice.
  const [seed, setSeed] = useState<(DiagnoseSeed & { pick: number }) | null>(null);

  const status = useQuery({
    queryKey: ["si-status", projectId],
    queryFn: () => api.searchIntelligence.status(projectId!),
    enabled: Boolean(projectId),
  });
  const setMarket = useMutation({
    mutationFn: (country: string) => api.searchIntelligence.setMarket(projectId!, { country: country || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["si-status", projectId] }),
  });

  const s = status.data;
  const searchConsole = Boolean(s?.searchConsoleConnected);
  const analytics = Boolean(s?.analyticsConnected);
  const liveResults = Boolean(s?.googleResultsConnected);

  const tabs: Array<{ id: Tab; label: string; icon: typeof FileSearch }> = [
    { id: "rankings", label: "Rankings", icon: Trophy },
    { id: "diagnose", label: "Why not ranking", icon: FileSearch },
    ...(liveResults ? [{ id: "gaps" as Tab, label: "Competitor keywords", icon: GitCompareArrows }] : []),
    { id: "index", label: "Index status", icon: ListChecks },
    { id: "results", label: "Change results", icon: TrendingUp },
    { id: "risk", label: "Risk check", icon: ShieldAlert },
  ];
  // Competitor keywords come and go with the platform's source for them.
  const active: Tab = tab === "gaps" && !liveResults ? "rankings" : tab;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Google Search"
        subtitle="Where pages rank and why they do or don't, and what Google has indexed, from your own Google data"
        actions={
          // The market only matters to live results; Search Console covers every country.
          s && liveResults && (
            <label className="flex items-center gap-2 text-[11.5px] text-brand-500">
              Google results for
              <select
                className="rounded-lg border bg-white px-2 py-1.5 text-[12px] font-medium text-brand-950"
                value={s.market.source === "SET" ? s.market.country : ""}
                onChange={(e) => setMarket.mutate(e.target.value)}
                disabled={setMarket.isPending}
              >
                <option value="">
                  {s.market.source === "SET" ? "Automatic" : `${s.market.country} (${MARKET_SOURCE[s.market.source]})`}
                </option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          )
        }
      />

      {s && (
        <div className="flex flex-wrap gap-2">
          <Pill tone={searchConsole ? "good" : "warn"}>Search Console {searchConsole ? "connected" : "not connected"}</Pill>
          <Pill tone={analytics ? "good" : "warn"}>Google Analytics 4 {analytics ? "connected" : "not connected"}</Pill>
          {analytics && projectId && <Ga4OrganicPill projectId={projectId} />}
          {liveResults && <Pill tone="good">Live Google results on</Pill>}
        </div>
      )}

      <Tabs
        tabs={tabs}
        active={active}
        onChange={(next) => {
          setSeed(null);
          setTab(next);
        }}
      />

      <QueryState isLoading={!projectId || status.isLoading} error={status.error}>
        {projectId && s && (
          <>
            {active === "rankings" && (
              <RankingsTab
                projectId={projectId}
                searchConsoleConnected={searchConsole}
                analyticsConnected={analytics}
                liveResults={liveResults}
                onDiagnose={(pick) => {
                  setSeed({ ...pick, pick: Date.now() });
                  setTab("diagnose");
                }}
              />
            )}
            {active === "diagnose" && (
              <DiagnosisTab
                key={seed?.pick ?? "none"}
                projectId={projectId}
                searchConsoleConnected={searchConsole}
                analyticsConnected={analytics}
                liveResults={liveResults}
                initial={seed}
              />
            )}
            {active === "gaps" && <KeywordGapsTab projectId={projectId} />}
            {active === "index" && <IndexStatusTab projectId={projectId} searchConsoleConnected={searchConsole} />}
            {active === "results" && <ChangeResultsTab projectId={projectId} searchConsoleConnected={searchConsole} />}
            {active === "risk" && <RiskCheckTab projectId={projectId} />}
          </>
        )}
      </QueryState>
    </div>
  );
}
