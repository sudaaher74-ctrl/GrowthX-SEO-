import React from "react";
import { ArrowRightLeft, FileCode, Globe, Layers, Shield, Smartphone, Zap } from "lucide-react";

export function severityTone(sev: string): string {
  switch (sev) {
    case "CRITICAL":
      return "bg-error-50 text-error-700 border-error-200/50";
    case "HIGH":
      return "bg-warning-50 text-warning-700 border-warning-200/50";
    case "MEDIUM":
      return "bg-accent-50 text-accent-700 border-accent-200/50";
    default:
      return "bg-brand-100 text-brand-700 border-brand-200/50";
  }
}

export function getHealthBadgeStyle(healthScore: number | null): string {
  if (healthScore == null) return "bg-brand-100 text-brand-500 border-brand-200/50";
  if (healthScore >= 80) return "bg-success-50 text-success-700 border-success-200/50";
  if (healthScore >= 50) return "bg-warning-50 text-warning-700 border-warning-200/50";
  return "bg-error-50 text-error-700 border-error-200/50";
}

export function getHealthStatusText(healthScore: number | null): string {
  if (healthScore == null) return "Not Crawled";
  if (healthScore >= 80) return "Good Health";
  if (healthScore >= 50) return "Needs Work";
  return "Critical Issues";
}

export function getHealthTone(healthScore: number | null): "info" | "good" | "warn" | "bad" {
  if (healthScore == null) return "info";
  if (healthScore >= 80) return "good";
  if (healthScore >= 50) return "warn";
  return "bad";
}

export function getCwvBadgeClass(cwvOverallStatus: string): string {
  if (cwvOverallStatus === "No data") return "bg-brand-100 text-brand-500 border-brand-200/50";
  if (cwvOverallStatus === "Good") return "bg-success-50 text-success-700 border-success-200/50";
  if (cwvOverallStatus === "Needs Work") return "bg-warning-50 text-warning-700 border-warning-200/50";
  return "bg-error-50 text-error-700 border-error-200/50";
}

export function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("crawl") || lower.includes("index")) return <Globe size={13} className="text-accent-500" />;
  if (lower.includes("speed") || lower.includes("perf")) return <Zap size={13} className="text-warning-500" />;
  if (lower.includes("mobile")) return <Smartphone size={13} className="text-brand-400" />;
  if (lower.includes("structure") || lower.includes("schema")) return <FileCode size={13} className="text-success-500" />;
  if (lower.includes("security")) return <Shield size={13} className="text-error-500" />;
  if (lower.includes("redirect")) return <ArrowRightLeft size={13} className="text-series-2" />;
  return <Layers size={13} className="text-brand-400" />;
}
