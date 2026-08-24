"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Confirmation for destructive actions.
 *
 * Replaces `window.confirm`, which blocks the whole browser, cannot be styled,
 * says "localhost:3000 says", and gives the same two grey buttons whether the
 * user is deleting a competitor account or dismissing a tooltip.
 *
 * The API is promise-shaped on purpose, so a call site reads the way the
 * `confirm()` it replaces did:
 *
 *     if (await confirmAction({ ... })) remove.mutate(id);
 */

export interface ConfirmOptions {
  title: string;
  /** What will happen, in plain language. Say what is irreversible. */
  body?: string;
  /** Label for the confirming button. Name the action — not "OK". */
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

let pending: PendingConfirm | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  // A second request while one is open resolves the first as cancelled rather
  // than stacking dialogs or leaving a promise that never settles.
  pending?.resolve(false);
  return new Promise<boolean>((resolve) => {
    pending = { ...options, resolve };
    emit();
  });
}

function settle(confirmed: boolean) {
  pending?.resolve(confirmed);
  pending = null;
  emit();
}

export function ConfirmHost() {
  const current = useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  );
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!current) {
      restoreFocusTo.current?.focus?.();
      return;
    }
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") settle(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [current]);

  if (!current) return null;

  const danger = current.tone !== "default";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <button
        aria-label={current.cancelLabel ?? "Cancel"}
        tabIndex={-1}
        onClick={() => settle(false)}
        className="fixed inset-0 cursor-default bg-brand-950/30 backdrop-blur-sm"
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={current.body ? "confirm-body" : undefined}
        // The dialog holds only two controls, so trapping focus is a matter of
        // not letting Tab leave them for the page behind the backdrop.
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            event.preventDefault();
            const buttons = event.currentTarget.querySelectorAll("button");
            const next = document.activeElement === buttons[0] ? buttons[1] : buttons[0];
            (next as HTMLButtonElement | undefined)?.focus();
          }
        }}
        className="relative z-50 w-full max-w-sm rounded-2xl border bg-white p-5 shadow-2xl"
        style={{ borderColor: "var(--border-strong)" }}
      >
        <div className="flex gap-3">
          {danger && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-error-50 text-error-600">
              <AlertTriangle size={15} />
            </span>
          )}
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-[14px] font-semibold text-brand-950">
              {current.title}
            </h2>
            {current.body && (
              <p id="confirm-body" className="mt-1 text-[12.5px] leading-relaxed text-brand-500">
                {current.body}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => settle(false)}
            className="rounded-lg border bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
          >
            {current.cancelLabel ?? "Cancel"}
          </button>
          <button
            ref={confirmRef}
            onClick={() => settle(true)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90",
              danger ? "bg-error-600" : "bg-brand-950",
            )}
          >
            {current.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
