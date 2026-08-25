"use client";
import { cn } from "@/lib/utils";

/**
 * Console design system.
 *
 * The primitives every page in the agency console is built from, so the whole
 * app shares one set of measurements and colours rather than each page
 * re-inventing them. Values come from the design file's own tokens.
 */

/**
 * Colour belongs to the design system, not to this file.
 *
 * This used to be a second palette of raw hex strings, and because every page
 * copies its patterns from these primitives, the whole app copied the habit —
 * 900+ hardcoded hex values across 40 routes, with three different greens for
 * "good". The tokens in globals.css are the single source of truth; components
 * below reference them through Tailwind's generated utilities (`text-brand-500`,
 * `border-line`) or `var(--...)` where a style prop is unavoidable.
 */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-brand-950">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-brand-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ActionButton({
  children,
  variant = "secondary",
  icon,
  ...props
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  icon?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50",
        variant === "primary"
          ? "bg-brand-950 text-white hover:opacity-90"
          : "border bg-white text-brand-700 hover:bg-brand-50",
        props.className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Kpi({
  label,
  value,
  delta,
  deltaSuffix = "",
  deltaGood = "up",
  sub,
  tone = "default",
  meter,
  trend,
  aside,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaSuffix?: string;
  /** Which direction is an improvement. Issues going up is not good news. */
  deltaGood?: "up" | "down";
  sub?: React.ReactNode;
  tone?: "default" | "danger" | "good";
  /** 0-100. Draws the value as a proportion beneath it. */
  meter?: number | null;
  /** Real historical values, oldest first. Two points minimum, or no line. */
  trend?: number[] | null;
  /** Rendered to the right of the value — a Pill, a trend, a unit. */
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono text-[24px] font-bold tracking-[-0.02em]",
            tone === "danger" ? "text-error-600" : tone === "good" ? "text-success-600" : "text-brand-950",
          )}
        >
          {value}
        </span>
        {delta != null && (
          <span
            className={cn(
              "font-mono text-[12px] font-medium",
              (deltaGood === "up" ? delta >= 0 : delta <= 0) ? "text-success-600" : "text-error-600",
            )}
          >
            {delta >= 0 ? "+" : ""}
            {delta}
            {deltaSuffix}
          </span>
        )}
        {aside}
      </div>
      {meter != null && (
        <div className="mt-2.5">
          <MeterBar value={meter} tone={meter >= 70 ? "good" : "accent"} width="100%" />
        </div>
      )}
      {/* One reading is not a trend. Below two points the line would be a
          flat stub that implies a history the client does not have. */}
      {trend != null && trend.length >= 2 && (
        <div className="mt-2 -mb-0.5">
          <Sparkline values={trend} width={96} height={20} />
        </div>
      )}
      {sub && <p className="mt-1.5 text-[11px] text-brand-500">{sub}</p>}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  padded = false,
}: {
  title?: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      {title && (
        <div
          className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3"
         
        >
          <div>
            <h2 className="text-[13px] font-semibold text-brand-950">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-brand-400">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={padded ? "p-4" : undefined}>{children}</div>
    </div>
  );
}

/**
 * Segmented control used for the design's page-level tabs.
 *
 * Every module routes its page-level tabs through here. Nine pages used to
 * hand-roll an underlined bar instead, in two variants that disagreed about
 * which colour marks the active tab, so the same control changed appearance
 * as you moved through the nav.
 */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; tag?: string; icon?: React.ElementType }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="-mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors",
              isActive
                ? "border-brand-950 bg-brand-950 text-white"
                : "border-line bg-white text-brand-600 hover:bg-brand-50 hover:text-brand-950",
            )}
          >
            {Icon && <Icon size={13} className={isActive ? "text-white/80" : "text-brand-400"} />}
            {tab.label}
            {tab.tag && (
              <span
                className={cn(
                  "rounded-full px-[5px] py-px font-mono text-[9.5px] font-semibold",
                  isActive ? "bg-white/15 text-white" : "bg-brand-100 text-brand-500",
                )}
              >
                {tab.tag}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Transient result of an action the user just took. Three pages each had their
 * own copy of this in raw emerald, which is off-palette and was the only green
 * in the app that ignored the success tokens.
 */
export function StatusNote({ children, tone = "good" }: { children: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-2.5 text-[12px]",
        tone === "good" ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700",
      )}
    >
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "good" | "bad" | "warn" | "info";
}) {
  const styles = {
    default: "bg-brand-100 text-brand-700",
    good: "bg-success-50 text-success-700",
    bad: "bg-error-50 text-error-700",
    warn: "bg-warning-50 text-warning-700",
    info: "bg-accent-50 text-accent-700",
  }[tone];
  return (
    <span className={cn("inline-block rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold", styles)}>
      {children}
    </span>
  );
}

/* ── table primitives ───────────────────────────────────────────── */

export function Table({ children, minWidth = 800 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  onClick,
  sorted,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  onClick?: () => void;
  sorted?: "asc" | "desc" | null;
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "border-b px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-400",
        align === "right" ? "text-right" : "text-left",
        onClick && "cursor-pointer select-none hover:text-brand-600",
      )}
     
    >
      {children}
      {sorted && <span className="ml-1">{sorted === "desc" ? "↓" : "↑"}</span>}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
  colSpan,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-4 py-3 align-middle", align === "right" ? "text-right" : "text-left", className)}>
      {children}
    </td>
  );
}

export function Tr({ children, className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr {...props} className={cn("border-b border-brand-100 transition-colors last:border-0 hover:bg-brand-50", className)}>
      {children}
    </tr>
  );
}

export function Mono({ children, tone }: { children: React.ReactNode; tone?: "good" | "bad" | "soft" }) {
  return (
    <span
      className={cn(
        "font-mono text-[12px]",
        tone === "good" ? "text-success-600" : tone === "bad" ? "text-error-600" : tone === "soft" ? "text-brand-400" : "text-brand-700",
      )}
    >
      {children}
    </span>
  );
}

/** Horizontal proportion bar used across the citation and share views. */
export function MeterBar({ value, tone = "accent", width = 64 }: { value: number; tone?: "accent" | "good"; width?: number | string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-brand-100" style={{ width }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: `var(--color-${tone === "good" ? "success" : "accent"}-600)` }}
      />
    </div>
  );
}

/** Inline sparkline — no chart library for a 12-point series. */
export function Sparkline({ values, width = 68, height = 22 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="text-[11px] text-brand-300">—</span>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / span) * height}`)
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={`var(--color-${values[values.length - 1] >= values[0] ? "success" : "error"}-600)`}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Shown where the design specifies a screen we cannot populate from real data
 * yet. An explicit "not connected" beats a page of invented numbers.
 */
export function NotConnected({
  title,
  what,
  needs,
}: {
  title: string;
  what: string;
  needs: string[];
}) {
  return (
    <div className="rounded-xl border border-dashed bg-white p-10 text-center">
      <p className="text-[14px] font-semibold text-brand-950">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[12.5px] text-brand-500">{what}</p>
      <div className="mx-auto mt-5 max-w-sm rounded-lg bg-brand-50 p-3 text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">Needs</p>
        <ul className="mt-1.5 space-y-1">
          {needs.map((need) => (
            <li key={need} className="text-[11.5px] text-brand-600">
              • {need}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
