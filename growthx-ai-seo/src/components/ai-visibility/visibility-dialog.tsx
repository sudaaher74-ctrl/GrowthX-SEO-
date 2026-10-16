"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { ActionButton } from "@/components/ui/console";

/** Native modal keeps focus, scrolling, Escape and backdrop dismissal consistent. */
export function VisibilityDialog({ title, onClose, children, closeLabel = "Close" }: {
  title: string; onClose: () => void; children: ReactNode; closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-2xl border bg-white p-0 text-brand-950 shadow-card-hover backdrop:bg-brand-950/50">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white p-4">
        <h2 id={titleId} className="text-base font-semibold">{title}</h2>
        <ActionButton onClick={onClose}>{closeLabel}</ActionButton>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}
