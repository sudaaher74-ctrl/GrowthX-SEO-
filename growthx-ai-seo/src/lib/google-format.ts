import type { GoogleKpi } from "@/lib/api-client";

/** "—" is what an unmeasured figure shows. It is never a zero. */
export const DASH = "—";

export const count = (n: number | null | undefined) => (n == null ? DASH : Math.round(n).toLocaleString("en-US"));
export const percent = (rate: number | null | undefined, digits = 1) =>
  rate == null ? DASH : `${(rate * 100).toFixed(digits)}%`;
export const position = (p: number | null | undefined) => (p == null ? DASH : p.toFixed(1));
export const money = (n: number | null | undefined) =>
  n == null ? DASH : n.toLocaleString("en-US", { maximumFractionDigits: 0 });

export function duration(seconds: number | null | undefined): string {
  if (seconds == null) return DASH;
  const s = Math.round(seconds);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

export function formatKpi(kpi: Pick<GoogleKpi, "format" | "value">): string {
  if (kpi.value === null) return DASH;
  switch (kpi.format) {
    case "percent":
      return percent(kpi.value);
    case "position":
      return position(kpi.value);
    case "currency":
      return money(kpi.value);
    default:
      return count(kpi.value);
  }
}

export const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** The address without its host, which is what a person scans for. */
export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url;
  }
}
