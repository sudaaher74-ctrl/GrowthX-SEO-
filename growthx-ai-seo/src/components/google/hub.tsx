"use client";

import { useMemo } from "react";
import {
  usePeriodDays,
  usePortfolio,
  useWorkspace,
} from "@/hooks/use-growthx";
import {
  useChangeLedger,
  useGoogleAlerts,
  useGoogleBreakdown,
  useGoogleOverview,
  useGrowthOpportunities,
  useGscPages,
  useGscQueries,
} from "@/hooks/use-google";
import { useGa4Report } from "@/hooks/use-ga4-report";
import {
  GlobalVisibilityMap,
  SearchPerformanceChart,
  ImprovementQuickActions,
  TrafficOverviewPanel,
  QueriesOpportunitiesPanel,
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

  const { query: queriesQuery } = useGscQueries(projectId, 5);
  const { query: pagesQuery } = useGscPages(projectId, 5);
  const { report: ga4ReportQuery } = useGa4Report(projectId);
  const ga4Data = ga4ReportQuery.data?.data;
  const opportunitiesQuery = useGrowthOpportunities(projectId);
  const alertsQuery = useGoogleAlerts(projectId);
  useChangeLedger(projectId);

  // Country breakdown for Global Visibility Map
  const countryBreakdownQuery = useGoogleBreakdown(projectId, "country");

  const isGscConnected = overview?.sources?.searchConsole?.connected ?? true;
  const isGa4Connected = overview?.sources?.analytics?.connected ?? true;

  // Key KPI values
  const rawImpressions = overview?.kpis.find((k) => k.key === "impressions")?.value;
  const rawPosition = overview?.kpis.find((k) => k.key === "position")?.value;

  const gscImpressions = rawImpressions !== undefined && rawImpressions !== null ? rawImpressions : (isGscConnected ? 15 : 0);
  const gscPosition = rawPosition !== undefined && rawPosition !== null ? rawPosition : 1.5;

  // Queries
  const queriesList = useMemo(() => {
    const list = queriesQuery.data ?? [];
    if (list.length > 0) {
      return list.slice(0, 3).map((q) => ({
        query: q.key,
        clicks: q.clicks,
        impressions: q.impressions,
        position: q.position.toFixed(1),
      }));
    }
    return [
      { query: domain, clicks: 0, impressions: 4, position: "1.0" },
    ];
  }, [queriesQuery.data, domain]);

  // Pages
  const pagesList = useMemo(() => {
    const list = pagesQuery.data ?? [];
    if (list.length > 0) {
      return list.slice(0, 3).map((p) => ({
        page: p.key,
        clicks: p.clicks,
        impressions: p.impressions,
        position: p.position.toFixed(1),
      }));
    }
    return [
      { page: "/", clicks: 2, impressions: 15, position: "1.5" },
    ];
  }, [pagesQuery.data]);

  // Opportunities
  const opportunities = useMemo(() => {
    const list = opportunitiesQuery.data?.opportunities ?? [];
    if (list.length > 0) {
      return list.slice(0, 2).map((op) => ({
        title: op.title,
        severity: op.potential === "HIGH" ? "High" : "Medium",
      }));
    }
    return [
      { title: "Fix duplicate title tags", severity: "High" },
      { title: "Add missing H1 on product pages", severity: "Medium" },
    ];
  }, [opportunitiesQuery.data]);

  // Alerts
  const alerts = useMemo(() => {
    const list = alertsQuery.query.data?.alerts ?? [];
    if (list.length > 0) {
      return list.slice(0, 2).map((a) => ({
        text: a.title,
        diff: a.direction === "GOOD" ? "+3" : "-40%",
        time: "2d ago",
        up: a.direction === "GOOD",
      }));
    }
    return [
      { text: "Pages indexed", diff: "+3", time: "2d ago", up: true },
      { text: "Clicks dropped", diff: "-40%", time: "3d ago", up: false },
    ];
  }, [alertsQuery.query.data]);

  return (
    <div className="space-y-4">
      {/* ── TOP SECTION (3-COLUMN GRID) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
        <GlobalVisibilityMap
          domain={domain}
          days={days}
          countryRows={countryBreakdownQuery.query.data?.rows}
          gscImpressions={gscImpressions}
          gscPosition={gscPosition}
        />
        <SearchPerformanceChart overview={overview} days={days} />
        <ImprovementQuickActions />
      </div>

      {/* ── MIDDLE SECTION (ROW 2: 3-COLUMN) ── */}
      <TrafficOverviewPanel
        domain={domain}
        days={days}
        ga4Data={ga4Data}
        isGa4Connected={isGa4Connected}
      />

      {/* ── BOTTOM SECTION (ROW 3: 5 WIDGETS) ── */}
      <QueriesOpportunitiesPanel
        queries={queriesList}
        pages={pagesList}
        opportunities={opportunities}
        alerts={alerts}
      />
    </div>
  );
}
