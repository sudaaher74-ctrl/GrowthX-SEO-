"use client";
import { useEffect, useSyncExternalStore } from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Transient feedback.
 *
 * The app had none: 26 mutations and not one surfaced its error, so a failed
 * save looked exactly like a successful one. The two places that did say
 * something used `window.alert` and `confirm`, which block the page and cannot
 * be styled.
 *
 * The store is module-level rather than a context because the most important
 * caller is not a component — it is the react-query `MutationCache`, which
 * reports every mutation failure in the app from outside the React tree.
 */

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** Optional second line: the underlying error, a hint, what to do next. */
  detail?: string;
}

const DISMISS_AFTER_MS = 6000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(tone: ToastTone, message: string, detail?: string) {
  const id = nextId++;
  // Newest first, and capped: a failing mutation that retries should not be
  // able to bury the page under a column of identical cards.
  toasts = [{ id, tone, message, detail }, ...toasts].slice(0, 4);
  emit();
  if (typeof window !== "undefined") {
    window.setTimeout(() => dismissToast(id), DISMISS_AFTER_MS);
  }
  return id;
}

export const toast = {
  success: (message: string, detail?: string) => push("success", message, detail),
  error: (message: string, detail?: string) => push("error", message, detail),
  info: (message: string, detail?: string) => push("info", message, detail),
};

const EMPTY: Toast[] = [];

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    subscribe,
    () => toasts,
    () => EMPTY,
  );
}

const TONE = {
  success: { icon: Check, ring: "border-success-500/30", accent: "text-success-600", bg: "bg-success-50" },
  error: { icon: AlertTriangle, ring: "border-error-500/30", accent: "text-error-600", bg: "bg-error-50" },
  info: { icon: Info, ring: "border-accent-500/30", accent: "text-accent-700", bg: "bg-accent-50" },
} as const;

/**
 * Mounted once, in `Providers`.
 *
 * `role="status"` on a live region rather than `role="alert"` on each card:
 * assistive tech announces additions to the region without stealing focus,
 * which matters because a toast can arrive while the user is mid-keystroke.
 */
export function Toaster() {
  const items = useToasts();

  // Escape clears the stack, matching every other dismissible surface here.
  useEffect(() => {
    if (items.length === 0) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        toasts = [];
        emit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items.length]);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      role="status"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {items.map((item) => {
        const tone = TONE[item.tone];
        const Icon = tone.icon;
        return (
          <div
            key={item.id}
            className={cn(
              "animate-fade-up pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-white p-3 shadow-lg",
              tone.ring,
            )}
          >
            <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", tone.bg, tone.accent)}>
              <Icon size={13} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-semibold text-brand-950">{item.message}</span>
              {item.detail && (
                <span className="mt-0.5 block break-words text-[11.5px] leading-relaxed text-brand-500">
                  {item.detail}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-md p-1 text-brand-400 transition-colors hover:bg-brand-100 hover:text-brand-950"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
