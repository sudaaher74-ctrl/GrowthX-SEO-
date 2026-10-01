import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GOOGLE_VIEWS, type GoogleGroup } from "@/components/google/nav";

import { cn } from "@/lib/utils";

/** The deeper views that belong to one page, offered once the simple page has been read. */
export function MoreLinks({ group, exclude }: { group: GoogleGroup; exclude?: string[] }) {
  const views = GOOGLE_VIEWS.filter(
    (v) => v.group === group && !v.hidden && (!exclude || !exclude.includes(v.id))
  );
  if (views.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">See more</h2>
      <div
        className={cn(
          "grid gap-2",
          views.length === 1
            ? "grid-cols-1"
            : views.length === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : views.length === 3
            ? "grid-cols-1 sm:grid-cols-3"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        )}
      >
        {views.map((v) => (
          <Link
            key={v.id}
            href={v.href}
            className="group flex items-start justify-between gap-3 rounded-xl border bg-white p-3.5 hover:bg-primary-50 transition-colors"
          >
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-brand-950">{v.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-brand-500">{v.will}</span>
            </span>
            <ArrowRight size={14} className="mt-0.5 shrink-0 text-brand-400 group-hover:text-primary-700 transition-colors" />
          </Link>
        ))}
      </div>
    </section>
  );
}
