"use client";

import React, { useState } from "react";
import {
  Briefcase,
  Plus,
  Trash2,
  Sparkles,
  Check,
  Search,
  MoreVertical,
  Edit2,
  TrendingUp,
  Eye,
  MousePointer,
  ArrowRight,
  Copy,
  BarChart2,
  Rocket,
} from "lucide-react";
import { CircularScoreGauge } from "../circular-score-gauge";
import type { LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ServicesTabProps {
  localSeo: LocalSeoData | null | undefined;
}

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  description: string;
  views28d: number | null;
  viewsTrendPct: number | null;
  status: "Active" | "Pending" | "Inactive";
}

export function ServicesTab({ localSeo }: ServicesTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [selectedServiceForAi, setSelectedServiceForAi] = useState<string>("Fresh Cow Milk");
  const [aiGeneratedDescription, setAiGeneratedDescription] = useState(
    "Get 100% pure and natural cow milk sourced from trusted local farms. Fresh, healthy, and delivered daily to your doorstep."
  );
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initial user-managed services catalog
  const [services, setServices] = useState<ServiceItem[]>([
    {
      id: "svc-1",
      name: "Fresh Cow Milk",
      category: "Dairy Products",
      description: "100% pure and natural cow milk",
      views28d: localSeo ? 1200 : null,
      viewsTrendPct: localSeo ? 32 : null,
      status: "Active",
    },
    {
      id: "svc-2",
      name: "Buffalo Milk",
      category: "Dairy Products",
      description: "Rich and nutritious buffalo milk",
      views28d: localSeo ? 842 : null,
      viewsTrendPct: localSeo ? 18 : null,
      status: "Active",
    },
    {
      id: "svc-3",
      name: "Organic Milk",
      category: "Dairy Products",
      description: "Chemical-free, farm fresh milk",
      views28d: localSeo ? 612 : null,
      viewsTrendPct: localSeo ? 11 : null,
      status: "Active",
    },
    {
      id: "svc-4",
      name: "Paneer",
      category: "Dairy Products",
      description: "Fresh homemade paneer",
      views28d: localSeo ? 498 : null,
      viewsTrendPct: localSeo ? 25 : null,
      status: "Active",
    },
    {
      id: "svc-5",
      name: "Curd",
      category: "Dairy Products",
      description: "Thick and creamy curd",
      views28d: localSeo ? 421 : null,
      viewsTrendPct: localSeo ? 14 : null,
      status: "Active",
    },
    {
      id: "svc-6",
      name: "Ghee",
      category: "Dairy Products",
      description: "Pure and traditional ghee",
      views28d: localSeo ? 389 : null,
      viewsTrendPct: localSeo ? 27 : null,
      status: "Active",
    },
    {
      id: "svc-7",
      name: "Fresh Vegetables",
      category: "Groceries",
      description: "Daily fresh farm vegetables",
      views28d: localSeo ? 1100 : null,
      viewsTrendPct: localSeo ? 36 : null,
      status: "Active",
    },
    {
      id: "svc-8",
      name: "Home Delivery",
      category: "Services",
      description: "Doorstep delivery service",
      views28d: localSeo ? 950 : null,
      viewsTrendPct: localSeo ? 29 : null,
      status: "Active",
    },
  ]);

  // New service inputs
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceCategory, setNewServiceCategory] = useState("Dairy Products");
  const [newServiceDesc, setNewServiceDesc] = useState("");

  const serviceOpportunities = [
    { priority: "High", title: "Add \"Toned Milk\"", reason: "Commonly offered by competitors" },
    { priority: "High", title: "Add \"Double Toned Milk\"", reason: "High local search demand" },
    { priority: "Medium", title: "Add \"Buttermilk\"", reason: "Popular local product" },
    { priority: "Medium", title: "Add \"Flavored Milk\"", reason: "Growing customer interest" },
    { priority: "Low", title: "Add \"Milk Subscription\"", reason: "Attracts recurring customers" },
  ];

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;

    const newSvc: ServiceItem = {
      id: `svc-${newServiceName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${services.length + 1}`,
      name: newServiceName.trim(),
      category: newServiceCategory.trim() || "General",
      description: newServiceDesc.trim() || "Specialized local service offering.",
      views28d: null,
      viewsTrendPct: null,
      status: "Active",
    };

    setServices([...services, newSvc]);
    setNewServiceName("");
    setNewServiceDesc("");
    setIsAdding(false);
  };

  const handleAddOpportunity = (oppTitle: string) => {
    const cleanName = oppTitle.replace(/^Add\s*["']?|["']?$/g, "");
    const newSvc: ServiceItem = {
      id: `svc-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${services.length + 1}`,
      name: cleanName,
      category: "Dairy Products",
      description: `High-quality ${cleanName.toLowerCase()} prepared fresh for customers.`,
      views28d: null,
      viewsTrendPct: null,
      status: "Active",
    };
    setServices([...services, newSvc]);
  };

  const handleGenerateAiDescription = () => {
    setIsGeneratingAi(true);
    setTimeout(() => {
      setAiGeneratedDescription(
        `Premium quality ${selectedServiceForAi.toLowerCase()} prepared with authentic ingredients. Verified standards, fast doorstep dispatch, and satisfaction guaranteed in our local delivery radius.`
      );
      setIsGeneratingAi(false);
    }, 500);
  };

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(aiGeneratedDescription);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredServices = services.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
  });

  const optimizationScore = localSeo ? 80 : null;

  return (
    <div className="space-y-6">
      {/* ── Top Row: KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Services */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
              <Briefcase size={14} className="text-purple-600" />
              <span>Total Services</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
                {localSeo ? services.length : "—"}
              </span>
              {localSeo && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                  <TrendingUp size={10} />
                  +2 vs last 28 days
                </span>
              )}
            </div>
          </div>
          {/* Subtle sparkline */}
          <div className="mt-3 pt-2">
            <svg className="w-full h-8 text-purple-500 overflow-visible" viewBox="0 0 100 24" fill="none">
              <path d="M0 20 L25 15 L50 18 L75 10 L100 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Profile Views from Services */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
              <Eye size={14} className="text-blue-600" />
              <span>Profile Views from Services</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
                {localSeo ? "2.4K" : "—"}
              </span>
              {localSeo && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                  <TrendingUp size={10} />
                  +28% vs last 28 days
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2">
            <svg className="w-full h-8 text-emerald-500 overflow-visible" viewBox="0 0 100 24" fill="none">
              <path d="M0 18 Q 30 16, 60 10 T 100 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M0 18 Q 30 16, 60 10 T 100 4 L 100 24 L 0 24 Z" fill="currentColor" fillOpacity="0.08" />
            </svg>
          </div>
        </div>

        {/* Customer Actions */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
              <MousePointer size={14} className="text-blue-600" />
              <span>Customer Actions</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
                {localSeo ? "324" : "—"}
              </span>
              {localSeo && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                  <TrendingUp size={10} />
                  +18% vs last 28 days
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2">
            <svg className="w-full h-8 text-purple-500 overflow-visible" viewBox="0 0 100 24" fill="none">
              <path d="M0 18 Q 25 15, 55 12 T 100 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M0 18 Q 25 15, 55 12 T 100 5 L 100 24 L 0 24 Z" fill="currentColor" fillOpacity="0.08" />
            </svg>
          </div>
        </div>

        {/* Service Optimization Score */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500">
              Service Optimization Score
            </h3>
            {localSeo ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                Good
              </span>
            ) : (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
                Not Connected
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 my-auto">
            <CircularScoreGauge score={optimizationScore} size={84} strokeWidth={8} />
            <p className="text-[11px] text-brand-600 leading-tight">
              {localSeo
                ? "Your services are well optimized. Add more relevant services and detailed descriptions to increase visibility."
                : "Connect your profile to evaluate service catalog coverage and search ranking power."}
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-brand-100">
            <button
              type="button"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View Suggestions</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Add Service Modal / Inline Form ─────────────────────────── */}
      {isAdding && (
        <form onSubmit={handleAddService} className="p-5 rounded-2xl border border-blue-200 bg-blue-50/40 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
              Add New Service to Google Business Profile
            </h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-xs text-brand-500 hover:text-brand-950"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-brand-800 mb-1">Service Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Organic Cow Milk"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-800 mb-1">Category</label>
              <input
                type="text"
                placeholder="e.g. Dairy Products"
                value={newServiceCategory}
                onChange={(e) => setNewServiceCategory(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-800 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Detailed description of what is included in this service..."
              value={newServiceDesc}
              onChange={(e) => setNewServiceDesc(e.target.value)}
              className="w-full p-2.5 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 rounded-lg border border-brand-200 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
            >
              Save Service
            </button>
          </div>
        </form>
      )}

      {/* ── Main Section: Services Table (Left) & Opportunities + AI Optimizer (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Your Services Table (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-brand-950">
                  Your Services {localSeo && `(${services.length})`}
                </h3>
                <p className="text-xs text-brand-400">
                  Manage the services displayed on your Google Business Profile.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
                  <input
                    type="text"
                    placeholder="Search services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 pr-2.5 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950 w-44"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 transition shadow-xs"
                >
                  <Plus size={13} />
                  <span>Add Service</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-[11px] font-bold uppercase tracking-wider text-brand-400" style={{ borderColor: "var(--border-color)" }}>
                    <th className="pb-3">Service</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Views (28d)</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100">
                  {filteredServices.map((svc) => (
                    <tr key={svc.id} className="hover:bg-brand-50/50 transition">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                            {svc.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-brand-950 truncate">{svc.name}</p>
                            <p className="text-[11px] text-brand-400 truncate">{svc.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="rounded-md bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-semibold border border-blue-200">
                          {svc.category}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                          {svc.status}
                        </span>
                      </td>
                      <td className="py-3">
                        {svc.views28d != null ? (
                          <div className="font-mono text-xs">
                            <span className="font-bold text-brand-950">{svc.views28d}</span>
                            {svc.viewsTrendPct != null && (
                              <span className="text-[10px] text-emerald-700 ml-1 font-semibold">
                                ↑ +{svc.viewsTrendPct}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-brand-300 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedServiceForAi(svc.name);
                              setAiGeneratedDescription(svc.description);
                            }}
                            className="p-1 rounded text-brand-400 hover:text-brand-950 hover:bg-brand-100 transition"
                            title="Edit / Optimize"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded text-brand-400 hover:text-brand-950 hover:bg-brand-100 transition"
                          >
                            <MoreVertical size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Service Opportunities + Description Optimizer (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Service Opportunities */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                <h3 className="text-sm font-bold text-brand-950">Service Opportunities</h3>
              </div>
              <button type="button" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <span>View All</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <p className="text-xs text-brand-400">Based on competitor analysis and local search demand.</p>

            <div className="space-y-2 pt-1">
              {serviceOpportunities.map((opp) => (
                <div
                  key={opp.title}
                  className="p-2.5 rounded-xl border border-brand-100 hover:bg-brand-50/60 transition flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className={cn(
                          "text-[9.5px] font-bold px-1.5 py-0.2 rounded border",
                          opp.priority === "High"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : opp.priority === "Medium"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        )}
                      >
                        {opp.priority}
                      </span>
                      <p className="text-xs font-bold text-brand-950 truncate">{opp.title}</p>
                    </div>
                    <p className="text-[11px] text-brand-500 truncate">{opp.reason}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddOpportunity(opp.title)}
                    className="shrink-0 px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Plus size={11} />
                    <span>Add</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Service Description Optimizer */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-500">
              <Sparkles size={13} className="text-purple-600" />
              <span>Service Description Optimizer</span>
            </div>
            <p className="text-xs text-brand-400">Improve your service descriptions with AI.</p>

            <div className="flex items-center gap-2 pt-1">
              <select
                value={selectedServiceForAi}
                onChange={(e) => setSelectedServiceForAi(e.target.value)}
                className="flex-1 h-9 px-2.5 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-800 focus:outline-none"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleGenerateAiDescription}
                disabled={isGeneratingAi}
                className="px-3 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 transition shrink-0"
              >
                <Sparkles size={12} className={isGeneratingAi ? "animate-spin" : ""} />
                <span>Generate with AI</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-brand-50/70 border border-brand-200 text-xs text-brand-800 leading-relaxed space-y-2">
              <p>{aiGeneratedDescription}</p>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                >
                  <Copy size={11} />
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Compare with Competitors & AI Banner ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Compare with Competitors */}
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex items-center justify-between gap-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
              <BarChart2 size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-brand-950">Compare with Competitors</h4>
              <p className="text-xs text-brand-500 mt-0.5">
                See which services your competitors offer and find new opportunities.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-lg border border-brand-200 text-xs font-semibold text-brand-800 hover:bg-brand-50 transition shrink-0"
          >
            View Competitor Services →
          </button>
        </div>

        {/* Optimize Services for More Visibility */}
        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Rocket size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-brand-950">Optimize Services for More Visibility</h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                Add relevant services with detailed descriptions to attract more customers.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs shrink-0"
          >
            Get AI Suggestions →
          </button>
        </div>
      </div>
    </div>
  );
}
