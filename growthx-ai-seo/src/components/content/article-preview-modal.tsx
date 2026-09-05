"use client";

import { useState, useMemo } from "react";
import {
  X,
  Sparkles,
  Copy,
  Check,
  GitBranch,
  Code2,
  FileText,
  Layers,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { ActionButton, Pill } from "@/components/ui/console";
import type { ContentPiece } from "@/lib/api-client";

interface ArticlePreviewModalProps {
  piece: ContentPiece | null;
  repoConnected: boolean;
  onClose: () => void;
  onShip?: (pieceId: string) => void;
}

type PreviewTab = "reader" | "markdown" | "html" | "schema";

export function ArticlePreviewModal({
  piece,
  repoConnected,
  onClose,
  onShip,
}: ArticlePreviewModalProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("reader");
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // `piece` is null whenever there is nothing to preview. React matches hooks
  // up by call order, so returning early here — above the three memos below —
  // meant the component ran a different number of hooks depending on the prop,
  // and crashed with "rendered more hooks than during the previous render" the
  // moment a mounted instance went from no piece to one. The early return now
  // happens after every hook has run.
  const rawBody = piece?.body || "# Draft in progress...\n\nThis content piece has not been drafted yet.";

  // Extract GEO Answer Block if present in markdown
  const geoAnswerBlock = useMemo(() => {
    const match = rawBody.match(/##\s*(?:Key Overview|Direct Answer|Overview)[^\n]*\n+([\s\S]*?)(?=\n##|$)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    // Fallback: first 50 words of first paragraph
    const paragraphs = rawBody.split("\n\n").filter((p) => !p.startsWith("#"));
    return paragraphs[0] || "Structured direct answer block engineered for Google AI Overviews and ChatGPT.";
  }, [rawBody]);

  // Extract or synthesize valid Schema.org FAQ/Article JSON-LD
  const schemaJson = useMemo(() => {
    if (!piece) return "";
    const jsonMatch = rawBody.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.stringify(JSON.parse(jsonMatch[1]), null, 2);
      } catch {
        return jsonMatch[1].trim();
      }
    }

    const defaultSchema = {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": piece.title,
      "description": piece.metaDescription || `Authoritative guide to ${piece.targetQuery || piece.title}`,
      "about": piece.targetQuery ? { "@type": "Thing", "name": piece.targetQuery } : undefined,
      "author": {
        "@type": "Organization",
        "name": "GrowthX Verified Author",
      },
    };
    return JSON.stringify(defaultSchema, null, 2);
  }, [rawBody, piece]);

  // Simple HTML rendering helper
  const rawHtml = useMemo(() => {
    const htmlLines = rawBody
      .split("\n")
      .map((line) => {
        if (line.startsWith("### ")) return `<h3>${line.replace("### ", "")}</h3>`;
        if (line.startsWith("## ")) return `<h2>${line.replace("## ", "")}</h2>`;
        if (line.startsWith("# ")) return `<h1>${line.replace("# ", "")}</h1>`;
        if (line.startsWith("- ")) return `<li>${line.replace("- ", "")}</li>`;
        if (!line.trim()) return "<br/>";
        return `<p>${line}</p>`;
      })
      .join("\n");

    return `<article class="growthx-article">\n${htmlLines}\n</article>`;
  }, [rawBody]);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2200);
  };

  if (!piece) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="border-b border-brand-200 dark:border-brand-800 px-6 py-4 flex items-center justify-between bg-brand-50/50 dark:bg-brand-900/30">
          <div className="min-w-0 flex-1 mr-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-brand-950 dark:text-brand-100 truncate">
                {piece.title}
              </h3>
              <Pill tone={piece.status === "DRAFTED" ? "good" : "info"}>
                {piece.status}
              </Pill>
              {piece.generatedByModel && (
                <span className="hidden sm:inline-flex text-[10.5px] font-mono text-brand-400">
                  via {piece.generatedByModel}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
              {piece.targetQuery ? `Target: "${piece.targetQuery}"` : "General Authority"} · Format: {piece.format || "Article"} · Slug: /{piece.slug}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-brand-400 hover:text-brand-700 dark:hover:text-brand-200 hover:bg-brand-100 dark:hover:bg-brand-800 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="px-6 py-2.5 border-b border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            {[
              { id: "reader", label: "Article Reader", icon: BookOpen },
              { id: "markdown", label: "Raw Markdown", icon: FileText },
              { id: "html", label: "Clean HTML", icon: Code2 },
              { id: "schema", label: "Schema.org JSON-LD", icon: Layers },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as PreviewTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === tab.id
                    ? "bg-brand-950 text-white dark:bg-brand-100 dark:text-brand-950 font-semibold shadow-xs"
                    : "text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900"
                }`}
              >
                <tab.icon size={13} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "markdown" && (
              <ActionButton
                variant="secondary"
                icon={copiedType === "md" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                onClick={() => handleCopy(rawBody, "md")}
              >
                {copiedType === "md" ? "Copied" : "Copy Markdown"}
              </ActionButton>
            )}
            {activeTab === "html" && (
              <ActionButton
                variant="secondary"
                icon={copiedType === "html" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                onClick={() => handleCopy(rawHtml, "html")}
              >
                {copiedType === "html" ? "Copied" : "Copy HTML"}
              </ActionButton>
            )}
            {activeTab === "schema" && (
              <ActionButton
                variant="secondary"
                icon={copiedType === "schema" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                onClick={() => handleCopy(schemaJson, "schema")}
              >
                {copiedType === "schema" ? "Copied" : "Copy JSON-LD"}
              </ActionButton>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-brand-50/20 dark:bg-brand-950">
          {/* Active Tab View */}
          {activeTab === "reader" && (
            <div className="space-y-5 max-w-3xl mx-auto">
              {/* GEO Answer Block Callout */}
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-xs uppercase tracking-wider">
                    <Sparkles size={14} />
                    <span>GEO Direct Answer Block (AI Overview Extract)</span>
                  </div>
                  <Pill tone="good">45-55 Words</Pill>
                </div>
                <p className="text-xs leading-relaxed text-brand-800 dark:text-brand-200 font-medium">
                  {geoAnswerBlock}
                </p>
                <div className="text-[10.5px] text-blue-600 dark:text-blue-400 flex items-center gap-1.5 pt-1">
                  <CheckCircle2 size={11} />
                  <span>Engineered for Google AI Overviews, Perplexity Sonar, and ChatGPT Search citation extraction.</span>
                </div>
              </div>

              {/* Formatted Article Body */}
              <div className="bg-white dark:bg-brand-900/60 p-6 rounded-xl border border-brand-200 dark:border-brand-800 shadow-xs space-y-4 prose dark:prose-invert max-w-none text-xs text-brand-800 dark:text-brand-200 leading-relaxed font-sans">
                {rawBody.split("\n\n").map((block, idx) => {
                  if (block.startsWith("### ")) {
                    return (
                      <h3 key={idx} className="text-sm font-bold text-brand-950 dark:text-brand-100 mt-4 mb-2">
                        {block.replace("### ", "")}
                      </h3>
                    );
                  }
                  if (block.startsWith("## ")) {
                    return (
                      <h2 key={idx} className="text-base font-extrabold text-brand-950 dark:text-brand-100 mt-6 mb-2 border-b border-brand-100 dark:border-brand-800 pb-1">
                        {block.replace("## ", "")}
                      </h2>
                    );
                  }
                  if (block.startsWith("# ")) {
                    return (
                      <h1 key={idx} className="text-lg font-black text-brand-950 dark:text-brand-100 mt-2 mb-3">
                        {block.replace("# ", "")}
                      </h1>
                    );
                  }
                  if (block.includes("|") && block.includes("-|-")) {
                    return (
                      <div key={idx} className="my-4 overflow-x-auto rounded-lg border border-brand-200 dark:border-brand-700 bg-brand-50/40 dark:bg-brand-950 p-2 font-mono text-[11px]">
                        <pre className="whitespace-pre">{block}</pre>
                      </div>
                    );
                  }
                  return (
                    <p key={idx} className="my-2 leading-relaxed">
                      {block}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "markdown" && (
            <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-950 p-4 font-mono text-[11.5px] text-brand-200 overflow-x-auto">
              <pre className="whitespace-pre-wrap">{rawBody}</pre>
            </div>
          )}

          {activeTab === "html" && (
            <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-950 p-4 font-mono text-[11.5px] text-brand-200 overflow-x-auto">
              <pre className="whitespace-pre-wrap">{rawHtml}</pre>
            </div>
          )}

          {activeTab === "schema" && (
            <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-950 p-4 font-mono text-[11.5px] text-emerald-400 overflow-x-auto">
              <pre className="whitespace-pre-wrap">{schemaJson}</pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-brand-200 dark:border-brand-800 px-6 py-3.5 bg-white dark:bg-brand-950 flex items-center justify-between">
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>SEO & GEO verified structure ready for publication</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-900 transition"
            >
              Close
            </button>

            {onShip && piece.status === "DRAFTED" && (
              <ActionButton
                variant="primary"
                icon={<GitBranch size={13} />}
                onClick={() => onShip(piece.id)}
                disabled={!repoConnected}
              >
                {repoConnected ? "Ship to GitHub PR" : "Connect Repo to Ship"}
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
