"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Panel, Pill, StatusNote } from "@/components/ui/console";
import { NotConnectedState } from "@/components/ui/truthful-state";
import type { Evidence, Reason } from "@/lib/search-intelligence";

const SEVERITY: Record<Reason["severity"], { label: string; tone: "bad" | "warn" | "default" }> = {
  HIGH: { label: "Fix first", tone: "bad" },
  MEDIUM: { label: "Worth fixing", tone: "warn" },
  LOW: { label: "Minor", tone: "default" },
};

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 rounded-lg bg-brand-50 px-3 py-2">
      {evidence.map((e, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[11.5px]">
          <span className="font-medium text-brand-700">{e.label}:</span>
          <span className="break-all text-brand-950">{e.value}</span>
          <span className="ml-auto text-[10px] text-brand-400">{e.source}</span>
        </li>
      ))}
    </ul>
  );
}

/** A reason or risk, with what it rests on. Used by diagnosis and risk check alike. */
export function ReasonCard({ reason, index }: { reason: Reason; index?: number }) {
  const s = SEVERITY[reason.severity];
  return (
    <Panel padded>
      <div className="flex flex-wrap items-center gap-2">
        {index !== undefined && <span className="font-mono text-[11px] text-brand-400">{index + 1}.</span>}
        <Pill tone={s.tone}>{s.label}</Pill>
        <h3 className="text-[13px] font-semibold text-brand-950">{reason.title}</h3>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-brand-600">{reason.detail}</p>
      <EvidenceList evidence={reason.evidence} />
    </Panel>
  );
}

/**
 * Shown in place of a screen that runs on the customer's own Google data while
 * neither Search Console nor Analytics is connected. Says what connecting gives
 * and where to do it; the customer is never told about platform setup, which
 * is not theirs to change.
 */
export function GoogleConnectGate({ analyticsConnected }: { analyticsConnected: boolean }) {
  return (
    <NotConnectedState
      title="Connect Google Search Console"
      missing={
        analyticsConnected
          ? "This page reads how Google shows your website, and it needs your Search Console for that."
          : "This page reads how Google shows your website. It needs your Search Console, and works best with Google Analytics 4 as well."
      }
      whyItMatters="Rankings, the searches people use to find you and what Google has indexed all come from your own Search Console. Analytics adds the visits and conversions that follow. Nothing here is estimated while they are not connected."
      actionRequired={
        analyticsConnected
          ? "Connect Search Console and choose your website."
          : "Connect Search Console and Google Analytics 4, and choose your website in each."
      }
      action={{ label: "Connect Google", href: "/integrations" }}
    />
  );
}

/** A quiet prompt under figures that Analytics would extend, for a customer who has Search Console only. */
export function AnalyticsNudge({ what }: { what: string }) {
  return (
    <p className="text-[11.5px] text-brand-500">
      {what}{" "}
      <Link href="/integrations" className="font-medium text-primary-700 hover:underline">
        Connect Google Analytics 4
      </Link>
    </p>
  );
}

export function SearchConsoleNeeded({ what }: { what: string }) {
  return (
    <NotConnectedState
      title="Connect Google Search Console"
      missing={what}
      whyItMatters="These figures come from Google itself, so they need your Search Console access."
      actionRequired="Connect Search Console and choose your website."
      action={{ label: "Go to Integrations", href: "/integrations" }}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-[11px] font-semibold text-brand-700">{label}</span>
      {hint && <span className="ml-1.5 text-[10.5px] text-brand-400">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border bg-white px-3 py-2 text-[12.5px] text-brand-950 placeholder:text-brand-300 focus:border-primary-500 focus:outline-none";

export function ErrorNote({ message }: { message: string }) {
  return <StatusNote tone="bad">{message}</StatusNote>;
}

/** "3 Oct 2026" */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url;
  }
}
