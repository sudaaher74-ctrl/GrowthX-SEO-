"use client";

import React, { useEffect, useId, useRef } from "react";
import { AlertTriangle, Search, X } from "lucide-react";
import { Pill } from "@/components/ui/console";
import type { AdminSubscriptionTier } from "@/lib/api-types";
import { cn } from "@/lib/utils";

/** Sharp, industrial NOC instrument panel. */
export function NocPanel({
  code,
  title,
  subtitle,
  actions,
  padded = false,
  className,
  children,
}: {
  code?: string;
  title?: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  padded?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-brand-200 bg-surface-1 shadow-2xs",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-200 bg-surface-2/60 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {code && (
                <span className="rounded-sm border border-primary-200 bg-primary-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-primary-600">
                  {code}
                </span>
              )}
              {title && (
                <h2 className="truncate text-[13px] font-semibold tracking-tight text-brand-950">
                  {title}
                </h2>
              )}
            </div>
            {subtitle && <p className="mt-0.5 text-[11.5px] text-brand-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={padded ? "p-4" : undefined}>{children}</div>
    </section>
  );
}

/** High-density monospace metric tile for executive FinOps & telemetry grids. */
export function NocStat({
  label,
  value,
  sub,
  tone = "default",
  aside,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad" | "cyan";
  aside?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-brand-200 bg-surface-1 px-4 py-3.5 flex flex-col justify-between gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-brand-400">
          {label}
        </span>
        {aside}
      </div>
      <div
        className={cn(
          "font-mono text-[22px] font-semibold leading-none tracking-tight tabular-nums",
          tone === "good"
            ? "text-success-700"
            : tone === "warn"
              ? "text-warning-700"
              : tone === "bad"
                ? "text-error-700"
                : tone === "cyan"
                  ? "text-primary-600"
                  : "text-brand-950",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-brand-400 truncate">{sub}</div>}
    </div>
  );
}

export function NocButton({
  children,
  variant = "secondary",
  icon,
  ...props
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "warn";
  icon?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition-colors disabled:opacity-45 cursor-pointer",
        variant === "primary"
          ? "bg-signal-400 text-white hover:bg-signal-500 shadow-2xs"
          : variant === "danger"
            ? "border border-error-200 bg-error-50 text-error-700 hover:bg-error-600 hover:text-white"
            : variant === "warn"
              ? "border border-warning-200 bg-warning-50 text-warning-700 hover:bg-warning-600 hover:text-white"
              : "border border-brand-200 bg-surface-2 text-brand-700 hover:border-brand-300 hover:bg-surface-3 hover:text-brand-950",
        props.className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * Keyboard-accessible scrollable data-table wrapper with sticky column header
 * styling and landmark semantics (`role="region"` + `tabIndex={0}`).
 */
export function AdminTableWrap({
  label,
  minWidth = 720,
  maxHeightClass = "max-h-[560px]",
  children,
}: {
  label: string;
  minWidth?: number;
  maxHeightClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={label}
      className={cn(
        "overflow-auto focus:outline-none focus-visible:ring-1 focus-visible:ring-signal-400",
        maxHeightClass,
      )}
    >
      <table className="w-full border-separate border-spacing-0" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

/** Sticky table head row that stays legible over scrolling rows. */
export function AdminThead({ children }: { children: React.ReactNode }) {
  return <thead className="sticky top-0 z-10 bg-surface-2">{children}</thead>;
}

export function AdminSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" size={13} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-8 w-64 max-w-full rounded-sm border border-brand-200 bg-surface-1 pl-8 pr-3 font-mono text-[11.5px] text-brand-950 placeholder:text-brand-400 transition focus:border-signal-400 focus:outline-none"
      />
    </div>
  );
}

export function FilterChipGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ id: T; label: string; count?: number; dot?: "good" | "bad" | "warn" }>;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 rounded-sm border border-brand-200 bg-surface-1 p-0.5">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-xs px-2 font-mono text-[11px] font-semibold transition-colors cursor-pointer",
              active
                ? "bg-signal-400 text-signal-ink font-bold"
                : "text-brand-500 hover:bg-surface-2 hover:text-brand-950",
            )}
          >
            {opt.dot && (
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  opt.dot === "good" ? "bg-success-500" : opt.dot === "bad" ? "bg-error-500" : "bg-warning-500",
                )}
              />
            )}
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={cn(
                  "font-mono text-[10px] tabular-nums",
                  active ? "text-signal-ink/75" : "text-brand-400",
                )}
              >
                [{opt.count}]
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TierBadge({ tier }: { tier?: AdminSubscriptionTier | string | null }) {
  const normalized = (tier || "founder_free").toLowerCase();
  if (normalized === "agency") return <Pill tone="good">AGENCY</Pill>;
  if (normalized === "growth") return <Pill tone="info">GROWTH</Pill>;
  if (normalized === "starter") return <Pill tone="warn">STARTER</Pill>;
  return <Pill tone="default">FREE</Pill>;
}

export function AdminSkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-md border border-brand-200 bg-surface-1 p-4 space-y-2.5 animate-pulse",
        className,
      )}
    >
      <div className="h-2.5 w-24 rounded-xs bg-surface-3" />
      <div className="h-6 w-20 rounded-xs bg-surface-3" />
      <div className="h-2 w-36 rounded-xs bg-surface-2" />
    </div>
  );
}

export function AdminSkeletonRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div aria-hidden="true" className="divide-y divide-brand-200/60 p-3.5 space-y-2.5 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid gap-3 pt-2.5 first:pt-0"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((__, j) => (
            <div key={j} className="h-3.5 rounded-xs bg-surface-2" />
          ))}
        </div>
      ))}
    </div>
  );
}

function useDialogBackdropFallback(
  ref: React.RefObject<HTMLDialogElement | null>,
  open: boolean,
) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    if (typeof HTMLDialogElement !== "undefined" && "closedBy" in HTMLDialogElement.prototype) {
      return;
    }

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    let pressedOutside = false;
    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) dialog.close();
      pressedOutside = false;
    };

    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointerup", onUp);
    return () => {
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
    };
  }, [ref, open]);
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  tone = "danger",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "warn" | "primary";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useDialogBackdropFallback(ref, open);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
      onClose={() => {
        if (ref.current) ref.current.returnValue = "";
        onClose();
      }}
      className="m-auto w-[min(460px,calc(100vw-2rem))] rounded-md border border-brand-300 bg-surface-1 p-0 text-brand-950 shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-xs"
    >
      <div className="border-b border-brand-200 bg-surface-2 px-5 py-3 flex items-center gap-2.5">
        <AlertTriangle
          size={15}
          className={
            tone === "danger"
              ? "text-error-500"
              : tone === "warn"
                ? "text-warning-500"
                : "text-signal-400"
          }
        />
        <h1 id={titleId} className="font-mono text-[13px] font-bold uppercase tracking-[0.05em] text-brand-950">
          {title}
        </h1>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-[12.5px] leading-relaxed text-brand-500">{description}</p>
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-200">
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={() => ref.current?.close("cancel")}
            className="inline-flex h-8 items-center justify-center rounded-sm border border-brand-200 bg-surface-2 px-3.5 font-mono text-[11.5px] font-semibold text-brand-600 transition hover:bg-surface-3 hover:text-brand-950 disabled:opacity-50 cursor-pointer"
          >
            ABORT
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className={cn(
              "inline-flex h-8 items-center justify-center rounded-sm px-3.5 font-mono text-[11.5px] font-bold transition disabled:opacity-50 cursor-pointer",
              tone === "danger"
                ? "bg-error-600 text-white hover:bg-error-500"
                : tone === "warn"
                  ? "bg-warning-500 text-signal-ink hover:bg-warning-400"
                  : "bg-signal-400 text-signal-ink hover:bg-signal-500",
            )}
          >
            {busy ? "EXECUTING…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function SlideOverDialog({
  open,
  title,
  subtitle,
  onClose,
  headerAside,
  widthClass = "w-[min(740px,100vw)]",
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  headerAside?: React.ReactNode;
  widthClass?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useDialogBackdropFallback(ref, open);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
      onClose={() => {
        if (ref.current) ref.current.returnValue = "";
        onClose();
      }}
      className={cn(
        "m-0 ml-auto h-dvh max-h-dvh max-w-none flex-col border-l border-brand-300 bg-surface-1 p-0 text-brand-950 shadow-2xl open:flex backdrop:bg-black/70 backdrop:backdrop-blur-xs",
        widthClass,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-brand-200 bg-surface-2 px-5 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 id={titleId} className="truncate font-mono text-[14px] font-bold tracking-[0.03em] text-brand-950">
              {title}
            </h1>
            {headerAside}
          </div>
          {subtitle && <p className="mt-0.5 font-mono text-[11px] text-brand-400">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close("close")}
          aria-label="Close inspector"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-brand-200 bg-surface-1 text-brand-400 transition hover:border-brand-300 hover:text-brand-950 cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}

export function formatUsd(amount: number | null | undefined, digits = 2): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  if (amount > 0 && amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(digits)}`;
}

export function formatInr(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  if (amount > 0 && amount < 1) return `₹${amount.toFixed(2)}`;
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function formatDurationSec(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}
