"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Video } from "lucide-react";
import { api } from "@/lib/api-client";interface SocialCalendarPanelProps {
  projectId: string;
  businessName: string;
}

export function SocialCalendarPanel({ projectId, businessName }: SocialCalendarPanelProps) {
  const queryClient = useQueryClient();
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");

  // Fetch calendar items
  const calendarQuery = useQuery({
    queryKey: ["calendar-items", projectId],
    queryFn: () => api.listCalendarItems(projectId),
    enabled: Boolean(projectId),
  });

  // Grounded schedule days
  const scheduleDays = [
    {
      day: "Monday",
      focus: "Pattern Interrupt / Problem Reel",
      platform: "Instagram & TikTok",
      format: "Reels (15-30s)",
      targetAudience: "First-time prospective buyers",
      sampleTitle: `Why standard supplies fail quality audits — and the 3 things to check.`,
      status: "Scheduled",
      time: "10:30 AM",
    },
    {
      day: "Tuesday",
      focus: "Industry Transparency & Breakdown",
      platform: "LinkedIn & X",
      format: "Text + Infographic Carousel",
      targetAudience: "Operations & Procurement Leads",
      sampleTitle: `The real cost of choosing the cheapest supplier: a 12-month math breakdown.`,
      status: "In Production",
      time: "2:00 PM",
    },
    {
      day: "Wednesday",
      focus: "Behind-the-Scenes Manufacturing / Lab",
      platform: "YouTube Shorts",
      format: "Shorts (20-40s)",
      targetAudience: "Engaged research prospects",
      sampleTitle: `Watch our stress-test lab verify batches before final fulfillment.`,
      status: "Draft",
      time: "11:00 AM",
    },
    {
      day: "Thursday",
      focus: "Direct Competitor Alternative Challenge",
      platform: "Instagram Reels",
      format: "Reels (15-30s)",
      targetAudience: "Evaluating buyers choosing between rivals",
      sampleTitle: `Side-by-side durability test: Market leader sample vs ${businessName}.`,
      status: "Scheduled",
      time: "4:30 PM",
    },
    {
      day: "Friday",
      focus: "Customer Outcome & In-Depth Masterclass",
      platform: "YouTube Video",
      format: "Long-form (8-12m)",
      targetAudience: "High-consideration decision makers",
      sampleTitle: `Complete Buyer's Guide: Technical standards, grades and procurement tips.`,
      status: "Draft",
      time: "1:00 PM",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-950 text-white shadow-sm">
                <Calendar size={16} />
              </div>
              <h3 className="text-[16px] font-bold text-brand-950">
                Weekly Multi-Channel Publishing Cadence
              </h3>
            </div>
            <p className="text-[12px] text-brand-500 mt-1">
              Consistent omni-channel publishing calendar balancing top-of-funnel viral hooks with deep technical conversion proof.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-200">
              Target Cadence: 5 Posts / Week
            </span>
          </div>
        </div>
      </div>

      {/* 2. Weekly Calendar Timeline */}
      <div className="space-y-3">
        {scheduleDays.map((slot) => (
          <div
            key={slot.day}
            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-center border" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-[12px] font-bold text-brand-950">{slot.day.slice(0, 3)}</span>
                  <span className="text-[10px] font-mono text-brand-400 font-semibold">{slot.time}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-brand-950 px-2 py-0.5 text-[10px] font-bold uppercase text-white font-mono">
                      {slot.platform}
                    </span>
                    <span className="text-[11px] font-semibold text-brand-500 font-mono">
                      {slot.format}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.2 text-[10px] font-bold uppercase ${
                        slot.status === "Scheduled"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : slot.status === "In Production"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-brand-50 text-brand-500 border border-brand-200"
                      }`}
                    >
                      {slot.status}
                    </span>
                  </div>

                  <h4 className="text-[13px] font-bold text-brand-950">
                    &quot;{slot.sampleTitle}&quot;
                  </h4>

                  <p className="text-[11px] text-brand-500">
                    Content Focus: <strong>{slot.focus}</strong> • Target Audience: {slot.targetAudience}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1 rounded-xl border bg-white px-3 py-1.5 text-[11px] font-semibold text-brand-800 shadow-2xs hover:bg-brand-50 transition" style={{ borderColor: "var(--border-color)" }}>
                  <Video size={12} />
                  <span>View Script</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
