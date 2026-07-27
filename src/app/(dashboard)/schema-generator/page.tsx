"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Code2, Plus, Copy, CheckCircle2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

const schemaTypes = [
  { id: "Organization", label: "Organization", icon: "🏢", desc: "Business identity and contact info" },
  { id: "LocalBusiness", label: "LocalBusiness", icon: "📍", desc: "Local business with location data" },
  { id: "Product", label: "Product", icon: "📦", desc: "Product with price and availability" },
  { id: "FAQPage", label: "FAQ Page", icon: "❓", desc: "Questions and answers" },
  { id: "Article", label: "Article", icon: "📄", desc: "Blog posts and news articles" },
  { id: "BreadcrumbList", label: "Breadcrumb", icon: "🗂️", desc: "Navigation breadcrumb trail" },
  { id: "Review", label: "Review", icon: "⭐", desc: "Product or service reviews" },
  { id: "HowTo", label: "HowTo", icon: "📋", desc: "Step-by-step instructions" },
];

const generatedSchema = `{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "MilQuu Fresh Dairy",
  "description": "Fresh cow and buffalo milk delivery in Navi Mumbai",
  "url": "https://milquu.com",
  "telephone": "+91-98765-43210",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Sector 15, Panvel",
    "addressLocality": "Panvel",
    "addressRegion": "Maharashtra",
    "postalCode": "410206",
    "addressCountry": "IN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 18.9894,
    "longitude": 73.1175
  },
  "openingHours": ["Mo-Su 05:00-09:00"],
  "priceRange": "₹₹",
  "servesCuisine": "Dairy Products",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "312"
  }
}`;

export default function SchemaGeneratorPage() {
  const [selected, setSelected] = useState("LocalBusiness");
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(generatedSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Schema Generator</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Generate and validate structured data markup automatically</p>
        </div>
        <Button variant="primary" size="sm" icon={<Sparkles size={13}/>} onClick={() => setGenerated(true)}>
          AI Auto-Fill from URL
        </Button>
      </motion.div>

      <div className="grid xl:grid-cols-3 gap-6">
        {/* Schema Type Selector */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Schema Type</h3>
          <div className="space-y-2">
            {schemaTypes.map(type => (
              <button key={type.id} onClick={() => setSelected(type.id)}
                className={cn("w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-base",
                  selected === type.id
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                    : "border-[var(--border-color)] hover:border-[var(--border-strong)] bg-[var(--surface-1)]"
                )}>
                <span className="text-xl">{type.icon}</span>
                <div>
                  <div className={cn("text-sm font-semibold", selected === type.id ? "text-indigo-600 dark:text-indigo-400" : "text-[var(--text-primary)]")}>{type.label}</div>
                  <div className="text-xs text-[var(--text-muted)]">{type.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Form + Output */}
        <div className="xl:col-span-2 space-y-4">
          {/* Form fields */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{selected} Properties</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: "Business Name", value: "MilQuu Fresh Dairy" },
                { label: "URL", value: "https://milquu.com" },
                { label: "Phone", value: "+91-98765-43210" },
                { label: "Address", value: "Sector 15, Panvel, MH 410206" },
                { label: "Rating", value: "4.8" },
                { label: "Review Count", value: "312" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">{label}</label>
                  <input defaultValue={value} className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"/>
                </div>
              ))}
            </div>
            <Button variant="primary" size="sm" className="mt-4" icon={<Code2 size={13}/>} onClick={() => setGenerated(true)}>
              Generate Schema
            </Button>
          </motion.div>

          {/* Generated Output */}
          {generated && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"/>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Generated JSON-LD</span>
                  <Badge variant="success">Valid</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={copy} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-base">
                    {copied ? <><CheckCircle2 size={12} className="text-emerald-500"/> Copied!</> : <><Copy size={12}/> Copy</>}
                  </button>
                </div>
              </div>
              <pre className="p-4 text-xs font-mono text-emerald-400 dark:text-emerald-300 bg-slate-900 dark:bg-slate-950 overflow-x-auto leading-relaxed">
                {generatedSchema}
              </pre>
              <div className="px-4 py-3 border-t border-[var(--border-color)] flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-900/10">
                <CheckCircle2 size={13} className="text-emerald-500"/>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Schema validated — no errors found. Ready to add to your page.</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
