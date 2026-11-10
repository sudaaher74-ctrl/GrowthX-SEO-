"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Globe2,
  SlidersHorizontal,
  Check,
  X,
  Loader2,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { api, type AiVisibilitySettings, type VisibilityReport } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface IndiaLocalizationDockProps {
  projectId: string;
}

const AVAILABLE_LANGUAGES = [
  { code: "en", name: "English", localName: "English", default: true },
  { code: "hi", name: "Hindi", localName: "हिंदी", default: false },
  { code: "hinglish", name: "Hinglish", localName: "Hinglish (Latin)", default: false },
  { code: "mr", name: "Marathi", localName: "मराठी", default: false },
];

export function IndiaLocalizationDock({ projectId }: IndiaLocalizationDockProps) {
  const queryClient = useQueryClient();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch settings
  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ["ai-visibility-settings", projectId],
    queryFn: () => api.getAiVisibilitySettings(projectId),
  });

  // Fetch latest report for language split and engine support
  const { data: report } = useQuery({
    queryKey: ["ai-visibility-report-latest", projectId],
    queryFn: () => api.getVisibility(projectId, 28),
  });

  // Local draft state for settings modal
  const [draftCity, setDraftCity] = useState<string>("");
  const [draftLanguages, setDraftLanguages] = useState<string[]>(["en"]);

  const openModal = () => {
    setDraftCity(settings?.targetCity || "");
    setDraftLanguages(
      settings?.targetLanguages && settings.targetLanguages.length > 0
        ? settings.targetLanguages
        : ["en"],
    );
    setIsConfigOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: (newSettings: { targetCity?: string | null; targetLanguages?: string[] }) =>
      api.updateAiVisibilitySettings(projectId, newSettings),
    onSuccess: (updated) => {
      queryClient.setQueryData(["ai-visibility-settings", projectId], updated);
      queryClient.invalidateQueries({ queryKey: ["ai-visibility-settings", projectId] });
      queryClient.invalidateQueries({ queryKey: ["ai-visibility-report-latest", projectId] });
      queryClient.invalidateQueries({ queryKey: ["ai-visibility", projectId] });
      setIsConfigOpen(false);
      setToastMessage("India localization & language preferences updated.");
      setTimeout(() => setToastMessage(null), 4000);
    },
    onError: (err: any) => {
      setToastMessage(`Error: ${err?.message || "Failed to update settings"}`);
      setTimeout(() => setToastMessage(null), 5000);
    },
  });

  const toggleLanguage = (code: string) => {
    if (code === "en") return; // English is mandatory base
    setDraftLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
    );
  };

  const handleSave = () => {
    updateMutation.mutate({
      targetCity: draftCity.trim() || null,
      targetLanguages: draftLanguages,
    });
  };

  const targetCity = settings?.targetCity || null;
  const activeLanguages = settings?.targetLanguages || ["en"];
  const byLanguage = report?.byLanguage || [];
  const engines = report?.locationSupport?.engines || [
    { assistant: "GEMINI", name: "Google Gemini", locationSupported: true, statusText: targetCity ? `Targeted to ${targetCity}, India via Google Grounding` : "Targeted to India" },
    { assistant: "PERPLEXITY", name: "Perplexity", locationSupported: true, statusText: targetCity ? `Targeted to ${targetCity}, India via web retrieval` : "Targeted to India" },
    { assistant: "OPENAI", name: "ChatGPT", locationSupported: false, statusText: "Not measured (city location context not supported by engine)" },
    { assistant: "ANTHROPIC", name: "Claude", locationSupported: false, statusText: "Not measured (city location context not supported by engine)" },
  ];

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toastMessage && (
        <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2 px-4 py-2 text-xs font-medium text-brand-950 animate-in fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-brand-400 hover:text-brand-900">
            ✕
          </button>
        </div>
      )}

      {/* Main Localization Banner / Card */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-card">
        <div className="flex flex-col justify-between gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-brand-700">
              <Globe2 size={16} className="text-signal-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-brand-950">
                  India-Aware AI Visibility
                </h3>
                <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 border border-line">
                  <span>🇮🇳 IN</span>
                  {targetCity && <span>· {targetCity}</span>}
                </span>
              </div>
              <p className="text-[11px] text-brand-500">
                Tracking buyer prompts in {activeLanguages.map((l) => AVAILABLE_LANGUAGES.find((al) => al.code === l)?.name || l).join(", ")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-surface-3 transition cursor-pointer"
            >
              <SlidersHorizontal size={13} className="text-brand-500" />
              <span>Configure Target & Languages</span>
            </button>
          </div>
        </div>

        {/* Visibility Split by Language Grid */}
        {byLanguage.length > 0 && (
          <div className="border-b border-line bg-surface-1 p-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-500">
              AI Visibility Split by Language
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {byLanguage.map((item) => (
                <div
                  key={item.language}
                  className="rounded-lg border border-line bg-surface-2/40 p-3"
                >
                  <div className="flex items-center justify-between text-xs text-brand-600">
                    <span className="font-semibold text-brand-950">{item.label}</span>
                    <span className="font-mono text-[10.5px] text-brand-500">
                      {item.cited}/{item.checked}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-2xl font-extrabold text-brand-950">
                    {item.citationSharePct}%
                  </div>
                  <div className="mt-0.5 text-[10px] text-brand-500">
                    {item.cited} citations in {item.checked} answers
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Engine Geo-Targeting Capability Status */}
        <div className="bg-surface-2/30 px-4 py-2.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-brand-600">
            <span className="font-semibold text-brand-800">Engine Geo-Targeting:</span>
            {engines.map((eng) => (
              <span key={eng.assistant} className="flex items-center gap-1">
                {eng.locationSupported ? (
                  <CheckCircle2 size={12} className="text-success-600 shrink-0" />
                ) : (
                  <Info size={12} className="text-brand-400 shrink-0" />
                )}
                <span className="font-medium text-brand-950">{eng.name}:</span>
                <span className={eng.locationSupported ? "text-brand-600" : "text-brand-400 italic"}>
                  {eng.statusText}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface-1 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-signal-400" />
                <h3 className="text-sm font-bold text-brand-950">India Localization Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="text-brand-400 hover:text-brand-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* City Setting */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-brand-950">
                  Target City or Metro Area (Optional)
                </label>
                <input
                  type="text"
                  value={draftCity}
                  onChange={(e) => setDraftCity(e.target.value)}
                  placeholder="e.g. Mumbai, Pune, Bangalore, Delhi NCR, Panvel"
                  className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-brand-950 focus:border-signal-400 focus:outline-none"
                />
                <p className="text-[11px] text-brand-500">
                  Passed to engines with local search support (Gemini & Perplexity). Leave blank for national India coverage.
                </p>
              </div>

              {/* Language Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-brand-950">
                  Target Indian Languages
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_LANGUAGES.map((lang) => {
                    const isSelected = draftLanguages.includes(lang.code);
                    const isDefault = lang.code === "en";
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => toggleLanguage(lang.code)}
                        disabled={isDefault}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-2.5 text-left text-xs transition cursor-pointer",
                          isSelected
                            ? "border-signal-400 bg-signal-400/10 text-brand-950 font-bold"
                            : "border-line bg-surface-2 text-brand-600 hover:bg-surface-3",
                          isDefault && "opacity-80 cursor-not-allowed"
                        )}
                      >
                        <div>
                          <div>{lang.name}</div>
                          <div className="text-[10px] text-brand-400 font-normal">{lang.localName}</div>
                        </div>
                        {isSelected && <Check size={14} className="text-signal-700" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-brand-500">
                  When active, Reigel translates and monitors your prompts in natural Indian language variants across the multi-LLM router.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-surface-3 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateMutation.isPending}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition disabled:opacity-50"
              >
                {updateMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                <span>Save Preferences</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

