import type { IssueSeverity } from "@/lib/api-client";

/**
 * The words the customer-facing screens use for things the audit measures.
 *
 * Every customer is assumed to have never heard the word "SEO". The dashboard
 * and the action plan both describe the same problems, so they share one
 * vocabulary here rather than each inventing its own: a problem called
 * "Important" on one screen must not be "HIGH" on the next.
 */
export const SEVERITY_PLAIN: Record<IssueSeverity, { label: string; tone: "bad" | "warn" | "info" | "default"; bar: string }> = {
  CRITICAL: { label: "Urgent", tone: "bad", bar: "bg-error-600" },
  HIGH: { label: "Important", tone: "warn", bar: "bg-warning-500" },
  MEDIUM: { label: "Moderate", tone: "info", bar: "bg-accent-500" },
  LOW: { label: "Minor", tone: "default", bar: "bg-brand-300" },
};

export const SEVERITY_ORDER: IssueSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

/** The audit's copy is written without a closing full stop; some fallbacks have one. */
export function asSentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * Who can make this fix, read off the fix's own instructions.
 *
 * The audit's copy for each problem already says it in words — "You can do
 * this yourself" or "Ask your web developer" — so this only surfaces that
 * sentence as a label. Null when the instructions don't say.
 */
export function whoCanFix(action: string | null | undefined): "yourself" | "developer" | null {
  const text = action ?? "";
  if (/\bask your (web )?developer\b/i.test(text)) return "developer";
  if (/\byou can (do|write|add|change|fix|update)\b[^.]*\byourself\b/i.test(text)) return "yourself";
  return null;
}

/** "/products/milk" from "https://www.example.in/products/milk" — the part a person recognises. */
export function pagePath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url;
  }
}
