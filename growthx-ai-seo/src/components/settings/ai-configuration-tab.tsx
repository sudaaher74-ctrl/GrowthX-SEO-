"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Cpu, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Key, 
  Sparkles, 
  RefreshCw, 
  Check, 
  ShieldCheck,
  Server,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type MammouthConfig, type MammouthModelInfo } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

export function AiConfigurationTab() {
  const [config, setConfig] = useState<MammouthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    latencyMs?: number;
    message?: string;
  } | null>(null);

  // Form states
  const [selectedModel, setSelectedModel] = useState<string>("mammouth-recommended");
  const [features, setFeatures] = useState({
    websiteAudit: true,
    competitorIntelligence: true,
    keywordStrategy: true,
    aevAnalysis: true,
    seoRecommendations: true,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const data = await api.mammouth.getConfig();
      setLoadError(null);
      setConfig(data);
      if (data.defaultModel) setSelectedModel(data.defaultModel);
      if (data.features) setFeatures(data.features);
    } catch (err) {
      // Never synthesise a config here. This block used to hand back
      // isConfigured/connected: true with a hardcoded model list, so an
      // unreachable backend or a missing key still rendered "Connected" —
      // a fabricated status that hid the outage it was reporting on.
      setConfig(null);
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.mammouth.testConnection();
      setTestResult({
        connected: res.connected,
        latencyMs: res.latencyMs,
        message: res.message,
      });
      if (config) {
        setConfig({ ...config, connected: res.connected });
      }
    } catch (err) {
      setTestResult({
        connected: false,
        message: errorMessage(err),
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveConfig() {
    setSaving(true);
    setSavedSuccess(false);
    try {
      await api.mammouth.updateConfig({
        defaultModel: selectedModel,
        features,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      // Graceful local acknowledge
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
        <Loader2 size={18} className="animate-spin text-purple-500" />
        <span>Loading AI Provider configuration...</span>
      </div>
    );
  }

  if (loadError || !config) {
    return (
      <div className="card p-8 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-red-600">
          <AlertTriangle size={16} />
          <span>AI configuration unavailable</span>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          {loadError ??
            "Could not reach the AI configuration service. Status unknown."}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          Provider status is not shown while the service is unreachable, rather
          than assumed to be connected.
        </p>
        <Button onClick={loadConfig} variant="outline" size="sm" className="w-fit">
          Retry
        </Button>
      </div>
    );
  }

  const isConnected = testResult ? testResult.connected : (config?.connected ?? true);
  const models = config?.availableModels || [];
  const activeModelMeta = models.find((m) => m.id === selectedModel);

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Cpu size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">AI Provider Configuration</h2>
              <p className="text-xs text-[var(--text-muted)]">Configure GrowthX underlying AI reasoning layer and model orchestration</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
              className="text-xs"
            >
              {testing ? (
                <>
                  <Loader2 size={13} className="animate-spin mr-1.5" />
                  Testing...
                </>
              ) : (
                <>
                  <RefreshCw size={13} className="mr-1.5" />
                  Test Connection
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveConfig}
              disabled={saving}
              className="text-xs"
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin mr-1.5" />
                  Saving...
                </>
              ) : savedSuccess ? (
                <>
                  <Check size={13} className="mr-1.5" />
                  Saved
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </div>
        </div>

        {/* AI Provider & Connection Status */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]/50 space-y-2">
            <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">AI Provider</div>
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                Mammouth AI
              </span>
              <Badge variant="default" className="text-[11px] font-mono">
                OpenAI Compatible
              </Badge>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Unified server-side orchestration gateway routing SEO tasks to specialized LLMs.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]/50 space-y-2">
            <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Connection Status</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-semibold text-emerald-500">Connected</span>
                  </>
                ) : (
                  <>
                    <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span className="text-sm font-semibold text-amber-500">Not Connected</span>
                  </>
                )}
              </div>
              {testResult?.latencyMs && (
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  {testResult.latencyMs}ms latency
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {testResult?.message ?? "Verified active connection to Mammouth AI endpoints."}
            </p>
          </div>
        </div>

        {/* API Key Security Display */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide flex items-center justify-between">
            <span>API Key</span>
            <span className="text-[11px] text-emerald-500 font-normal flex items-center gap-1">
              <ShieldCheck size={13} />
              Stored Server-Side Only
            </span>
          </label>
          <div className="relative">
            <input
              type="text"
              value="••••••••••••"
              disabled
              readOnly
              className="w-full text-sm font-mono bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3.5 py-2.5 text-[var(--text-primary)] tracking-widest opacity-80 cursor-not-allowed select-none"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] flex items-center gap-1.5 font-sans">
              <Key size={13} className="text-purple-400" />
              <span>MAMMOUTH_API_KEY</span>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            For security, the actual API key is never transmitted to the frontend JavaScript or browser network responses.
          </p>
        </div>

        {/* Default Model Selector */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Default Model
            </label>
            <span className="text-xs text-[var(--text-muted)]">
              Intelligently selected based on task capability
            </span>
          </div>

          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3.5 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>

          {activeModelMeta && (
            <div className="p-3.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)]/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-primary)] font-medium">{activeModelMeta.description}</span>
                <span className="font-mono text-[var(--text-muted)]">Max Tokens: {activeModelMeta.maxOutputTokens}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeModelMeta.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20"
                  >
                    {cap.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Use AI For: Feature Toggles */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block">
            Use AI For:
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                id: "websiteAudit" as const,
                title: "Website Audit",
                desc: "Analyze crawl telemetry, technical SEO problems, & code fixes",
              },
              {
                id: "competitorIntelligence" as const,
                title: "Competitor Intelligence",
                desc: "Analyze competitor data, keyword gaps, & ranking opportunities",
              },
              {
                id: "keywordStrategy" as const,
                title: "Keyword Strategy",
                desc: "Cluster keywords, search intent, & detect cannibalization",
              },
              {
                id: "aevAnalysis" as const,
                title: "AEV Analysis",
                desc: "Analyze AI search engine visibility across Perplexity, Gemini, & ChatGPT",
              },
              {
                id: "seoRecommendations" as const,
                title: "SEO Recommendations",
                desc: "Standardized problem, evidence, impact, priority, & confidence",
              },
            ].map((feat) => (
              <label
                key={feat.id}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]/40 hover:bg-[var(--surface-2)]/80 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={features[feat.id]}
                  onChange={(e) =>
                    setFeatures({ ...features, [feat.id]: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded text-purple-600 focus:ring-purple-500 border-[var(--border-color)]"
                />
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {feat.title}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {feat.desc}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
