"use client";

import React, { useEffect, useId, useRef } from "react";
import { AlertTriangle, Search, X } from "lucide-react";
import { Pill } from "@/components/ui/console";
import type { AdminSubscriptionTier } from "@/lib/api-types";
import { cn } from "@/lib/utils";

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
        "overflow-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/60",
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
  return <thead className="sticky top-0 z-10 bg-surface-1">{children}</thead>;
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
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" size={14} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-9 w-64 max-w-full rounded-xl border border-brand-200 bg-surface-2 pl-9 pr-3 text-[12.5px] text-brand-950 placeholder:text-brand-400 transition focus:border-signal-400 focus:outline-none focus:ring-2 focus:ring-signal-400/20"
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
    <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-brand-200 bg-surface-2 p-1">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium transition-colors cursor-pointer",
              active
                ? "bg-signal-400 font-bold text-signal-ink shadow-2xs"
                : "text-brand-600 hover:bg-surface-1 hover:text-brand-950",
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
                  "font-mono text-[10px]",
                  active ? "text-signal-ink/75" : "text-brand-400",
                )}
              >
                {opt.count}
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
  if (normalized === "agency") return <Pill tone="good">Agency</Pill>;
  if (normalized === "growth") return <Pill tone="info">Growth</Pill>;
  if (normalized === "starter") return <Pill tone="warn">Starter</Pill>;
  return <Pill tone="default">Founder Free</Pill>;
}

export function AdminSkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-2xl border border-brand-200 bg-surface-1 p-5 space-y-3 animate-pulse",
        className,
      )}
    >
      <div className="h-3 w-24 rounded bg-surface-3" />
      <div className="h-7 w-20 rounded bg-surface-3" />
      <div className="h-2.5 w-36 rounded bg-surface-2" />
    </div>
  );
}

export function AdminSkeletonRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div aria-hidden="true" className="divide-y divide-brand-200/60 p-4 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-4 pt-3 first:pt-0" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, j) => (
            <div key={j} className="h-4 rounded bg-surface-2" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Attaches light-dismiss outside-click handling for browsers without native
 * `<dialog closedby="any">` support. Checks pointer coordinates on both
 * pointerdown and pointerup so text-selection drags never dismiss accidentally.
 */
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

/**
 * Native modal `<dialog>` confirmation prompt for high-impact operator actions.
 * Puts `autoFocus` on the safe Cancel button, uses `showModal()`, and resets
 * `returnValue` on close.
 */
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
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
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
      className="m-auto w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-brand-200 bg-surface-1 p-0 text-brand-950 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-xs"
    >
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
              tone === "danger"
                ? "border-error-200 bg-error-50 text-error-600"
                : tone === "warn"
                  ? "border-warning-200 bg-warning-50 text-warning-600"
                  : "border-brand-200 bg-surface-2 text-brand-700",
            )}
          >
            <AlertTriangle size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 id={titleId} className="text-[15px] font-bold text-brand-950">
              {title}
            </h1>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-brand-500">{description}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-200/80">
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={() => ref.current?.close("cancel")}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-brand-200 bg-surface-2 px-4 text-[12.5px] font-semibold text-brand-700 transition hover:bg-surface-3 hover:text-brand-950 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-xl px-4 text-[12.5px] font-bold transition disabled:opacity-50 cursor-pointer",
              tone === "danger"
                ? "bg-error-600 text-white hover:bg-error-500"
                : tone === "warn"
                  ? "bg-warning-500 text-signal-ink hover:bg-warning-400"
                  : "bg-signal-400 text-signal-ink hover:bg-signal-500",
            )}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * Native modal `<dialog>` styled as a right-anchored slide-over inspector drawer.
 * Layout `flex` is strictly scoped to `open:flex` so the closed dialog stays hidden.
 */
export function SlideOverDialog({
  open,
  title,
  subtitle,
  onClose,
  headerAside,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  headerAside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
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
      className="m-0 ml-auto h-dvh max-h-dvh w-[min(680px,100vw)] max-w-none flex-col border-l border-brand-200 bg-surface-1 p-0 text-brand-950 shadow-2xl open:flex backdrop:bg-black/55 backdrop:backdrop-blur-xs"
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-brand-200 px-6 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 id={titleId} className="truncate text-[16px] font-bold tracking-tight text-brand-950">
              {title}
            </h1>
            {headerAside}
          </div>
          {subtitle && <p className="mt-0.5 text-[12px] text-brand-500">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close("close")}
          aria-label="Close panel"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-surface-2 text-brand-500 transition hover:bg-surface-3 hover:text-brand-950 cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
    </dialog>
  );
}

export function formatUsd(amount: number | null | undefined, digits = 2): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  if (amount > 0 && amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(digits)}`;
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
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
