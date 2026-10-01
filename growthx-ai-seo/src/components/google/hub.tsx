"use client";

import { usePeriodDays, usePortfolio, useWorkspace } from "@/hooks/use-growthx";
import {
  useGoogleBreakdown,
  useGoogleOverview,
  useGrowthOpportunities,
} from "@/hooks/use-google";
import { useGa4Report } from "@/hooks/use-ga4-report";
import {
  GlobalVisibilityMap,
  SearchPerformanceChart,
  TrafficOverviewPanel,
  OpportunitiesPanel,
} from "./hub/index";

export function GoogleHub() {
  const { orgId, projectId, projects } = useWorkspace();
  const days = usePeriodDays();
  const portfolio = usePortfolio(orgId);
  const project = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? portfolio.data?.clients[0] ?? null;
  const domain = client?.domain || project?.name || "your-site.com";

  // Data sources
  const { query: overviewQuery } = useGoogleOverview(projectId);
  const overview = overviewQuery.data;

  const { report: ga4ReportQuery } = useGa4Report(projectId);
  const ga4Data = ga4ReportQuery.data?.data;
  const opportunitiesQuery = useGrowthOpportunities(projectId);

  // Country breakdown for Global Visibility Map
  const countryBreakdownQuery = useGoogleBreakdown(projectId, "country");

  const isGscConnected = overview?.sources?.searchConsole?.connected ?? true;
  const isGa4Connected = overview?.sources?.analytics?.connected ?? true;

  // Key KPI values
  const rawImpressions = overview?.kpis.find((k) => k.key === "impressions")?.value;
  const rawPosition = overview?.kpis.find((k) => k.key === "position")?.value;

  const gscImpressions = rawImpressions !== undefined && rawImpressions !== null ? rawImpressions : (isGscConnected ? 15 : 0);
  const gscPosition = rawPosition !== undefined && rawPosition !== null ? rawPosition : 1.5;

  const opportunities = opportunitiesQuery.data?.opportunities ?? [];

  return (
    <div className="space-y-4">
      {/* ── TOP SECTION (2-COLUMN BALANCED GRID) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
        <GlobalVisibilityMap
          domain={domain}
          days={days}
          countryRows={countryBreakdownQuery.query.data?.rows}
          gscImpressions={gscImpressions}
          gscPosition={gscPosition}
        />
        <SearchPerformanceChart overview={overview} days={days} />
      </div>

      {/* ── MIDDLE SECTION (ROW 2: 3-COLUMN) ── */}
      <TrafficOverviewPanel
        domain={domain}
        days={days}
        ga4Data={ga4Data}
        isGa4Connected={isGa4Connected}
      />

      {/* ── BOTTOM SECTION: OPPORTUNITIES ── */}
      <OpportunitiesPanel
        opportunities={opportunities}
        totalCount={opportunitiesQuery.data?.total}
        isLoading={opportunitiesQuery.isLoading}
      />
    </div>
  );
}

