"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSearch, GitCompareArrows, ListChecks, ShieldAlert, TrendingUp, Trophy } from "lucide-react";
import { PageHeader, Pill, Tabs } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { DiagnosisTab } from "@/components/search-intelligence/diagnosis-tab";
import { RankingsTab } from "@/components/search-intelligence/rankings-tab";
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
 * Google Search: what Google itself shows and records about the site — why a
 * page does or does not rank, positions and overtakes, the keywords rivals win,
 * which pages are indexed, and search results before and after a change.
 */
export default function SearchIntelligencePage() {
  const { projectId } = useWorkspace();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("diagnose");

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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Google Search"
        subtitle="Why pages rank or don't, who is winning which searches, and what Google has indexed, all from Google's own data"
        actions={
          s && (
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
          <Pill tone={s.googleResultsConnected ? "good" : "warn"}>
            Google results {s.googleResultsConnected ? "connected" : "not connected"}
          </Pill>
          <Pill tone={s.searchConsoleConnected ? "good" : "warn"}>
            Search Console {s.searchConsoleConnected ? "connected" : "not connected"}
          </Pill>
        </div>
      )}

      <Tabs
        tabs={[
          { id: "diagnose" as Tab, label: "Why not ranking", icon: FileSearch },
          { id: "rankings" as Tab, label: "Rankings", icon: Trophy },
          { id: "gaps" as Tab, label: "Competitor keywords", icon: GitCompareArrows },
          { id: "index" as Tab, label: "Index status", icon: ListChecks },
          { id: "results" as Tab, label: "Change results", icon: TrendingUp },
          { id: "risk" as Tab, label: "Risk check", icon: ShieldAlert },
        ]}
        active={tab}
        onChange={setTab}
      />

      <QueryState isLoading={!projectId || status.isLoading} error={status.error}>
        {projectId && s && (
          <>
            {tab === "diagnose" && <DiagnosisTab projectId={projectId} connected={s.googleResultsConnected} />}
            {tab === "rankings" && <RankingsTab projectId={projectId} connected={s.googleResultsConnected} />}
            {tab === "gaps" && <KeywordGapsTab projectId={projectId} connected={s.googleResultsConnected} />}
            {tab === "index" && <IndexStatusTab projectId={projectId} searchConsoleConnected={s.searchConsoleConnected} />}
            {tab === "results" && <ChangeResultsTab projectId={projectId} searchConsoleConnected={s.searchConsoleConnected} />}
            {tab === "risk" && <RiskCheckTab projectId={projectId} />}
          </>
        )}
      </QueryState>
    </div>
  );
}
