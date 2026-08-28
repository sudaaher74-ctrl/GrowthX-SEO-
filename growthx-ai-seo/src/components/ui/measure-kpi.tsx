"use client";

import Link from "next/link";
import { Info, Plug } from "lucide-react";
import { Kpi } from "@/components/ui/console";
import type { Measure } from "@/lib/api-client";

/**
 * A headline figure that can admit it does not know.
 *
 * The dashboard this replaces rendered "Growth Score 78" and "Organic Traffic
 * +18%" as literals — identical for every customer, presented as their own
 * results. The fix is not better numbers; it is a component that structurally
 * cannot show one without a source, and that has somewhere to put "we cannot
 * see this yet" other than a zero.
 *
 * A zero is the specific thing being avoided. "0 conversions" and "conversions
 * are not being tracked" look the same on a card and mean opposite things: one
 * is a failing business, the other is an unconfigured tool.
 */
export function MeasureKpi({
  label,
  measure,
  format = (value: number) => value.toLocaleString(),
  connectHref,
}: {
  label: string;
  measure: Measure;
  format?: (value: number) => string;
  /** Where "Connect" goes. Omitted, the reason is shown without a link. */
  connectHref?: Partial<Record<string, string>>;
}) {
  if (measure.state === "MEASURED") {
    return (
      <Kpi
        label={label}
        value={format(measure.value)}
        // Null when there is no earlier period, which the Kpi renders as no
        // arrow rather than as 0%.
        delta={measure.changePct}
        deltaSuffix="%"
        sub={<span className="text-[11px] text-brand-400">{measure.source}</span>}
      />
    );
  }

  const href = measure.state === "NOT_CONNECTED" ? connectHref?.[measure.connect] : undefined;

  return (
    <div
      className="rounded-xl border bg-white px-4 py-3.5"
      style={{ borderColor: "var(--color-brand-100)" }}
    >
      <div className="text-[11px] font-medium text-brand-500">{label}</div>
      <div className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-brand-600">
        {measure.state === "NOT_CONNECTED" ? (
          <Plug size={12} className="mt-0.5 shrink-0 text-brand-400" />
        ) : (
          <Info size={12} className="mt-0.5 shrink-0 text-brand-400" />
        )}
        <span>{measure.reason}</span>
      </div>
      {href && (
        <Link
          href={href}
          className="mt-2 inline-block text-[12px] font-medium text-accent-600 underline-offset-2 hover:underline"
        >
          Connect
        </Link>
      )}
    </div>
  );
}
