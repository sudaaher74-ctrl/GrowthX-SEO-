import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GOOGLE_VIEWS, type GoogleGroup } from "@/components/google/nav";

/** The deeper views that belong to one page, offered once the simple page has been read. */
export function MoreLinks({ group }: { group: GoogleGroup }) {
  const views = GOOGLE_VIEWS.filter((v) => v.group === group);
  return (
    <section className="space-y-2">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">See more</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {views.map((v) => (
          <Link key={v.id} href={v.href} className="group flex items-start justify-between gap-2 rounded-xl border bg-white p-3 hover:bg-primary-50">
            <span>
              <span className="block text-[12.5px] font-semibold text-brand-950">{v.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-brand-500">{v.will}</span>
            </span>
            <ArrowRight size={14} className="mt-0.5 shrink-0 text-brand-400 group-hover:text-primary-700" />
          </Link>
        ))}
      </div>
    </section>
  );
}
