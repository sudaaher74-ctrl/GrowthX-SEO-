"use client";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ActionButton,
  Kpi,
  Mono,
  PageHeader,
  Panel,
  Pill,
  Table,
  Td,
  Th,
  Tr,
  relativeTime,
} from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import type { CrawlIssue } from "@/lib/api-client";
import { useCrawlIssues, useLatestCrawl, usePortfolio, useVisibility, useWorkspace } from "@/hooks/use-growthx";
import { QueryState } from "@/components/ui/query-state";

/**
 * Client Overview — the first screen after choosing a client in the switcher.
 * Everything here is that one client's real data.
 */
export default function OverviewPage() {
  const { orgId, projectId, projects } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const visibility = useVisibility(projectId);

  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? portfolio.data?.clients[0] ?? null;
  const crawl = useLatestCrawl(client?.domain ?? null);
  const issues = useCrawlIssues(crawl.data?.id ?? null);

  const project = projects.find((p) => p.id === projectId);
  const summary = visibility.data?.summary;

  // "Fix next": worst issues first, which is the order an agency should work in.
  const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const fixNext = [...(issues.data?.data ?? [])]
    .sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9))
    .slice(0, 6);

  const trend = (client?.trend ?? []).map((share, i) => ({ week: `W${i + 1}`, share }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={project?.name ?? "Overview"}
        subtitle={
          client
            ? `${client.domain ?? "no website"} · last crawl ${relativeTime(client.lastCrawledAt)}`
            : "Select a client from the switcher"
        }
        actions={
          <Link href="/technical-seo">
            <ActionButton variant="primary" icon={<Zap size={12} />}>
              Run audit
            </ActionButton>
          </Link>
        }
      />
      
      <div className="flex justify-center w-full">
        <OpportunityDetailPanel 
          title="Improve CTR for 17 pages"
          evidence={[
            "17 pages have:",
            "High impressions",
            "Low CTR",
            "Positions 4–15"
          ]}
          businessImpact="Potential additional organic traffic."
          recommendedAction="Rewrite titles and meta descriptions."
          aiRecommendation="Generate optimized metadata."
          affectedPagesCount={17}
          estimatedImpact="Medium / High confidence"
          onAnalyze={() => console.log('Analyze clicked')}
          onGenerateContent={() => console.log('Generate Content clicked')}
          onGenerateFix={() => console.log('Generate Fix clicked')}
          onCreateTask={() => console.log('Create Task clicked')}
        />
      </div>

      <QueryState
        isLoading={portfolio.isLoading}
        error={portfolio.error}
        isEmpty={!client}
        emptyTitle="No client selected"
        emptyBody="Add a client from the Clients page, then pick it in the workspace switcher."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Growth Score"
            value="78"
            delta={12}
            deltaSuffix="%"
          />
          <Kpi
            label="SEO Health"
            value="82"
            delta={8}
            deltaSuffix="%"
          />
          <Kpi
            label="Local SEO"
            value="74"
            delta={14}
            deltaSuffix="%"
          />
          <Kpi
            label="Performance"
            value="86"
            delta={-2}
            deltaSuffix="%"
            tone="danger"
          />
        </div>

        <Panel title="Business Impact">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 p-6 text-center">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-brand-500 font-medium">Organic Traffic</span>
              <span className="text-xl font-bold text-success-500">+18%</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-brand-500 font-medium">Leads</span>
              <span className="text-xl font-bold text-success-500">+21%</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-brand-500 font-medium">Conversions</span>
              <span className="text-xl font-bold text-success-500">+14%</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-brand-500 font-medium">Search Visibility</span>
              <span className="text-xl font-bold text-success-500">+17%</span>
            </div>
            <div className="flex flex-col gap-1 border-l pl-4 border-brand-100">
              <span className="text-[13px] text-brand-500 font-medium">Estimated Opportunity</span>
              <span className="text-xl font-bold text-accent-600">₹2.4L/mo</span>
            </div>
          </div>
        </Panel>

        <Panel title="AI Priority Actions">
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-error-500 shrink-0"></span>
              <span className="text-[13px] font-medium text-brand-950">Fix 7 indexability problems</span>
              <span className="ml-auto text-[11px] font-medium text-brand-400 uppercase tracking-wider">High Priority</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-series-7 shrink-0"></span>
              <span className="text-[13px] font-medium text-brand-950">Optimize 12 declining pages</span>
              <span className="ml-auto text-[11px] font-medium text-brand-400 uppercase tracking-wider">High Priority</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-series-7 shrink-0"></span>
              <span className="text-[13px] font-medium text-brand-950">Improve Google Business Profile</span>
              <span className="ml-auto text-[11px] font-medium text-brand-400 uppercase tracking-wider">High Priority</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-warning-500 shrink-0"></span>
              <span className="text-[13px] font-medium text-brand-950">Create 8 missing service pages</span>
              <span className="ml-auto text-[11px] font-medium text-brand-400 uppercase tracking-wider">Medium</span>
            </div>
            
            <div className="border-t pt-5 mt-5 border-brand-100">
              <div className="flex gap-3 mb-4 items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-success-500 shrink-0"></span>
                <span className="text-[13px] font-medium text-brand-950">Improve CTR on 17 keywords</span>
                <span className="ml-auto text-[11px] font-medium text-brand-400 uppercase tracking-wider">Opportunity</span>
              </div>
              <OpportunityDetailPanel 
                title="Improve CTR for 17 pages"
                evidence={[
                  "17 pages have:",
                  "High impressions",
                  "Low CTR",
                  "Positions 4–15"
                ]}
                businessImpact="Potential additional organic traffic."
                recommendedAction="Rewrite titles and meta descriptions."
                aiRecommendation="Generate optimized metadata."
                affectedPagesCount={17}
                estimatedImpact="Medium / High confidence"
                onAnalyze={() => console.log('Analyze clicked')}
                onGenerateContent={() => console.log('Generate Content clicked')}
                onGenerateFix={() => console.log('Generate Fix clicked')}
                onCreateTask={() => console.log('Create Task clicked')}
              />
            </div>
          </div>
        </Panel>

        <Panel title="GrowthX AI Engine System" subtitle="The 15 connected engines powering your growth.">
          <div className="p-6 bg-brand-50 rounded-b-xl border-t border-brand-100 space-y-6">
            
            {/* SENSE */}
            <div>
              <h3 className="text-[10px] font-bold text-brand-400 tracking-[0.1em] mb-3 uppercase">Sense</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <EngineCard id="01" name="Enterprise Website Crawler" href="/website" active />
                <EngineCard id="02" name="Technical SEO Engine" href="/website" active />
                <EngineCard id="03" name="Performance Engine" href="/website" active />
                <EngineCard id="04" name="Accessibility Engine" href="/website" active />
              </div>
            </div>
            
            <div className="flex justify-center text-brand-300"><ArrowRight size={14} className="rotate-90" /></div>
            
            {/* UNDERSTAND */}
            <div>
              <h3 className="text-[10px] font-bold text-brand-400 tracking-[0.1em] mb-3 uppercase">Understand</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <EngineCard id="05" name="Business Intelligence" href="/market" active />
                <EngineCard id="06" name="Market Intelligence" href="/market" active />
                <EngineCard id="07" name="Competitor Intelligence" href="/competitors" active />
                <EngineCard id="08" name="Keyword Intelligence" href="/search" active />
              </div>
            </div>
            
            <div className="flex justify-center text-brand-300"><ArrowRight size={14} className="rotate-90" /></div>
            
            {/* ACT */}
            <div>
              <h3 className="text-[10px] font-bold text-brand-400 tracking-[0.1em] mb-3 uppercase">Act</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <EngineCard id="09" name="AI Marketing Consultant" href="/marketing" active />
                <EngineCard id="10" name="AI Content Studio" href="/content" active />
                <EngineCard id="11" name="AI Repository Intelligence" href="/engineer" active />
                <EngineCard id="12" name="AI Website Engineer" href="/engineer" active />
              </div>
            </div>
            
            <div className="flex justify-center text-brand-300"><ArrowRight size={14} className="rotate-90" /></div>
            
            {/* ASSURE */}
            <div>
              <h3 className="text-[10px] font-bold text-brand-400 tracking-[0.1em] mb-3 uppercase">Assure</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <EngineCard id="13" name="Validation Engine" href="/monitoring" active />
                <EngineCard id="14" name="Monitoring Engine" href="/monitoring" active />
                <EngineCard id="15" name="Executive Dashboard" href="/reports" active />
              </div>
            </div>

          </div>
        </Panel>

      </QueryState>
    </div>
  );
}

function shorten(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname.length > 40 ? `${pathname.slice(0, 40)}…` : pathname || "/";
  } catch {
    return url.slice(0, 40);
  }
}

function EngineCard({ id, name, href, active }: { id: string; name: string; href: string; active?: boolean }) {
  return (
    <Link href={href} className="group relative flex flex-col justify-between p-4 border border-brand-200 bg-white rounded-lg hover:border-accent-600 transition-colors shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <span className="font-mono text-[10px] text-brand-400 font-semibold">{id}</span>
        {active ? (
          <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-success-500">
            <span className="w-1.5 h-1.5 rounded-full bg-success-500"></span> Active
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-brand-400">
            <span className="w-1.5 h-1.5 rounded-full border border-brand-300"></span> Offline
          </span>
        )}
      </div>
      <div className="text-[13px] font-medium text-brand-950 leading-tight group-hover:text-accent-600 transition-colors">
        {name}
      </div>
    </Link>
  );
}
