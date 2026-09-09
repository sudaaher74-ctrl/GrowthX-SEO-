"use client";

import React, { useState } from "react";
import {
  Tag,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Search,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface CategoriesTabProps {
  localSeo: LocalSeoData | null | undefined;
}

export function CategoriesTab({ localSeo }: CategoriesTabProps) {
  const [primaryCategory, setPrimaryCategory] = useState("Dental Clinic");
  const [secondaryCategories, setSecondaryCategories] = useState<string[]>([
    "Dentist",
    "Cosmetic Dentist",
    "Teeth Whitening Service",
  ]);
  const [newCatInput, setNewCatInput] = useState("");

  const competitorCategoryGaps = [
    { name: "Emergency Dental Service", rivalsCount: 4, impact: "High Impact" },
    { name: "Dental Implants Periodontist", rivalsCount: 3, impact: "High Impact" },
    { name: "Orthodontist", rivalsCount: 3, impact: "Medium Impact" },
    { name: "Pediatric Dentist", rivalsCount: 2, impact: "Medium Impact" },
  ];

  const handleAddCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || secondaryCategories.includes(trimmed)) return;
    setSecondaryCategories([...secondaryCategories, trimmed]);
    setNewCatInput("");
  };

  const handleRemoveCategory = (cat: string) => {
    setSecondaryCategories(secondaryCategories.filter((c) => c !== cat));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border shadow-xs" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <h2 className="text-sm font-bold text-brand-950">GBP Categories Optimization</h2>
          <p className="text-xs text-brand-500">
            Categories heavily influence which search queries trigger your Google 3-Pack placement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            {1 + secondaryCategories.length} Categories Configured
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configured Categories (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Primary Category */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-1.5">
                <Tag size={13} className="text-blue-600" />
                <span>Primary Category</span>
              </h3>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Primary Ranking Factor
              </span>
            </div>

            <p className="text-xs text-brand-500">
              The single most important category describing your entire business.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={primaryCategory}
                onChange={(e) => setPrimaryCategory(e.target.value)}
                className="flex-1 h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white font-semibold text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
              />
              <button
                type="button"
                className="px-3 h-9 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90"
              >
                Update
              </button>
            </div>
          </div>

          {/* Secondary Categories */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-1.5">
                <Tag size={13} className="text-purple-600" />
                <span>Secondary Categories ({secondaryCategories.length}/9)</span>
              </h3>
            </div>

            <p className="text-xs text-brand-500">
              Add up to 9 secondary categories to capture long-tail and specialized local searches.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {secondaryCategories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-900"
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat)}
                    className="text-brand-400 hover:text-rose-600 transition"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Category input */}
            <div className="pt-2 flex items-center gap-2">
              <input
                type="text"
                placeholder="Type additional category name..."
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory(newCatInput);
                  }
                }}
                className="flex-1 h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950"
              />
              <button
                type="button"
                onClick={() => handleAddCategory(newCatInput)}
                disabled={!newCatInput.trim()}
                className="px-3 h-9 rounded-lg border border-brand-200 bg-white hover:bg-brand-50 text-brand-800 text-xs font-semibold flex items-center gap-1 transition disabled:opacity-40"
              >
                <Plus size={13} />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Competitor Gap Analysis (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3.5" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-500">
              <Sparkles size={13} className="text-amber-500" />
              <span>Competitor Category Gaps</span>
            </div>

            <p className="text-xs text-brand-500 leading-normal">
              These categories are used by your top 3 local Google Maps competitors, but are missing from your profile:
            </p>

            <div className="space-y-2 pt-1">
              {competitorCategoryGaps.map((gap) => (
                <div
                  key={gap.name}
                  className="p-3 rounded-xl border border-brand-100 bg-brand-50/40 flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-brand-950 truncate">{gap.name}</p>
                    <p className="text-[10px] text-brand-500">Used by {gap.rivalsCount} nearby rivals</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      {gap.impact}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddCategory(gap.name)}
                      className="p-1.5 rounded-lg bg-white border border-brand-200 text-brand-700 hover:text-brand-950 hover:bg-brand-100 transition shadow-2xs"
                      title="Add to secondary categories"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
