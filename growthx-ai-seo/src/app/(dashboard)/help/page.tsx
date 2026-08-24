"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { HelpCircle, Book, MessageCircle, Video, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const faqs = [
  { q: "How do I connect Google Search Console?", a: "Go to Settings → Integrations and click 'Connect' next to Google Search Console. You'll be redirected to Google's OAuth flow. Select your property and authorize GrowthX to read your data." },
  { q: "How often is ranking data updated?", a: "Rank tracking is updated daily for all tracked keywords. GSC data has a 2-3 day delay from Google, which is standard across all SEO tools." },
  { q: "Is the AI-generated content safe to publish?", a: "Yes, but always review before publishing. Our platform requires human approval before any content goes live, in line with Google's E-E-A-T guidelines. Never publish AI content without editing." },
  { q: "What is GEO / AI Search Optimization?", a: "GEO (Generative Engine Optimization) is the practice of optimizing your content to appear in AI-generated answers on platforms like Google AI Overviews, ChatGPT, Perplexity, and Gemini." },
  { q: "Can I white-label reports for clients?", a: "Yes, on the Agency plan you can add your logo, brand colors, and remove GrowthX branding from all PDF/Excel reports." },
];

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-8 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-h1 text-[var(--text-primary)]">Help & Support</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Docs, FAQs, and support channels</p>
      </motion.div>

      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { icon: <Book size={20}/>, label: "Documentation", desc: "Full platform guide", color: "text-series-6", bg: "bg-brand-100" },
          { icon: <Video size={20}/>, label: "Video Tutorials", desc: "Watch & learn", color: "text-accent-600", bg: "bg-accent-50" },
          { icon: <MessageCircle size={20}/>, label: "Live Chat", desc: "Chat with support", color: "text-success-600", bg: "bg-success-50" },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="card p-5 flex items-center gap-4 cursor-pointer hover:shadow-card-hover">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
              <span className={item.color}>{item.icon}</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">{item.label}</div>
              <div className="text-xs text-[var(--text-muted)]">{item.desc}</div>
            </div>
          </motion.div>
        ))}
      </div>

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
