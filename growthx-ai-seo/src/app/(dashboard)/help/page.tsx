"use client";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const faqs = [
  { q: "How do I connect Google Search Console?", a: "Open Integrations and click 'Connect Google' next to Google Search Console. You'll be redirected to Google's OAuth flow. Select your property and authorize Reigel to read your data." },
  { q: "How often is ranking data updated?", a: "Rank tracking is updated daily for all tracked keywords. GSC data has a 2-3 day delay from Google, which is standard across all SEO tools." },
  { q: "Is the AI-generated content safe to publish?", a: "Yes, but always review before publishing. Our platform requires human approval before any content goes live, in line with Google's E-E-A-T guidelines. Never publish AI content without editing." },
  { q: "What is GEO / AI Search Optimization?", a: "GEO (Generative Engine Optimization) is the practice of optimizing your content to appear in AI-generated answers on platforms like Google AI Overviews, ChatGPT, Perplexity, and Gemini." },
  { q: "Can I white-label reports for clients?", a: "Yes, on the Agency plan you can add your logo, brand colors, and remove Reigel branding from all PDF/Excel reports." },
];

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-8 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-h1 text-[var(--text-primary)]">Help & Support</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Answers to common questions about Reigel</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Frequently Asked Questions</h3>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="card overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-5 py-3 text-left">
                <span className="text-sm font-semibold text-[var(--text-primary)]">{faq.q}</span>
                {open === i ? <ChevronUp size={15} className="shrink-0 text-[var(--text-muted)]"/> : <ChevronDown size={15} className="shrink-0 text-[var(--text-muted)]"/>}
              </button>
              {open === i && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pb-4 text-sm text-[var(--text-secondary)] leading-relaxed">
                  {faq.a}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
