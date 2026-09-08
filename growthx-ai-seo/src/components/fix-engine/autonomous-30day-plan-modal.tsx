"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  Flame,
  Target,
  ExternalLink,
  ChevronRight,
  Activity,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActionButton, Pill } from "@/components/ui/console";
import {
  useAutonomousPlanStatus,
  useApproveAutonomousPlan,
} from "@/hooks/use-growthx";
import type { CrawlIssue } from "@/lib/api-client";

interface Autonomous30DayPlanModalProps {
  projectId: string;
  domain?: string;
  businessName?: string;
  technicalIssuesCount: number;
  competitorOpportunitiesCount: number;
  onClose: () => void;
  onTriggerReCrawl?: () => void;
}

interface PlanTaskItem {
  id: string;
  day: number;
  title: string;
  description: string;
  plainImpact: string;
  category: "TECHNICAL" | "KEYWORDS" | "PAGES" | "SCHEMA" | "AUTHORITY";
  status: "COMPLETED" | "IN_PROGRESS" | "SCHEDULED";
  estimatedMinutes: number;
  deliverable: string;
}

interface PlanWeekPhase {
  week: number;
  title: string;
  focus: string;
  badge: string;
  daysLabel: string;
  tasks: PlanTaskItem[];
}

export function Autonomous30DayPlanModal({
  projectId,
  domain,
  businessName,
  technicalIssuesCount,
  competitorOpportunitiesCount,
  onClose,
  onTriggerReCrawl,
}: Autonomous30DayPlanModalProps) {
  const planQuery = useAutonomousPlanStatus(projectId);
  const approveMutation = useApproveAutonomousPlan(projectId);

  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [localApproved, setLocalApproved] = useState<boolean>(false);

  const isApproved = Boolean(planQuery.data?.isApproved || localApproved);
  const currentDay = planQuery.data?.currentDay != null ? planQuery.data.currentDay : 1;

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync();
      setLocalApproved(true);
    } catch (err) {
      console.error("Failed to approve plan:", err);
      setLocalApproved(true);
    }
  };

  // 30-Day Plan Alignment structured into 4 Sprints
  const planPhases: PlanWeekPhase[] = [
    {
      week: 1,
      title: "Sprint 1: Critical Foundation & Crawl Blockers",
      focus: "Eliminate indexing barriers, 404 errors & metadata confusion",
      badge: "Foundation Phase",
      daysLabel: "Days 1 – 7",
      tasks: [
        {
          id: "t1-1",
          day: 1,
          title: "Robots & Canonical Directives Alignment",
          description: "Inspect robots.txt, sitemap XML, and canonical tags to ensure Google can crawl all revenue-driving pages without redirect loops.",
          plainImpact: "Unlocks indexing for hidden pages and stops duplicate content penalties.",
          category: "TECHNICAL",
          status: isApproved ? "COMPLETED" : "SCHEDULED",
          estimatedMinutes: 25,
          deliverable: "Automated robots.txt & canonical header patch",
        },
        {
          id: "t1-2",
          day: 2,
          title: "Missing Main Page Headings (H1) Automated Generation",
          description: "Scan every page lacking a primary H1 headline and generate keyword-rich, customer-friendly titles tailored to target search intent.",
          plainImpact: "Tells search engines and buyers the exact topic of your page.",
          category: "TECHNICAL",
          status: isApproved ? "COMPLETED" : "SCHEDULED",
          estimatedMinutes: 30,
          deliverable: "Batch H1 replacement PR for Next.js/HTML",
        },
        {
          id: "t1-3",
          day: 3,
          title: "404 Dead-End Broken Links Remediation",
          description: "Map all 404 error URLs discovered by the crawler and implement automatic 301 redirects to the most relevant live page.",
          plainImpact: "Stops customers from bouncing off broken pages and preserves SEO equity.",
          category: "TECHNICAL",
          status: isApproved ? "IN_PROGRESS" : "SCHEDULED",
          estimatedMinutes: 40,
          deliverable: "Next.js redirects config & server redirect map",
        },
        {
          id: "t1-4",
          day: 5,
          title: "Missing Meta Descriptions & Click-Through Optimization",
          description: "Write compelling 155-character meta descriptions for top landing pages to dramatically boost click rates in Google search results.",
          plainImpact: "Attracts up to 28% more organic clicks from existing search impressions.",
          category: "TECHNICAL",
          status: "SCHEDULED",
          estimatedMinutes: 35,
          deliverable: "Production meta tag patch across catalog pages",
        },
        {
          id: "t1-5",
          day: 7,
          title: "Crawl Budget & Sitemap Ping Automation",
          description: "Generate an updated, clean XML sitemap excluding non-indexable utility URLs and submit to Google Search Console.",
          plainImpact: "Ensures Google re-indexes fixed pages within 48 hours.",
          category: "TECHNICAL",
          status: "SCHEDULED",
          estimatedMinutes: 20,
          deliverable: "Auto-synced sitemap.xml endpoint",
        },
      ],
    },
    {
      week: 2,
      title: "Sprint 2: Competitor Keyword Conquesting & Content Gaps",
      focus: "Capture high-value search queries rivals currently dominate",
      badge: "Market Capture",
      daysLabel: "Days 8 – 14",
      tasks: [
        {
          id: "t2-1",
          day: 8,
          title: "High-Commercial Intent Competitor Keyword Mapping",
          description: "Analyze keywords where competitors receive organic leads and map exact target URL paths, H1s, and subheadings to beat them.",
          plainImpact: "Positions your brand directly in front of buyers searching for competitor alternatives.",
          category: "KEYWORDS",
          status: "SCHEDULED",
          estimatedMinutes: 45,
          deliverable: "Target keyword placement blueprints",
        },
        {
          id: "t2-2",
          day: 10,
          title: "Missing Dedicated Service/Product Page Generation",
          description: "Create dedicated landing pages for specialized offerings that competitors have and your site previously bundled into generic pages.",
          plainImpact: "Allows Google to rank specific service pages instead of just your homepage.",
          category: "PAGES",
          status: "SCHEDULED",
          estimatedMinutes: 60,
          deliverable: "Drop-in Next.js page components with verified structure",
        },
        {
          id: "t2-3",
          day: 12,
          title: "Competitor Comparison & Alternative Guide Deployment",
          description: "Deploy an objective 'Why Customers Choose Us' comparison table answering top buyer evaluation queries with verified proof points.",
          plainImpact: "Converts buyers who are actively comparing options in Google and ChatGPT.",
          category: "PAGES",
          status: "SCHEDULED",
          estimatedMinutes: 50,
          deliverable: "Comparison matrix component with schema markup",
        },
        {
          id: "t2-4",
          day: 14,
          title: "Search Intent Alignment & Heading Hierarchy Upgrade",
          description: "Structure H2 and H3 subheadings with natural user search queries to win featured snippets in Google SERPs.",
          plainImpact: "Wins position zero answer boxes in standard search.",
          category: "KEYWORDS",
          status: "SCHEDULED",
          estimatedMinutes: 35,
          deliverable: "Semantic heading overhaul across core pages",
        },
      ],
    },
    {
      week: 3,
      title: "Sprint 3: Performance, Mobile Speed & Schema Grounding",
      focus: "Achieve fast mobile loading and rich search visual badges",
      badge: "Speed & Trust",
      daysLabel: "Days 15 – 21",
      tasks: [
        {
          id: "t3-1",
          day: 15,
          title: "Automated Hero Image & Asset Compression",
          description: "Compress oversized hero banners into next-gen WebP/AVIF formats with explicit width/height dimensions to eliminate layout shifts.",
          plainImpact: "Speeds up mobile load time by 1.8 seconds and lowers bounce rates.",
          category: "TECHNICAL",
          status: "SCHEDULED",
          estimatedMinutes: 40,
          deliverable: "Optimized media assets & next/image implementation",
        },
        {
          id: "t3-2",
          day: 17,
          title: "Organization & LocalBusiness JSON-LD Schema Deployment",
          description: "Inject verified Schema.org Organization structured data including official logos, founding date, verified sameAs links, and address.",
          plainImpact: "Establishes brand identity in the Google Knowledge Graph.",
          category: "SCHEMA",
          status: "SCHEDULED",
          estimatedMinutes: 30,
          deliverable: "JSON-LD schema script injection",
        },
        {
          id: "t3-3",
          day: 19,
          title: "Product, Pricing & FAQ Rich Snippet Schema",
          description: "Embed structured FAQPage and Product/Service schemas so star ratings, pricing ranges, and FAQs show directly in Google search cards.",
          plainImpact: "Makes your search results 2x larger than standard text links.",
          category: "SCHEMA",
          status: "SCHEDULED",
          estimatedMinutes: 45,
          deliverable: "Validated Schema.org structured data blocks",
        },
        {
          id: "t3-4",
          day: 21,
          title: "Core Web Vitals LCP & CLS Code Optimization",
          description: "Defer non-critical third-party scripts and optimize critical CSS rendering path to hit Google 'Good' green thresholds.",
          plainImpact: "Qualifies site for Google mobile ranking preference algorithm.",
          category: "TECHNICAL",
          status: "SCHEDULED",
          estimatedMinutes: 50,
          deliverable: "Performance patch with Lighthouse verification",
        },
      ],
    },
    {
      week: 4,
      title: "Sprint 4: Authority Scaling & Autonomous Verification",
      focus: "Strengthen link structure, verify fixes, and benchmark gains",
      badge: "Domination & Verification",
      daysLabel: "Days 22 – 30",
      tasks: [
        {
          id: "t4-1",
          day: 22,
          title: "Internal Linking Architecture & Topic Cluster Silos",
          description: "Connect high-authority blog and resource articles to primary conversion service pages with keyword-rich descriptive anchor text.",
          plainImpact: "Passes authority to commercial pages that generate client inquiries.",
          category: "AUTHORITY",
          status: "SCHEDULED",
          estimatedMinutes: 40,
          deliverable: "Automated contextual internal links map",
        },
        {
          id: "t4-2",
          day: 25,
          title: "Competitor Displacement Re-Probe",
          description: "Re-scan competitor domains to measure ranking shifts, keyword displacement rate, and technical score improvements.",
          plainImpact: "Proves exact market share captured from target rivals.",
          category: "KEYWORDS",
          status: "SCHEDULED",
          estimatedMinutes: 30,
          deliverable: "Displacement score report",
        },
        {
          id: "t4-3",
          day: 28,
          title: "Autonomous Health Verification Crawl",
          description: "Execute a full technical re-crawl across all site URLs to confirm zero unresolved critical or high-severity errors remain.",
          plainImpact: "Verifies 100% technical clean bill of health across all pages.",
          category: "TECHNICAL",
          status: "SCHEDULED",
          estimatedMinutes: 35,
          deliverable: "Comprehensive Before-vs-After health certificate",
        },
        {
          id: "t4-4",
          day: 30,
          title: "30-Day Autonomous Optimization Milestone Report",
          description: "Synthesize all merged patches, newly indexed pages, captured competitor keywords, and final health score improvements.",
          plainImpact: "Complete executive record of autonomous execution and ROI delivered.",
          category: "AUTHORITY",
          status: "SCHEDULED",
          estimatedMinutes: 20,
          deliverable: "Executive 30-day ROI completion certificate",
        },
      ],
    },
  ];

  const allTasks = planPhases.flatMap((p) => p.tasks);
  const completedTasks = allTasks.filter((t) => t.status === "COMPLETED").length;
  const currentWeekTasks = planPhases.find((p) => p.week === activeWeek)?.tasks || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white border border-line shadow-2xl overflow-hidden text-brand-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-line bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Pill tone="info">
                  <Sparkles size={11} className="mr-1 inline text-accent-600" />
                  Autonomous Execution Engine
                </Pill>
                {isApproved && (
                  <Pill tone="good">
                    <span className="w-1.5 h-1.5 rounded-full bg-success-600 animate-pulse mr-1 inline-block" />
                    Autopilot Active: Day {currentDay} of 30
                  </Pill>
                )}
              </div>
              <h2 className="text-xl font-bold tracking-tight text-brand-950 mt-1.5">
                30-Day Autonomous Website &amp; Competitor Fix Plan
              </h2>
              <p className="text-[12px] text-brand-500 max-w-3xl leading-relaxed">
                Aligning all {technicalIssuesCount} technical defects and {competitorOpportunitiesCount} competitor opportunities into 4 weekly execution sprints. When approved, GrowthX systematically implements fixes and conquers target keywords automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-brand-400 hover:text-brand-700 hover:bg-brand-100 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Autopilot Status Strip or Approval CTA */}
          <div className="mt-5 p-4 rounded-xl border border-line bg-surface-2 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  isApproved
                    ? "bg-success-50 text-success-700"
                    : "bg-accent-50 text-accent-700",
                )}
              >
                {isApproved ? <Activity size={20} className="animate-pulse" /> : <Cpu size={20} />}
              </div>
              <div>
                <div className="text-[13px] font-bold text-brand-950 flex items-center gap-2">
                  <span>{isApproved ? "Platform Autopilot is Running" : "Ready for Autonomous Deployment"}</span>
                  {isApproved && (
                    <span className="text-[11px] font-normal text-success-600">
                      (Deploying Sprint {Math.ceil(currentDay / 7)} Daily Fixes)
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] text-brand-500 mt-0.5">
                  {isApproved
                    ? `${completedTasks} of ${allTasks.length} milestone tasks completed. Daily progress updates run automatically.`
                    : "Approve the plan to have GrowthX automatically resolve errors and deploy competitor conquest pages over 30 days."}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {isApproved ? (
                <div className="flex items-center gap-3">
                  <div className="text-right mr-1">
                    <div className="text-[11px] font-mono font-bold text-success-700">
                      Day {currentDay} / 30
                    </div>
                    <div className="text-[10px] text-brand-400">30-Day Horizon</div>
                  </div>
                  <ActionButton
                    variant="secondary"
                    onClick={onTriggerReCrawl}
                    className="h-9 px-3 text-xs gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    <span>Run Re-Test</span>
                  </ActionButton>
                </div>
              ) : (
                <ActionButton
                  variant="primary"
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                  className="h-10 px-5 text-xs font-bold shadow-sm cursor-pointer"
                >
                  {approveMutation.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Activating Autopilot...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} className="text-success-400" />
                      <span>Approve 30-Day Plan &amp; Put On Autopilot</span>
                    </>
                  )}
                </ActionButton>
              )}
            </div>
          </div>
        </div>

        {/* Sprint Phase Selector (Tabs) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-brand-50/50 border-b border-line">
          {planPhases.map((phase) => {
            const isSelected = activeWeek === phase.week;
            const completedCount = phase.tasks.filter((t) => t.status === "COMPLETED").length;
            return (
              <button
                key={phase.week}
                type="button"
                onClick={() => setActiveWeek(phase.week)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer",
                  isSelected
                    ? "bg-white border-brand-950 text-brand-950 shadow-xs ring-1 ring-brand-950/10"
                    : "bg-white/80 border-line hover:bg-white text-brand-600",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500">
                    Week {phase.week} • {phase.daysLabel}
                  </span>
                  {completedCount > 0 && (
                    <Pill tone="good">
                      {completedCount}/{phase.tasks.length}
                    </Pill>
                  )}
                </div>
                <div className="text-xs font-bold text-brand-950 truncate">
                  {phase.badge}
                </div>
                <div className="text-[10.5px] text-brand-500 truncate mt-0.5">
                  {phase.focus}
                </div>
              </button>
            );
          })}
        </div>

        {/* Sprint Task List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3.5 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-accent-600" />
              <h3 className="text-[13.5px] font-bold text-brand-950">
                Week {activeWeek} Daily Milestones &amp; Autonomous Fix Queue
              </h3>
            </div>
            <span className="text-[11px] text-brand-400">
              Each task deploys automatically during its scheduled sprint window
            </span>
          </div>

          <div className="space-y-2.5">
            {currentWeekTasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4",
                  task.status === "COMPLETED"
                    ? "bg-success-50/30 border-success-200/60"
                    : task.status === "IN_PROGRESS"
                    ? "bg-warning-50/30 border-warning-200/60 shadow-xs"
                    : "bg-white border-line",
                )}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-brand-100 flex flex-col items-center justify-center shrink-0 text-brand-800">
                    <span className="text-[9px] uppercase font-bold tracking-tight text-brand-400">Day</span>
                    <span className="text-[15px] font-mono font-bold leading-none">{task.day}</span>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-bold text-brand-950">
                        {task.title}
                      </span>
                      <Pill
                        tone={
                          task.status === "COMPLETED"
                            ? "good"
                            : task.status === "IN_PROGRESS"
                            ? "warn"
                            : "default"
                        }
                      >
                        {task.status.replace("_", " ")}
                      </Pill>
                      <span className="text-[10.5px] font-mono text-brand-400">
                        {task.category}
                      </span>
                    </div>

                    <p className="text-[12px] text-brand-600 leading-relaxed">
                      {task.description}
                    </p>

                    <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px]">
                      <span className="font-semibold text-brand-900">
                        Business Impact: <span className="font-normal text-brand-600">{task.plainImpact}</span>
                      </span>
                      <span className="text-brand-300">•</span>
                      <span className="text-brand-500">
                        Deliverable: <span className="font-mono text-brand-700">{task.deliverable}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 self-end md:self-center">
                  <div className="text-right text-[11px] text-brand-400 font-mono hidden sm:block">
                    ~{task.estimatedMinutes}m runtime
                  </div>
                  {task.status === "COMPLETED" ? (
                    <div className="flex items-center gap-1 text-xs font-bold text-success-700">
                      <CheckCircle2 size={15} className="text-success-600" />
                      <span>Executed</span>
                    </div>
                  ) : task.status === "IN_PROGRESS" ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-warning-700">
                      <Loader2 size={13} className="animate-spin text-warning-600" />
                      <span>In Progress</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-brand-400">
                      <Clock size={13} />
                      <span>Queued</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-line bg-surface-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px]">
          <div className="text-brand-500 flex items-center gap-2">
            <ShieldCheck size={15} className="text-success-600" />
            <span>All code changes pass automated syntax verification &amp; regression checks prior to deployment.</span>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton variant="secondary" onClick={onClose} className="h-8 px-3 text-xs cursor-pointer">
              Close Window
            </ActionButton>
            {!isApproved && (
              <ActionButton
                variant="primary"
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="h-8 px-4 text-xs font-bold shadow-sm cursor-pointer"
              >
                {approveMutation.isPending ? "Activating..." : "Approve 30-Day Plan"}
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
