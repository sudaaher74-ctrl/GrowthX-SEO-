"use client";
import { cn } from "@/lib/utils";

/**
 * Console design system.
 *
 * The primitives every page in the agency console is built from, so the whole
 * app shares one set of measurements and colours rather than each page
 * re-inventing them. Values come from the design file's own tokens.
 */

export const TOKENS = {
  bg: "#fafafa",
  surface: "#ffffff",
  muted: "#f4f4f5",
  border: "#e5e7eb",
  ink: "#09090b",
  ink2: "#3f3f46",
  ink3: "#52525b",
  soft: "#71717a",
  softer: "#a1a1aa",
  good: "#059669",
  goodDeep: "#047857",
  goodBg: "#ecfdf5",
  bad: "#dc2626",
  badDeep: "#b91c1c",
  badBg: "#fef2f2",
  warn: "#d97706",
  accent: "#2563eb",
  accentBg: "#eff6ff",
} as const;

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
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-[#09090b]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-[#71717a]">{subtitle}</p>}
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
          ? "bg-[#09090b] text-white hover:opacity-90"
          : "border bg-white text-[#3f3f46] hover:bg-[#fafafa]",
        props.className,
      )}
      style={variant === "secondary" ? { borderColor: TOKENS.border, ...props.style } : props.style}
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
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaSuffix?: string;
  sub?: React.ReactNode;
  tone?: "default" | "danger" | "good";
}) {
  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: TOKENS.border }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#a1a1aa]">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono text-[24px] font-bold tracking-[-0.02em]",
            tone === "danger" ? "text-[#dc2626]" : tone === "good" ? "text-[#059669]" : "text-[#09090b]",
          )}
        >
          {value}
        </span>
        {delta != null && (
          <span className={cn("font-mono text-[12px] font-medium", delta >= 0 ? "text-[#059669]" : "text-[#dc2626]")}>
            {delta >= 0 ? "+" : ""}
            {delta}
            {deltaSuffix}
          </span>
        )}
      </div>
      {sub && <p className="mt-1 text-[11px] text-[#71717a]">{sub}</p>}
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
    <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: TOKENS.border }}>
      {title && (
        <div
          className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3"
          style={{ borderColor: TOKENS.border }}
        >
          <div>
            <h2 className="text-[13px] font-semibold text-[#09090b]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-[#a1a1aa]">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={padded ? "p-4" : undefined}>{children}</div>
    </div>
  );
}

/** Segmented control used for the design's page-level tabs. */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; tag?: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
            active === tab.id
              ? "border-[#09090b] bg-[#09090b] text-white"
              : "bg-white text-[#52525b] hover:bg-[#fafafa]",
          )}
          style={active === tab.id ? undefined : { borderColor: TOKENS.border }}
        >
          {tab.label}
          {tab.tag && (
            <span className={cn("font-mono text-[10px]", active === tab.id ? "text-white/70" : "text-[#a1a1aa]")}>
              {tab.tag}
            </span>
          )}
        </button>
      ))}
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
    default: "bg-[#f4f4f5] text-[#3f3f46]",
    good: "bg-[#ecfdf5] text-[#047857]",
    bad: "bg-[#fef2f2] text-[#b91c1c]",
    warn: "bg-[#fffbeb] text-[#b45309]",
    info: "bg-[#eff6ff] text-[#1d4ed8]",
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
        "border-b px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]",
        align === "right" ? "text-right" : "text-left",
        onClick && "cursor-pointer select-none hover:text-[#52525b]",
      )}
      style={{ borderColor: TOKENS.border }}
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
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-3 align-middle", align === "right" ? "text-right" : "text-left", className)}>
      {children}
    </td>
  );
}

export function Tr({ children, className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr {...props} className={cn("border-b transition-colors last:border-0 hover:bg-[#fafafa]", className)} style={{ borderColor: "#f4f4f5", ...props.style }}>
      {children}
    </tr>
  );
}

export function Mono({ children, tone }: { children: React.ReactNode; tone?: "good" | "bad" | "soft" }) {
  return (
    <span
      className={cn(
        "font-mono text-[12px]",
        tone === "good" ? "text-[#059669]" : tone === "bad" ? "text-[#dc2626]" : tone === "soft" ? "text-[#a1a1aa]" : "text-[#3f3f46]",
      )}
    >
      {children}
    </span>
  );
}

/** Horizontal proportion bar used across the citation and share views. */
export function MeterBar({ value, tone = "accent", width = 64 }: { value: number; tone?: "accent" | "good"; width?: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#f4f4f5]" style={{ width }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone === "good" ? TOKENS.good : TOKENS.accent }}
      />
    </div>
  );
}

/** Inline sparkline — no chart library for a 12-point series. */
export function Sparkline({ values, width = 68, height = 22 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="text-[11px] text-[#d4d4d8]">—</span>;

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
        stroke={values[values.length - 1] >= values[0] ? TOKENS.good : TOKENS.bad}
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
    <div className="rounded-xl border border-dashed bg-white p-10 text-center" style={{ borderColor: TOKENS.border }}>
      <p className="text-[14px] font-semibold text-[#09090b]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[12.5px] text-[#71717a]">{what}</p>
      <div className="mx-auto mt-5 max-w-sm rounded-lg bg-[#fafafa] p-3 text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#a1a1aa]">Needs</p>
        <ul className="mt-1.5 space-y-1">
          {needs.map((need) => (
            <li key={need} className="text-[11.5px] text-[#52525b]">
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
