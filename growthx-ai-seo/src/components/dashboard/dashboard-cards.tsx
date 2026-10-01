import React from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className={cn("rounded-2xl border border-brand-200/50 bg-brand-50/90 p-4.5 sm:p-5 shadow-sm", className)}
    >
      {children}
    </section>
  );
}

export function CardHead({ title, subtitle, aside }: { title: string; subtitle?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[14px] font-bold text-brand-950 tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 max-w-md text-[11.5px] leading-normal text-brand-400">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

export function LoadingLine({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-[12.5px] text-brand-400">
      <Loader2 size={14} className="animate-spin" />
      {text}
    </div>
  );
}

export function EmptyPrompt({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  action?: { label: string; href?: string; onClick?: () => void; disabled?: boolean };
}) {
  const button =
    "inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-4 py-2.5 text-[12.5px] font-bold text-signal-ink hover:bg-signal-500 disabled:opacity-50";
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-200 text-signal-400">
        <Icon size={18} />
      </div>
      <p className="mt-3 text-[14px] font-semibold text-brand-950">{title}</p>
      <p className="mt-1 max-w-sm text-[12.5px] text-brand-500">{body}</p>
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link href={action.href} className={button}>
              {action.label}
              <ArrowRight size={13} />
            </Link>
          ) : (
            <button type="button" onClick={action.onClick} disabled={action.disabled} className={button}>
              {action.label}
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
