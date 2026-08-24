"use client";
import { useEffect, useRef } from "react";

/**
 * The keyboard half of a modal.
 *
 * The app has nine of them across the Content Intelligence pages, and every one
 * could only be dismissed by clicking its backdrop or its close button — no
 * Escape, no focus management. Opening one left focus behind it on the page, so
 * a keyboard user tabbed through the whole document underneath while the dialog
 * sat on top of it, and had no way out without a mouse.
 *
 * Returns a ref to put on the dialog panel. Pair it with `role="dialog"`,
 * `aria-modal="true"` and an `aria-labelledby` pointing at the modal's heading.
 */
export function useModalA11y<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const panelRef = useRef<T>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  // Kept in a ref so the effect does not re-run every time the parent
  // re-renders with a fresh arrow function. Written in an effect rather than
  // during render, which React forbids: a render can be thrown away, and this
  // would leave the ref holding a callback from an attempt that never
  // committed.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    // Focus the first thing worth typing into, falling back to the panel so
    // focus is inside the dialog either way.
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>(
      "input:not([type=hidden]), select, textarea, button, [href], [tabindex]:not([tabindex='-1'])",
    );
    (firstField ?? panel)?.focus?.();

    function focusables(): HTMLElement[] {
      return Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
        ) ?? [],
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      // Cycle within the dialog rather than walking into the page behind it.
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!panelRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    // The page behind a modal should not scroll under it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus?.();
    };
  }, [open]);

  return panelRef;
}
