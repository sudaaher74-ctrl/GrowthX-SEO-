"use client";

import { useState } from "react";
import {
  Building2,
  Calendar,
  Check,
  Compass,
  Copy,
  FileCode2,
  Layers,
  MapPin,
  Sparkles,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";
import { Panel, Pill } from "@/components/ui/console";
import type {
  ReportBusinessContext,
  ReportGrowthPlaybook,
  ReportMethodCategory,
  ReportReadyAssetKind,
} from "@/lib/api-types";

const TIER_META = {
  conservative: { label: "Conservative", tone: "default" as const, sub: "Quick wins & fixes" },
  realistic: { label: "Realistic", tone: "info" as const, sub: "Core playbook applied" },
  aggressive: { label: "Aggressive", tone: "good" as const, sub: "Full local dominance" },
};

const LEVEL_TONE = {
  high: "bad" as const,
  medium: "warn" as const,
  low: "default" as const,
};

const IMPACT_TONE = {
  high: "good" as const,
  medium: "info" as const,
  low: "default" as const,
};

const CATEGORY_LABEL: Record<ReportMethodCategory, string> = {
  TECHNICAL: "Technical",
  HYPER_LOCAL: "Hyper-Local",
  CONTENT: "Content",
  CONVERSION: "Conversion",
  OFF_SITE_AUTHORITY: "Off-Site & Maps",
  AI_CITATIONS: "AI Citations",
  ANALYTICS: "Analytics & Tracking",
};

const ASSET_LABEL: Record<ReportReadyAssetKind, string> = {
  TITLE_META: "Title & Meta",
  LANDING_PAGE_BRIEF: "Page Brief",
  FAQ_BLOCK: "FAQ Block",
  AI_QUOTABLE_SUMMARY: "AI-Quotable Answer",
  GBP_POST: "Google Maps Post",
  SCHEMA_SNIPPET: "Structured Data",
  CONVERSION_CTA: "Conversion Copy",
  OUTREACH_TEMPLATE: "Review / Outreach",
};

/**
 * Shared business & hyper-local market dossier strip shown at the top of
 * Audit, Traffic, Competitor, and AI Visibility reports.
 */
export function BusinessContextStrip({
  ctx,
  compact = false,
}: {
  ctx: ReportBusinessContext | null | undefined;
  compact?: boolean;
}) {
  if (!ctx) return null;
  const geo = [ctx.primaryCity, ctx.state, ctx.country].filter(Boolean).join(", ");
  const hasAreas = ctx.coveredAreas.length > 0 || ctx.missingAreas.length > 0;

  return (
    <Panel
      title="Business & Hyper-Local Market Context"
      subtitle="Shared dossier feeding this report — your real products, neighborhoods already covered, and nearby high-demand areas still missing"
      padded
    >
      <div className={`grid grid-cols-1 gap-3 ${compact ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        <div className="rounded-xl border border-brand-200/70 bg-brand-50/50 p-3.5 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Building2 size={13} className="text-accent-600" />
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
              Business &amp; Positioning
            </span>
          </div>
          <p className="text-[13px] font-bold text-brand-950">{ctx.businessName}</p>
          {ctx.industry && <p className="text-[12px] text-brand-600">{ctx.industry}</p>}
          {ctx.businessModel && <Pill tone="info">{ctx.businessModel}</Pill>}
          {ctx.localPresence && (ctx.localPresence.rating != null || ctx.localPresence.reviewCount != null) && (
            <p className="flex items-center gap-1 pt-1 text-[11.5px] text-brand-600">
              <Star size={12} className="text-warning-600" />
              <span className="font-semibold text-brand-950">
                {ctx.localPresence.rating != null ? `${ctx.localPresence.rating}★` : "Listed"}
              </span>
              {ctx.localPresence.reviewCount != null && (
                <span>({ctx.localPresence.reviewCount} Google reviews)</span>
              )}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-brand-200/70 bg-brand-50/50 p-3.5 space-y-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
            Offerings &amp; Proof Signals
          </p>
          {ctx.offerings.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {ctx.offerings.slice(0, 6).map((item) => (
                <Pill key={item} tone="default">
                  {item}
                </Pill>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-brand-500">Run Website Audit to extract commercial offerings.</p>
          )}
          {ctx.catalogHighlights.length > 0 && (
            <p className="text-[11px] text-brand-500">
              Catalog prices:{" "}
              <span className="font-medium text-brand-800">
                {ctx.catalogHighlights
                  .slice(0, 3)
                  .map((c) => `${c.name}${c.price ? ` (${c.price})` : ""}`)
                  .join(" · ")}
              </span>
            </p>
          )}
          {ctx.trustSignals.length > 0 && (
            <p className="text-[11px] text-brand-500">
              Proof: <span className="text-brand-700">{ctx.trustSignals.slice(0, 2).join(" · ")}</span>
            </p>
          )}
        </div>

        <div className="rounded-xl border border-brand-200/70 bg-brand-50/50 p-3.5 space-y-2">
          <div className="flex items-center gap-1.5">
            <MapPin size={13} className="text-accent-600" />
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
              Local Coverage {geo ? `· ${geo}` : ""}
            </span>
          </div>
          {hasAreas ? (
            <div className="space-y-2">
              {ctx.coveredAreas.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-semibold text-brand-500">Covered by pages</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ctx.coveredAreas.slice(0, 6).map((area) => (
                      <Pill key={area} tone="good">
                        {area}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}
              {ctx.missingAreas.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-semibold text-brand-500">
                    Uncovered nearby areas (expansion opportunity)
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ctx.missingAreas.slice(0, 6).map((area) => (
                      <Pill key={area} tone="warn">
                        {area}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-brand-500">
              {ctx.serviceAreas.length > 0
                ? `Target market: ${ctx.serviceAreas.join(", ")}`
                : "Set your primary city in Business Profile to map local neighborhood gaps."}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

/**
 * Shared 7-layer Growth Playbook renderer:
 * 1. Strategic Business Angle
 * 2. Growth Possibilities & Scenarios (Conservative / Realistic / Aggressive)
 * 3. Concrete Methods & Playbooks to Apply (by lever)
 * 4. Done-For-You Copy-Paste Content & Assets (with 1-click Copy)
 * 5. 30 / 60 / 90-Day Owner vs. Developer Execution Roadmap
 */
export function ReportPlaybookSections({
  playbook,
}: {
  playbook: ReportGrowthPlaybook | null | undefined;
}) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!playbook) return null;

  const handleCopy = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      window.setTimeout(() => setCopiedIdx((curr) => (curr === idx ? null : curr)), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <div className="space-y-4">
      {playbook.businessAngle && (
        <Panel
          title="Your Winning Growth Angle"
          subtitle="Tailored specifically to your business model, offerings, and local market"
          padded
        >
          <div className="flex items-start gap-2.5">
            <Compass size={16} className="mt-0.5 shrink-0 text-accent-600" />
            <p className="text-[13px] leading-relaxed text-brand-950">{playbook.businessAngle}</p>
          </div>
        </Panel>
      )}

      {playbook.possibilities.length > 0 && (
        <Panel
          title="Growth Possibilities & Scenarios (30 / 60 / 90 Days)"
          subtitle="Transparent directional scenarios grounded in your measured baseline — showing what unlocks each tier"
          padded
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {playbook.possibilities.map((scenario) => {
              const meta = TIER_META[scenario.tier] ?? TIER_META.realistic;
              return (
                <div
                  key={`${scenario.tier}-${scenario.timeframe}`}
                  className="print-avoid-break rounded-xl border border-brand-200 bg-brand-50/40 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                    <span className="font-mono text-[11px] font-semibold text-brand-500">{scenario.timeframe}</span>
                  </div>
                  <p className="text-[13px] font-bold text-brand-950 flex items-start gap-1.5">
                    <TrendingUp size={14} className="mt-0.5 shrink-0 text-accent-600" />
                    <span>{scenario.headline}</span>
                  </p>
                  <p className="text-[12px] leading-relaxed text-brand-700">{scenario.expectedOutcome}</p>
                  {scenario.unlocksBy.length > 0 && (
                    <div>
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-400">Unlocked by</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11.5px] text-brand-700">
                        {scenario.unlocksBy.map((u) => (
                          <li key={u}>{u}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {scenario.assumptions.length > 0 && (
                    <div className="border-t border-brand-200/70 pt-2">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-400">Assumptions</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-brand-500">
                        {scenario.assumptions.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {playbook.methods.length > 0 && (
        <Panel
          title={`Exact Methods & Playbooks to Apply (${playbook.methods.length})`}
          subtitle="Concrete on-site, hyper-local, conversion, and off-site methods with step-by-step execution and verification metrics"
          padded
        >
          <div className="space-y-3">
            {playbook.methods.map((m, idx) => (
              <div
                key={`${m.title}-${idx}`}
                className="print-avoid-break rounded-xl border border-brand-200 p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Layers size={13} className="text-accent-600" />
                  <p className="text-[13px] font-bold text-brand-950">{m.title}</p>
                  <Pill tone="info">{CATEGORY_LABEL[m.category] ?? m.category}</Pill>
                  <Pill tone={IMPACT_TONE[m.expectedImpact]}>Impact: {m.expectedImpact}</Pill>
                  <Pill tone={LEVEL_TONE[m.effort]}>Effort: {m.effort}</Pill>
                  <span className="ml-auto text-[11px] font-medium text-brand-500">
                    Owner: {m.owner === "you" ? "Business owner" : m.owner === "developer" ? "Developer" : "Owner + Developer"}
                  </span>
                </div>
                {m.objective && (
                  <p className="text-[12px] text-brand-700">
                    <span className="font-semibold text-brand-950">Objective: </span>
                    {m.objective}
                  </p>
                )}
                {m.whyForThisBusiness && (
                  <p className="text-[12px] text-brand-600">
                    <span className="font-semibold text-brand-950">Why for your business: </span>
                    {m.whyForThisBusiness}
                  </p>
                )}
                {m.howToApply.length > 0 && (
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-400">
                      How to apply step-by-step
                    </p>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[12px] text-brand-950">
                      {m.howToApply.map((step, sIdx) => (
                        <li key={sIdx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {m.verifyWith && (
                  <p className="pt-1 text-[11.5px] text-brand-500 flex items-center gap-1.5">
                    <Target size={12} className="shrink-0 text-accent-600" />
                    <span>
                      <strong className="text-brand-800">Verify with:</strong> {m.verifyWith}
                    </span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {playbook.readyToUseAssets.length > 0 && (
        <Panel
          title={`Ready-to-Use Copy-Paste Assets (${playbook.readyToUseAssets.length})`}
          subtitle="Pre-written titles, area page outlines, FAQ blocks, AI-quotable answers, and Google Maps posts tailored to your business"
          padded
        >
          <div className="space-y-3">
            {playbook.readyToUseAssets.map((asset, idx) => (
              <div
                key={`${asset.title}-${idx}`}
                className="print-avoid-break rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <FileCode2 size={13} className="text-accent-600" />
                  <p className="text-[13px] font-bold text-brand-950">{asset.title}</p>
                  <Pill tone="info">{ASSET_LABEL[asset.kind] ?? asset.kind}</Pill>
                  <span className="font-mono text-[11px] text-brand-500">{asset.targetUrlOrChannel}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(asset.copyText, idx)}
                    className="no-print ml-auto inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-950 hover:bg-brand-100 transition cursor-pointer"
                  >
                    {copiedIdx === idx ? <Check size={11} className="text-success-600" /> : <Copy size={11} />}
                    <span>{copiedIdx === idx ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre className="whitespace-pre-wrap rounded-lg border border-brand-200/80 bg-brand-50/70 p-3 font-mono text-[11.5px] leading-relaxed text-brand-950">
                  {asset.copyText}
                </pre>
                {asset.usageNote && <p className="text-[11.5px] text-brand-500">{asset.usageNote}</p>}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {playbook.roadmap90Day.length > 0 && (
        <Panel
          title="30 / 60 / 90-Day Execution Roadmap"
          subtitle="Clear ownership split between what you can execute directly and what your web developer ships"
          padded
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {playbook.roadmap90Day.map((m) => (
              <div
                key={m.phase}
                className="print-avoid-break rounded-xl border border-brand-200 bg-brand-50/50 p-4 space-y-2.5"
              >
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-accent-600" />
                  <p className="text-[12.5px] font-bold text-brand-950">{m.phase}</p>
                </div>
                {m.goal && <p className="text-[12px] text-brand-700">{m.goal}</p>}
                {m.ownerTasks.length > 0 && (
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-400">
                      Business owner tasks
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11.5px] text-brand-800">
                      {m.ownerTasks.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.developerTasks.length > 0 && (
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-400">
                      Developer tasks
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11.5px] text-brand-700">
                      {m.developerTasks.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.kpiTarget && (
                  <p className="border-t border-brand-200/70 pt-2 text-[11.5px] text-brand-600 flex items-start gap-1.5">
                    <Sparkles size={12} className="mt-0.5 shrink-0 text-accent-600" />
                    <span>
                      <strong className="text-brand-950">Checkpoint:</strong> {m.kpiTarget}
                    </span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
