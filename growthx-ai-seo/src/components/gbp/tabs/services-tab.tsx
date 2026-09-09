"use client";

import React from "react";
import { Briefcase, ExternalLink } from "lucide-react";
import { GoogleGLogo } from "../gbp-icons";
import type { LocalSeoData } from "@/lib/api-client";

interface ServicesTabProps {
  localSeo: LocalSeoData | null | undefined;
}

export function ServicesTab({ localSeo }: ServicesTabProps) {
  const businessName = localSeo?.businessName;

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl border bg-white p-10 shadow-xs flex flex-col items-center text-center gap-3"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
          <Briefcase size={22} />
        </div>
        <h2 className="text-sm font-bold text-brand-950">Services data not available</h2>
        <p className="text-xs text-brand-500 max-w-md leading-relaxed">
          {businessName ? `${businessName}'s` : "This profile's"} services catalog, per-service view counts, and
          engagement trends are not fetched by GrowthX yet — there is no connected data source for them. Manage
          services directly on Google, or ask GrowthX to add a services integration.
        </p>
        {businessName && localSeo?.address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              businessName + " " + localSeo.address
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 px-3.5 py-2 rounded-lg border border-brand-200 bg-white text-xs font-semibold text-brand-800 hover:bg-brand-50 shadow-2xs transition"
          >
            <GoogleGLogo size={14} />
            <span>Edit services on Google</span>
            <ExternalLink size={12} className="text-brand-400" />
          </a>
        )}
      </div>
    </div>
  );
}
