"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQS } from "@/lib/faqs";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="bg-brand-950 py-24 lg:py-32 border-b border-brand-900 relative scroll-mt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-series-6">
            Frequently Asked Questions
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight">
            Everything you need to know.
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.q}
                className="bg-brand-900/50 border border-brand-800 rounded-2xl overflow-hidden transition-colors hover:border-brand-700/80"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="text-sm sm:text-base font-bold text-white">
                    {faq.q}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`text-brand-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-series-400" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-brand-300 leading-relaxed border-t border-brand-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
