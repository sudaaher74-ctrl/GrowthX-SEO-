import React from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className={cn("rounded-2xl border border-brand-200/50 bg-brand-50/90 p-4.5 sm:p-5 shadow-sm", className)}
    >
      {children}
    </section>
  );
}

export function CardHead({ title, subtitle, aside }: { title: string; subtitle?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[14px] font-bold text-brand-950 tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 max-w-md text-[11.5px] leading-normal text-brand-400">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

export function LoadingLine({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-[12.5px] text-brand-400">
      <Loader2 size={14} className="animate-spin text-signal-400" />
      {text}
    </div>
  );
}

export function CardSkeletonShimmer() {
  return (
    <div className="space-y-4 py-2 animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-20 w-20 rounded-full bg-brand-200/50" />
          <div className="space-y-2">
            <div className="h-4 w-28 rounded bg-brand-200/60" />
            <div className="h-3 w-40 rounded bg-brand-200/40" />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="space-y-1.5">
            <div className="h-3 w-16 rounded bg-brand-200/40" />
            <div className="h-6 w-10 rounded bg-brand-200/60" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-16 rounded bg-brand-200/40" />
            <div className="h-6 w-10 rounded bg-brand-200/60" />
          </div>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-brand-200/40" />
      <div className="grid grid-cols-4 gap-2 pt-1">
        <div className="h-3 rounded bg-brand-200/30" />
        <div className="h-3 rounded bg-brand-200/30" />
        <div className="h-3 rounded bg-brand-200/30" />
        <div className="h-3 rounded bg-brand-200/30" />
      </div>
    </div>
  );
}

export function ChartSkeletonShimmer() {
  return (
    <div className="space-y-4 py-2 animate-pulse">
      <div className="h-8 w-24 rounded bg-brand-200/60" />
      <div className="h-28 w-full rounded-xl bg-brand-200/20 flex items-end gap-1.5 p-2 border border-brand-200/40">
        {[40, 65, 30, 85, 50, 95, 60, 45, 70, 55, 80, 40, 90, 75].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-brand-200/60" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-brand-300">
        <div className="h-2.5 w-12 rounded bg-brand-200/40" />
        <div className="h-2.5 w-12 rounded bg-brand-200/40" />
      </div>
    </div>
  );
}

export function MicroSparkline({
  points,
  className,
  color = "var(--color-signal-400)",
}: {
  points: number[];
  className?: string;
  color?: string;
}) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const height = 22;
  const width = 58;

  const path = points
    .map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className={cn("overflow-visible shrink-0", className)} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EmptyPrompt({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  action?: { label: string; href?: string; onClick?: () => void; disabled?: boolean };
}) {
  const button =
    "inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-4 py-2.5 text-[12.5px] font-bold text-signal-ink hover:bg-signal-500 disabled:opacity-50";
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-200 text-signal-400">
        <Icon size={18} />
      </div>
      <p className="mt-3 text-[14px] font-semibold text-brand-950">{title}</p>
      <p className="mt-1 max-w-sm text-[12.5px] text-brand-500">{body}</p>
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link href={action.href} className={button}>
              {action.label}
              <ArrowRight size={13} />
            </Link>
          ) : (
            <button type="button" onClick={action.onClick} disabled={action.disabled} className={button}>
              {action.label}
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
