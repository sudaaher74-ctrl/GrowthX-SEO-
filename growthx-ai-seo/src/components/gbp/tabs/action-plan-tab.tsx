"use client";

import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Search,
  ListTodo,
  Rocket,
  Check,
  Clock,
  ChevronRight,
  Filter,
  FileText,
  Tag,
  Layers,
  Image as ImageIcon,
  Star,
  MessageSquare,
  HelpCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Bot,
  Eye,
  Edit2,
  Upload,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { GbpStoreIcon } from "../gbp-icons";
import type { LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ActionPlanTabProps {
  localSeo: LocalSeoData | null | undefined;
}

type TaskFilter = "All Tasks" | "Auto Tasks" | "Needs Input" | "Optional";

interface PlanTaskItem {
  id: string;
  rank: number;
  iconType: "description" | "services" | "categories" | "photos" | "reviews" | "posts" | "hours" | "faqs" | "citations" | "messaging" | "attributes" | "social";
  title: string;
  description: string;
  impact: "High Impact" | "Medium Impact" | "Low Impact";
  type: "Auto" | "Needs Input" | "Optional";
  duration: string;
  primaryAction: "Edit" | "Preview" | "Upload";
  hasSecondaryPreview?: boolean;
  targetTab?: string;
  proposedChange?: string;
  status: "Pending" | "Executing" | "Completed";
}

export function ActionPlanTab({ localSeo }: ActionPlanTabProps) {
  const businessName = localSeo?.businessName || "MilQuu Fresh";

  const [activeFilter, setActiveFilter] = useState<TaskFilter>("All Tasks");
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [isAutomating, setIsAutomating] = useState(false);
  const [automationSuccess, setAutomationSuccess] = useState(false);
  const [activeModalTask, setActiveModalTask] = useState<PlanTaskItem | null>(null);

  // Full 12-task action plan dataset
  const [tasks, setTasks] = useState<PlanTaskItem[]>([
    {
      id: "tsk-1",
      rank: 1,
      iconType: "description",
      title: "Optimize Business Description",
      description: "Replace with an SEO-friendly, keyword-rich description.",
      impact: "High Impact",
      type: "Auto",
      duration: "5 mins",
      primaryAction: "Edit",
      hasSecondaryPreview: true,
      targetTab: "business-info",
      proposedChange: `Premium pure dairy & fresh farm products delivered daily across Pune. Sourced directly from local verified farms with rigorous cold-chain quality standards.`,
      status: "Pending",
    },
    {
      id: "tsk-2",
      rank: 2,
      iconType: "services",
      title: "Add Relevant Services",
      description: "Add 4 new services (e.g. Milk Delivery, Fresh Vegetables).",
      impact: "High Impact",
      type: "Auto",
      duration: "3 mins",
      primaryAction: "Edit",
      targetTab: "services",
      proposedChange: "Services to add: Fresh Cow Milk, Buffalo Milk, Farm Fresh Vegetables, Subscription Home Delivery.",
      status: "Pending",
    },
    {
      id: "tsk-3",
      rank: 3,
      iconType: "categories",
      title: "Update Categories",
      description: "Add 2-3 relevant secondary categories.",
      impact: "High Impact",
      type: "Auto",
      duration: "2 mins",
      primaryAction: "Edit",
      targetTab: "categories",
      proposedChange: "Add secondary categories: Milk Delivery Service, Organic Food Store, Grocery Store.",
      status: "Pending",
    },
    {
      id: "tsk-4",
      rank: 4,
      iconType: "photos",
      title: "Add Photos",
      description: "Upload product, store, and delivery photos.",
      impact: "Medium Impact",
      type: "Needs Input",
      duration: "10 mins",
      primaryAction: "Upload",
      targetTab: "photos",
      proposedChange: "Upload 5 exterior storefront photos, 5 product shots, and 3 packaging delivery pictures.",
      status: "Pending",
    },
    {
      id: "tsk-5",
      rank: 5,
      iconType: "reviews",
      title: "Generate Review Responses",
      description: "Auto-reply to 12 pending reviews.",
      impact: "High Impact",
      type: "Auto",
      duration: "5 mins",
      primaryAction: "Preview",
      targetTab: "reviews",
      proposedChange: "AI drafted warm, professional replies referencing customer names and specific products praised.",
      status: "Pending",
    },
    {
      id: "tsk-6",
      rank: 6,
      iconType: "posts",
      title: "Create & Schedule Posts",
      description: "Schedule 4 posts for the next 30 days.",
      impact: "Medium Impact",
      type: "Auto",
      duration: "5 mins",
      primaryAction: "Preview",
      targetTab: "posts",
      proposedChange: "4 pre-scheduled Google posts covering farm-fresh delivery, seasonal offers, and subscriber discounts.",
      status: "Pending",
    },
    {
      id: "tsk-7",
      rank: 7,
      iconType: "hours",
      title: "Update Business Hours",
      description: "Set special hours for upcoming holidays.",
      impact: "Low Impact",
      type: "Auto",
      duration: "2 mins",
      primaryAction: "Edit",
      targetTab: "business-info",
      proposedChange: "Synchronize standard 6:00 AM - 9:00 PM operating schedule and upcoming festive hours.",
      status: "Pending",
    },
    {
      id: "tsk-8",
      rank: 8,
      iconType: "faqs",
      title: "Add FAQs",
      description: "Add common customer questions & answers.",
      impact: "Medium Impact",
      type: "Auto",
      duration: "5 mins",
      primaryAction: "Edit",
      targetTab: "overview",
      proposedChange: "Common queries: delivery cutoff times, pasteurization methods, packaging sustainability.",
      status: "Pending",
    },
    {
      id: "tsk-9",
      rank: 9,
      iconType: "citations",
      title: "Audit Citation Consistency",
      description: "Verify NAP (Name, Address, Phone) consistency across major web directories.",
      impact: "High Impact",
      type: "Auto",
      duration: "5 mins",
      primaryAction: "Edit",
      targetTab: "business-info",
      proposedChange: "Standardize Pune address formatting across Justdial, Sulekha, and Apple Maps.",
      status: "Pending",
    },
    {
      id: "tsk-10",
      rank: 10,
      iconType: "messaging",
      title: "Enable Google Messaging",
      description: "Turn on direct chat so local customers can message for delivery orders.",
      impact: "Medium Impact",
      type: "Needs Input",
      duration: "5 mins",
      primaryAction: "Edit",
      targetTab: "overview",
      proposedChange: "Configure notification email and default instant auto-responder message.",
      status: "Pending",
    },
    {
      id: "tsk-11",
      rank: 11,
      iconType: "attributes",
      title: "Set Up Opening Date & Attributes",
      description: "Add wheelchair accessibility, online payments, and storefront amenities.",
      impact: "Low Impact",
      type: "Optional",
      duration: "3 mins",
      primaryAction: "Edit",
      targetTab: "business-info",
      proposedChange: "Select UPI, Card payments, curbside pickup, and door delivery attributes.",
      status: "Pending",
    },
    {
      id: "tsk-12",
      rank: 12,
      iconType: "social",
      title: "Add Social Profile Links",
      description: "Link Instagram, Facebook, and WhatsApp business profiles to your GBP listing.",
      impact: "Low Impact",
      type: "Optional",
      duration: "4 mins",
      primaryAction: "Edit",
      targetTab: "business-info",
      proposedChange: "Add official social URLs for enhanced cross-network Google entity recognition.",
      status: "Pending",
    },
  ]);

  const autoCount = tasks.filter((t) => t.type === "Auto").length;
  const needsInputCount = tasks.filter((t) => t.type === "Needs Input").length;
  const optionalCount = tasks.filter((t) => t.type === "Optional").length;

  const handleStartAutomation = () => {
    setIsAutomating(true);
    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) => (t.type === "Auto" ? { ...t, status: "Completed" } : t))
      );
      setIsAutomating(false);
      setAutomationSuccess(true);
    }, 1200);
  };

  const filteredTasks = tasks.filter((t) => {
    if (activeFilter === "All Tasks") return true;
    if (activeFilter === "Auto Tasks") return t.type === "Auto";
    if (activeFilter === "Needs Input") return t.type === "Needs Input";
    if (activeFilter === "Optional") return t.type === "Optional";
    return true;
  });

  const visibleTasks = showAllTasks ? filteredTasks : filteredTasks.slice(0, 8);

  const getTaskIcon = (type: PlanTaskItem["iconType"]) => {
    switch (type) {
      case "description":
        return <FileText size={16} className="text-emerald-600" />;
      case "services":
        return <Tag size={16} className="text-purple-600" />;
      case "categories":
        return <Layers size={16} className="text-amber-600" />;
      case "photos":
        return <ImageIcon size={16} className="text-blue-600" />;
      case "reviews":
        return <Star size={16} className="text-emerald-600 fill-emerald-600" />;
      case "posts":
        return <MessageSquare size={16} className="text-pink-600" />;
      case "hours":
        return <Clock size={16} className="text-blue-600" />;
      case "faqs":
        return <HelpCircle size={16} className="text-rose-600" />;
      default:
        return <Sparkles size={16} className="text-indigo-600" />;
    }
  };

  const getTaskIconBg = (type: PlanTaskItem["iconType"]) => {
    switch (type) {
      case "description":
        return "bg-emerald-50 border-emerald-100";
      case "services":
        return "bg-purple-50 border-purple-100";
      case "categories":
        return "bg-amber-50 border-amber-100";
      case "photos":
        return "bg-blue-50 border-blue-100";
      case "reviews":
        return "bg-emerald-50 border-emerald-100";
      case "posts":
        return "bg-pink-50 border-pink-100";
      case "hours":
        return "bg-blue-50 border-blue-100";
      case "faqs":
        return "bg-rose-50 border-rose-100";
      default:
        return "bg-indigo-50 border-indigo-100";
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header Title & Re-analyze ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <GbpStoreIcon className="w-11 h-11 shrink-0" />
          <div>
            <div className="text-[11px] font-semibold text-brand-500 flex items-center gap-1.5">
              <span>Google Business Profile</span>
              <span>&gt;</span>
              <span className="text-brand-800">Action Plan</span>
            </div>
            <h1 className="text-lg font-bold text-brand-950 tracking-tight">Your Google Business Profile Action Plan</h1>
            <p className="text-xs text-brand-500 max-w-2xl">
              We&apos;ve analyzed your business and 12 competitors. Here&apos;s your personalized plan. Approve once and
              GrowthX will execute the changes automatically.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>Last analyzed: 4 Sep 2026, 3:48 PM</span>
          </div>

          <button
            type="button"
            onClick={handleStartAutomation}
            disabled={isAutomating}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-brand-200 bg-white text-xs font-semibold text-brand-800 hover:bg-brand-50 shadow-2xs"
          >
            <RefreshCw size={13} className={cn(isAutomating && "animate-spin")} />
            <span>Re-analyze</span>
          </button>
        </div>
      </div>

      {/* ── 4-Step Execution Flow Banner ─────────────────────────────── */}
      <div
        className="rounded-2xl border bg-white p-5 shadow-xs"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          {/* Step 1: Analyze */}
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Search size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-brand-950">1. Analyze</div>
                <div className="text-[11px] text-brand-500 leading-tight">We analyze your profile and competitors</div>
              </div>
            </div>
            <ArrowRight size={14} className="hidden lg:block text-brand-300 pr-2" />
          </div>

          {/* Step 2: Create Plan */}
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ListTodo size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-brand-950">2. Create Plan</div>
                <div className="text-[11px] text-brand-500 leading-tight">AI creates a personalized action plan</div>
              </div>
            </div>
            <ArrowRight size={14} className="hidden lg:block text-brand-300 pr-2" />
          </div>

          {/* Step 3: Your Approval */}
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Check size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-brand-950">3. Your Approval</div>
                <div className="text-[11px] text-brand-500 leading-tight">Review and approve</div>
              </div>
            </div>
            <ArrowRight size={14} className="hidden lg:block text-brand-300 pr-2" />
          </div>

          {/* Step 4: We Execute */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Rocket size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-brand-950">4. We Execute</div>
                <div className="text-[11px] text-brand-500 leading-tight">GrowthX does the work automatically</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Grid: Tasks List & Right Sidebar ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (8 cols): Action Plan Tasks */}
        <div
          className="lg:col-span-8 rounded-2xl border bg-white p-5 shadow-xs space-y-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-brand-950">Action Plan ({tasks.length} tasks)</h2>
              <p className="text-xs text-brand-500">
                These are the most important actions to improve your visibility. You can review, edit or disable any
                task.
              </p>
            </div>

            {/* Filter Dropdown */}
            <div className="relative shrink-0">
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as TaskFilter)}
                className="h-8 pl-7 pr-4 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-800 focus:outline-none"
              >
                <option value="All Tasks">All Tasks ({tasks.length})</option>
                <option value="Auto Tasks">Auto ({autoCount})</option>
                <option value="Needs Input">Needs Input ({needsInputCount})</option>
                <option value="Optional">Optional ({optionalCount})</option>
              </select>
              <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
            </div>
          </div>

          {/* Task Rows List */}
          <div className="space-y-2.5 pt-1">
            {visibleTasks.map((task) => {
              const isDone = task.status === "Completed";

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-xl border transition-all",
                    isDone
                      ? "bg-emerald-50/25 border-emerald-200"
                      : "bg-white border-brand-100 hover:border-brand-200 hover:shadow-2xs"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                    {/* Number Rank */}
                    <span className="text-xs font-semibold text-brand-400 w-4 text-center shrink-0">
                      {isDone ? <Check size={14} className="text-emerald-600 inline" /> : task.rank}
                    </span>

                    {/* Category Icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-xl border flex items-center justify-center shrink-0",
                        getTaskIconBg(task.iconType)
                      )}
                    >
                      {getTaskIcon(task.iconType)}
                    </div>

                    {/* Task Title & Description */}
                    <div className="min-w-0 flex-1">
                      <h4
                        className={cn(
                          "text-xs font-bold truncate",
                          isDone ? "text-emerald-900 line-through" : "text-brand-950"
                        )}
                      >
                        {task.title}
                      </h4>
                      <p className="text-[11px] text-brand-500 truncate">{task.description}</p>
                    </div>

                    {/* Badges */}
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                          task.impact === "High Impact"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : task.impact === "Medium Impact"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        )}
                      >
                        {task.impact}
                      </span>

                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-0.5",
                          task.type === "Auto"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : task.type === "Needs Input"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-50 text-slate-700 border border-slate-200"
                        )}
                      >
                        {task.type === "Auto" && <Zap size={10} className="fill-emerald-600 text-emerald-600" />}
                        <span>{task.type}</span>
                      </span>

                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200">
                        {task.duration}
                      </span>
                    </div>
                  </div>

                  {/* Actions (Right) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {task.hasSecondaryPreview && (
                      <button
                        type="button"
                        onClick={() => setActiveModalTask(task)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 shadow-2xs"
                      >
                        Preview
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveModalTask(task)}
                      className={cn(
                        "px-2.5 py-1 text-xs font-semibold rounded-lg border shadow-2xs transition-all",
                        task.primaryAction === "Upload"
                          ? "border-blue-200 bg-white text-blue-600 hover:bg-blue-50"
                          : task.primaryAction === "Preview"
                          ? "border-blue-200 bg-white text-blue-600 hover:bg-blue-50"
                          : "border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
                      )}
                    >
                      {task.primaryAction}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModalTask(task)}
                      className="p-1 text-brand-400 hover:text-brand-700"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show More / Show Less Button */}
          {filteredTasks.length > 8 && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowAllTasks(!showAllTasks)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                {showAllTasks ? (
                  <>
                    <span>- Show less tasks</span>
                    <ChevronUp size={13} />
                  </>
                ) : (
                  <>
                    <span>+ Show {filteredTasks.length - 8} more tasks</span>
                    <ChevronDown size={13} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right (4 cols): Plan Summary, Automation CTA & What Happens Next */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: Plan Summary */}
          <div
            className="rounded-2xl border bg-white p-5 shadow-xs space-y-4"
            style={{ borderColor: "var(--border-color)" }}
          >
            <h3 className="text-xs font-bold text-brand-950">Plan Summary</h3>

            {/* Circular Donut Representation */}
            <div className="flex items-center justify-center py-2">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background ring */}
                  <circle cx="50" cy="50" r="38" stroke="#E2E8F0" strokeWidth="10" fill="transparent" />
                  {/* Auto segment: 8/12 = 66.6% -> strokeDasharray="159 238" */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="#10B981"
                    strokeWidth="10"
                    strokeDasharray="159 238"
                    strokeDashoffset="0"
                    fill="transparent"
                  />
                  {/* Needs Input segment: 2/12 = 16.6% */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="#F59E0B"
                    strokeWidth="10"
                    strokeDasharray="40 238"
                    strokeDashoffset="-159"
                    fill="transparent"
                  />
                  {/* Optional segment: 2/12 = 16.6% */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="#EF4444"
                    strokeWidth="10"
                    strokeDasharray="40 238"
                    strokeDashoffset="-199"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="text-2xl font-black text-brand-950">{tasks.length}</div>
                  <div className="text-[11px] font-medium text-brand-500">Tasks</div>
                </div>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-2 text-xs pt-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-brand-700 font-medium">{autoCount} Auto (No input needed)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-brand-700 font-medium">{needsInputCount} Needs your input</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-brand-700 font-medium">{optionalCount} Optional</span>
              </div>
            </div>

            {/* Impact Banner */}
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900 font-medium">
              <TrendingUp size={14} className="text-emerald-600 shrink-0" />
              <span>Est. +62% more profile views based on similar businesses</span>
            </div>
          </div>

          {/* Card 2: Let GrowthX Do the Work */}
          <div
            className="rounded-2xl border bg-white p-5 shadow-xs space-y-4"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Bot size={18} />
              </div>
              <h3 className="text-xs font-bold text-brand-950">Let GrowthX Do the Work</h3>
            </div>

            <p className="text-xs text-brand-600 leading-relaxed">
              After you approve, we&apos;ll automatically apply all selected changes to your Google Business Profile,
              monitor the results, and keep optimizing.
            </p>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleStartAutomation}
                disabled={isAutomating}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <Zap size={14} className={cn("fill-white text-white", isAutomating && "animate-pulse")} />
                <span>
                  {isAutomating
                    ? "Applying Automation…"
                    : automationSuccess
                    ? "Automation Activated!"
                    : "Approve & Start Automation"}
                </span>
              </button>
              <div className="text-[11px] text-brand-400 text-center">You can pause or modify anytime.</div>
            </div>

            {/* Safe & Secure Box */}
            <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/80 flex items-start gap-2.5">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-emerald-950">Safe &amp; Secure</div>
                <p className="text-[11px] text-emerald-800 leading-tight">
                  We only make changes after your approval. Your data is always secure.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: What Happens Next? */}
          <div
            className="rounded-2xl border bg-white p-5 shadow-xs space-y-3"
            style={{ borderColor: "var(--border-color)" }}
          >
            <h3 className="text-xs font-bold text-brand-950">What Happens Next?</h3>

            <div className="space-y-3 text-xs pt-1">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </span>
                <span className="text-brand-700">We&apos;ll start executing the approved tasks</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </span>
                <span className="text-brand-700">You&apos;ll get notified as changes are applied</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </span>
                <span className="text-brand-700">We&apos;ll monitor the impact on your rankings, views and customer actions</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  4
                </span>
                <span className="text-brand-700">AI will continue to suggest new opportunities</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Task Details / Edit Modal ─────────────────────────────────── */}
      {activeModalTask && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-brand-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0",
                    getTaskIconBg(activeModalTask.iconType)
                  )}
                >
                  {getTaskIcon(activeModalTask.iconType)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-950">{activeModalTask.title}</h3>
                  <p className="text-xs text-brand-500">{activeModalTask.description}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModalTask(null)}
                className="text-brand-400 hover:text-brand-700 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-100 text-xs space-y-2">
              <div className="font-bold text-brand-900">Proposed Action:</div>
              <p className="text-brand-700 leading-relaxed">{activeModalTask.proposedChange}</p>
            </div>

            <div className="flex items-center justify-between text-xs text-brand-500 pt-1">
              <span>Estimated execution: {activeModalTask.duration}</span>
              <span className="font-semibold text-emerald-700">{activeModalTask.impact}</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-100">
              <button
                type="button"
                onClick={() => setActiveModalTask(null)}
                className="px-3.5 py-1.5 rounded-lg border border-brand-200 bg-white text-xs font-semibold text-brand-700 hover:bg-brand-50"
              >
                Cancel
              </button>

              <a
                href={`?tab=${activeModalTask.targetTab || "overview"}`}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-xs"
              >
                Go to {activeModalTask.targetTab} tab &rarr;
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
