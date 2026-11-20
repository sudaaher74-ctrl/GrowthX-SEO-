"use client";

import { useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { FAQS } from "@/lib/faqs";

export function FaqSection() {
  const detailsRefs = useRef<(HTMLDetailsElement | null)[]>([]);
  const [allExpanded, setAllExpanded] = useState(false);

  const syncExpandedState = () => {
    const items = detailsRefs.current.filter((el): el is HTMLDetailsElement => el !== null);
    setAllExpanded(items.length > 0 && items.every((el) => el.open));
  };

  const toggleAll = () => {
    const expand = !allExpanded;
    for (const el of detailsRefs.current) {
      if (el) el.open = expand;
    }
    setAllExpanded(expand);
  };

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="py-24 lg:py-32 border-b border-brand-200 relative scroll-mt-16"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2.5 text-left">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500">
              Frequently Asked Questions
            </p>
            <h2
              id="faq-heading"
              className="text-3xl sm:text-4xl font-extrabold text-brand-950 leading-tight tracking-tight"
            >
              Everything you need to know.
            </h2>
          </div>

          <button
            type="button"
            onClick={toggleAll}
            aria-expanded={allExpanded}
            className="self-start sm:self-auto rounded-full border border-brand-200 bg-surface-1 hover:bg-surface-2 px-3.5 py-1.5 text-xs font-bold text-brand-800 transition-colors cursor-pointer shrink-0"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => (
            <details
              key={faq.q}
              ref={(el) => {
                detailsRefs.current[idx] = el;
              }}
              open={idx === 0}
              onToggle={syncExpandedState}
              className="faq-details group bg-surface-1 border border-brand-200 rounded-2xl overflow-hidden transition-colors hover:border-brand-300 shadow-2xs"
            >
              <summary className="list-none [&::-webkit-details-marker]:hidden w-full text-left p-5 sm:p-6 flex items-center gap-3 cursor-pointer select-none">
                <ChevronRight
                  size={17}
                  aria-hidden="true"
                  className="text-brand-500 shrink-0 motion-safe:transition-transform motion-safe:duration-200 group-open:rotate-90 group-open:text-brand-950"
                />
                <span className="text-sm sm:text-base font-bold text-brand-950 leading-snug">
                  {faq.q}
                </span>
              </summary>
              <div className="px-5 pb-5 sm:px-6 sm:pb-6 pl-12 sm:pl-14 text-xs sm:text-sm text-brand-600 leading-relaxed border-t border-brand-200 pt-3">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
