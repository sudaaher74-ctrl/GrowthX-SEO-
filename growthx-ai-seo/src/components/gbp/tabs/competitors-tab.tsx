"use client";

import React from "react";
import { Users, ArrowRight } from "lucide-react";
import type { GbpTabKey } from "../gbp-tabs";
import type { LocalSeoData } from "@/lib/api-client";

interface CompetitorsTabProps {
  localSeo: LocalSeoData | null | undefined;
  projectId: string | null;
  onSelectTab?: (tab: GbpTabKey) => void;
}

export function CompetitorsTab({ localSeo, onSelectTab }: CompetitorsTabProps) {
  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl border bg-white p-10 shadow-xs flex flex-col items-center text-center gap-3"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <Users size={22} />
        </div>
        <h2 className="text-sm font-bold text-brand-950">No competitor data yet</h2>
        <p className="text-xs text-brand-500 max-w-md leading-relaxed">
          Competitor businesses are surfaced from the local search results returned by a GeoGrid scan — a
          dedicated competitors directory isn&apos;t collected separately. Run a scan from Local Rankings for a
          keyword to see which businesses outrank {localSeo?.businessName || "you"} at each nearby search point.
        </p>
        {onSelectTab && (
          <button
            type="button"
            onClick={() => onSelectTab("rankings")}
            className="inline-flex items-center gap-1.5 mt-2 px-3.5 py-2 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition"
          >
            <span>Go to Local Rankings</span>
            <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
