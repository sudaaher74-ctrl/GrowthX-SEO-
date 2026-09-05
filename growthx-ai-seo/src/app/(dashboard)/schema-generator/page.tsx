"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Code, Globe, Copy, CheckCircle, RefreshCw } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader, ActionButton } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";

export default function SchemaGeneratorPage() {
  const { projectId } = useWorkspace();
  const [url, setUrl] = useState("");
  const [schemaType, setSchemaType] = useState("LocalBusiness");
  const [copied, setCopied] = useState(false);

  const generateMut = useMutation({
    mutationFn: async () => {
      if (!projectId || !url.trim()) return null;
      return api.generateSchema(projectId, url, schemaType);
    },
  });

  const handleCopy = () => {
    if (generateMut.data?.schema) {
      navigator.clipboard.writeText(generateMut.data.schema);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-brand-50">
      <PageHeader 
        title="Schema Generator" 
        subtitle="Use AI to automatically build 100% compliant JSON-LD schema based on your page content." 
      />

      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-xl border p-6 border-brand-100 shadow-sm">
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-brand-950">Generate Schema</h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[11px] font-medium text-brand-500 mb-1.5 block uppercase tracking-wider">Target URL</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Globe size={14} className="text-brand-400" />
                  </div>
                  <input 
                    placeholder="https://example.com/about" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="pl-9 h-10 w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-[13px] text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  />
                </div>
              </div>
              <div className="w-64">
                <label className="text-[11px] font-medium text-brand-500 mb-1.5 block uppercase tracking-wider">Schema Type</label>
                <select 
                  value={schemaType}
                  onChange={(e) => setSchemaType(e.target.value)}
                  className="w-full h-10 rounded-md border border-brand-200 bg-white px-3 py-2 text-[13px] text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                >
                  <option value="LocalBusiness">Local Business</option>
                  <option value="FAQPage">FAQ Page</option>
                  <option value="Article">Article / Blog Post</option>
                  <option value="Organization">Organization</option>
                  <option value="Product">Product</option>
                  <option value="Event">Event</option>
                </select>
              </div>
              <div className="flex items-end">
                <ActionButton 
                  onClick={() => generateMut.mutate()} 
                  disabled={!url.trim() || generateMut.isPending}
                  className="h-10 px-5 gap-2"
                >
                  {generateMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Generate with AI
                </ActionButton>
              </div>
            </div>
          </div>
        </div>

        {generateMut.isPending && (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl bg-blue-500/20 animate-pulse"></div>
              <Sparkles className="relative text-blue-500 animate-bounce" size={32} />
            </div>
            <p className="text-sm font-medium text-brand-950">Scraping URL and writing Schema...</p>
          </div>
        )}

        {generateMut.data && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white rounded-xl border border-brand-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-brand-200 bg-brand-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Code size={14} className="text-brand-950" />
                  <span className="text-[13px] font-semibold text-brand-950">Generated JSON-LD ({schemaType})</span>
                </div>
                <button 
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-brand-950 bg-white border border-brand-200 hover:bg-brand-100 px-2.5 py-1.5 rounded-md transition"
                >
                  {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Copy code"}
                </button>
              </div>
              <div className="p-4 bg-brand-900 overflow-x-auto">
                <pre className="text-[13px] text-brand-200 font-mono whitespace-pre-wrap">
                  {generateMut.data.schema}
                </pre>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-6 border-brand-200 bg-blue-50/50">
              <h4 className="text-[13px] font-semibold text-brand-950 mb-2">AI Rationale</h4>
              <p className="text-[13px] text-brand-700 leading-relaxed">
                {generateMut.data.rationale}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
