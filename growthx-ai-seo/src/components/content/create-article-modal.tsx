"use client";

import { useState } from "react";
import { Sparkles, X, Loader2, PenLine, Target, Layers, HelpCircle } from "lucide-react";
import { ActionButton, Pill } from "@/components/ui/console";
import { useCreateContentPiece, useDraftContent } from "@/hooks/use-growthx";

interface CreateArticleModalProps {
  projectId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const FORMAT_OPTIONS = [
  { id: "GEO_PILLAR", label: "Long-form GEO Pillar", desc: "1,500-2,500 words with 45-word answer block & comparison tables" },
  { id: "COMPARISON_REVIEW", label: "Comparison & Review Matrix", desc: "Side-by-side feature matrix & quantitative benchmark table" },
  { id: "HOW_TO_GUIDE", label: "How-To Authority Guide", desc: "Step-by-step procedural breakdown with FAQ schema" },
  { id: "SERVICE_PAGE", label: "Commercial Service Landing Page", desc: "Conversion-optimized with structured proof points & FAQs" },
];

export function CreateArticleModal({ projectId, onClose, onSuccess }: CreateArticleModalProps) {
  const createMutation = useCreateContentPiece(projectId);
  const draftMutation = useDraftContent(projectId);

  const [title, setTitle] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [format, setFormat] = useState("Long-form GEO Pillar");
  const [rationale, setRationale] = useState("");
  const [autoDraft, setAutoDraft] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const created = await createMutation.mutateAsync({
        title: title.trim(),
        targetQuery: targetQuery.trim() || undefined,
        format,
        rationale: rationale.trim() || undefined,
      });

      if (autoDraft && created?.id) {
        await draftMutation.mutateAsync(created.id);
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create content piece. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-brand-200 dark:border-brand-800 px-5 py-4 flex items-center justify-between bg-brand-50/50 dark:bg-brand-900/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-accent-100 dark:bg-accent-950/60 text-accent-700 dark:text-accent-300">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-brand-950 dark:text-brand-100">
                Create GEO-Optimized Article
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Target high-intent search queries and capture Google AI Overview citations.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-brand-400 hover:text-brand-700 dark:hover:text-brand-200 hover:bg-brand-100 dark:hover:bg-brand-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-brand-700 dark:text-brand-300 mb-1">
              Article Working Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Definitive Guide to Enterprise Search Optimization"
              className="w-full h-9 rounded-lg border border-brand-200 dark:border-brand-700 bg-white dark:bg-brand-900 px-3 text-xs text-brand-950 dark:text-brand-100 focus:outline-none focus:ring-1 focus:ring-accent-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-700 dark:text-brand-300 mb-1">
              Target Search Query / Keyword
            </label>
            <input
              type="text"
              value={targetQuery}
              onChange={(e) => setTargetQuery(e.target.value)}
              placeholder="e.g. generative engine optimization best practices"
              className="w-full h-9 rounded-lg border border-brand-200 dark:border-brand-700 bg-white dark:bg-brand-900 px-3 text-xs text-brand-950 dark:text-brand-100 focus:outline-none focus:ring-1 focus:ring-accent-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-700 dark:text-brand-300 mb-1">
              Content Architecture Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full h-9 rounded-lg border border-brand-200 dark:border-brand-700 bg-white dark:bg-brand-900 px-3 text-xs text-brand-950 dark:text-brand-100 focus:outline-none focus:ring-1 focus:ring-accent-600"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.label}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-700 dark:text-brand-300 mb-1">
              Why This Page (Strategic Context & Target Audience)
            </label>
            <textarea
              rows={2}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="e.g. Outrank competitor comparison pages by demonstrating verified benchmarks and pricing transparency."
              className="w-full rounded-lg border border-brand-200 dark:border-brand-700 bg-white dark:bg-brand-900 p-2.5 text-xs text-brand-950 dark:text-brand-100 focus:outline-none focus:ring-1 focus:ring-accent-600"
            />
          </div>

          {/* Auto-Draft Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="autoDraftCheck"
              checked={autoDraft}
              onChange={(e) => setAutoDraft(e.target.checked)}
              className="h-4 w-4 rounded border-brand-300 text-accent-600 focus:ring-accent-500"
            />
            <label htmlFor="autoDraftCheck" className="text-xs text-brand-700 dark:text-brand-300 font-medium">
              Immediately draft full 2,000+ word article using multi-AI reasoning router
            </label>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-brand-200 dark:border-brand-800 pt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-900 transition"
            >
              Cancel
            </button>
            <ActionButton
              variant="primary"
              icon={isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />}
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting ? (autoDraft ? "Generating Article…" : "Planning…") : (autoDraft ? "Generate Article Now" : "Save Plan")}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
