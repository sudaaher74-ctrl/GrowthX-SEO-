"use client";

import { Panel, Pill, Table, Th } from "@/components/ui/console";
import type { FixDetailData } from "@/lib/api-types";

export function FixEngineImpactView({
  detail,
}: {
  detail: FixDetailData | null;
}) {
  if (!detail) {
    return (
      <Panel title="Impact Analytics" subtitle="Search, AI, and Business outcome tracking" padded>
        <div className="p-12 text-center text-xs text-brand-500">
          Please select a fix to inspect multi-dimensional impact analytics.
        </div>
      </Panel>
    );
  }

  const { seoImpact, aiImpact, businessImpact } = detail;

  return (
    <div className="space-y-6">
      {/* Section A: Search Impact (Google Search Console) */}
      <Panel
        title="Google Search Console Impact"
        subtitle="Comparable 28-day baseline vs post-deployment observation windows"
        padded
      >
        <div className="space-y-4">
          <div className="rounded-lg border bg-brand-50/60 p-3 text-xs text-brand-700">
            <span className="font-semibold text-brand-900">Baseline Window: </span>
            28 complete days prior to fix deployment ({seoImpact.baseline.clicks} clicks,{" "}
            {seoImpact.baseline.impressions} impressions, {seoImpact.baseline.ctr}% CTR, avg position{" "}
            {seoImpact.baseline.position ?? "—"}).
          </div>

          <Table minWidth={600}>
            <thead>
              <tr>
                <Th>Measurement Window</Th>
                <Th>Days Tracked</Th>
                <Th>Organic Clicks</Th>
                <Th>Impressions</Th>
                <Th>CTR</Th>
                <Th>Avg Position</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {seoImpact.windows.map((win) => (
                <tr key={win.window} className="hover:bg-brand-50/50">
                  <td className="px-4 py-3 font-semibold text-brand-900">{win.window}</td>
                  <td className="px-4 py-3 font-mono text-brand-600">{win.days}d</td>
                  <td className="px-4 py-3 font-mono text-brand-900 font-bold">{win.status === "OBSERVED" ? win.clicks : "—"}</td>
                  <td className="px-4 py-3 font-mono text-brand-600">{win.status === "OBSERVED" ? win.impressions : "—"}</td>
                  <td className="px-4 py-3 font-mono text-brand-600">{win.status === "OBSERVED" ? `${win.ctr}%` : "—"}</td>
                  <td className="px-4 py-3 font-mono text-brand-600">{win.position ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Pill tone={win.status === "OBSERVED" ? "good" : "default"}>{win.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <p className="text-[11px] text-brand-400 italic">
            Note: Performance changes occurring after deployment are classified as &quot;Observed performance change&quot;
            and do not constitute sole mathematical proof of causality.
          </p>
        </div>
      </Panel>

      {/* Section B: AI Visibility Impact (5 Models & Prompt Mapping) */}
      <Panel
        title="AI Search Visibility Impact"
        subtitle="Tracking brand mentions and recommendations across 5 AI model families"
        padded
      >
        <div className="space-y-4">
          {aiImpact.available ? (
            <>
              <Table minWidth={600}>
                <thead>
                  <tr>
                    <Th>AI Model Family</Th>
                    <Th>Before Fix Score</Th>
                    <Th>After Fix Score</Th>
                    <Th>Change</Th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {aiImpact.models.map((m) => (
                    <tr key={m.model} className="hover:bg-brand-50/50">
                      <td className="px-4 py-3 font-semibold text-brand-900">{m.model}</td>
                      <td className="px-4 py-3 font-mono text-brand-600">
                        {m.beforeScore != null ? `${m.beforeScore}%` : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-brand-900 font-bold">
                        {m.afterScore != null ? `${m.afterScore}%` : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {m.delta != null ? (
                          <span className={m.delta >= 0 ? "text-success-700 font-semibold" : "text-error-700 font-semibold"}>
                            {m.delta >= 0 ? `+${m.delta}%` : `${m.delta}%`}
                          </span>
                        ) : (
                          <span className="text-brand-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {aiImpact.prompts.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold text-brand-900">Connected Monitoring Prompts</h4>
                  <div className="divide-y rounded-lg border text-xs">
                    {aiImpact.prompts.map((p, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="font-medium text-brand-900">&ldquo;{p.promptText}&rdquo;</div>
                          <div className="text-[10px] font-mono text-brand-500">{p.pageUrl}</div>
                        </div>
                        <div className="flex gap-2 text-[11px] font-mono shrink-0">
                          <span className={p.citedBefore ? "text-success-700" : "text-brand-400"}>
                            Before: {p.citedBefore == null ? "Not measured" : p.citedBefore ? "Cited" : "Uncited"}
                          </span>
                          <span>→</span>
                          <span className={p.citedAfter ? "text-success-700 font-bold" : "text-brand-400"}>
                            After: {p.citedAfter == null ? "Not measured" : p.citedAfter ? "Cited" : "Uncited"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-6 text-center text-xs text-brand-500 border border-dashed rounded-lg">
              AI Visibility monitoring cycles run 3 times per month across 20 prompt sets. Impact will be updated once the next cycle concludes.
            </div>
          )}
        </div>
      </Panel>

      {/* Section C: GA4 Business Impact */}
      <Panel
        title="Google Analytics 4 Business Impact"
        subtitle="Organic sessions, engaged sessions, and conversion events on modified landing page"
        padded
      >
        {businessImpact.available ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3 bg-brand-50/50">
              <span className="text-[11px] text-brand-500">Organic Sessions</span>
              <div className="text-lg font-bold font-mono text-brand-950 mt-1">{businessImpact.sessions}</div>
            </div>
            <div className="rounded-lg border p-3 bg-brand-50/50">
              <span className="text-[11px] text-brand-500">Engaged Sessions</span>
              <div className="text-lg font-bold font-mono text-brand-950 mt-1">
                {businessImpact.engagedSessions ?? "—"}
              </div>
            </div>
            <div className="rounded-lg border p-3 bg-brand-50/50">
              <span className="text-[11px] text-brand-500">Key Events / Conversions</span>
              <div className="text-lg font-bold font-mono text-brand-950 mt-1">{businessImpact.conversions}</div>
            </div>
            <div className="rounded-lg border p-3 bg-brand-50/50">
              <span className="text-[11px] text-brand-500">Direct Revenue</span>
              <div className="text-lg font-bold font-mono text-brand-950 mt-1">
                {businessImpact.revenue != null ? `$${businessImpact.revenue.toFixed(2)}` : "—"}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-brand-500 border border-dashed rounded-lg">
            Google Analytics 4 is not connected or page session events are still accumulating.
          </div>
        )}
      </Panel>
    </div>
  );
}
