"use client";
import React from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  HelpCircle,
  Info,
  Loader2,
  PlugZap,
  RefreshCw,
  Settings2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricState = "MEASURED" | "ESTIMATED" | "UNAVAILABLE" | "NOT_CONFIGURED" | "NOT_CONNECTED";

export interface StateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

interface TruthfulStateProps {
  icon?: React.ElementType;
  title: string;
  missing: string;
  whyItMatters?: string;
  actionRequired?: string;
  action?: StateAction;
  secondaryAction?: StateAction;
  className?: string;
  compact?: boolean;
}

/**
 * Common layout wrapper for truthful states that explains:
 * 1. What is missing
 * 2. Why it matters
 * 3. What action to take
 * 4. Which button to click
 */
export function TruthfulState({
  icon: Icon = Info,
  title,
  missing,
  whyItMatters,
  actionRequired,
  action,
  secondaryAction,
  className,
  compact = false,
}: TruthfulStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-brand-50/40 text-center transition-all",
        compact ? "p-4 sm:p-6" : "p-8 sm:p-12",
        className
      )}
      style={{ borderColor: "var(--border-color)" }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border shadow-sm text-brand-700 mb-3.5">
        <Icon size={18} />
      </div>

      <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-brand-950">{title}</h3>
      <p className="mt-1 text-[12.5px] font-medium text-brand-700 max-w-md">{missing}</p>
      <p className="mt-1 text-[11.5px] text-brand-400 max-w-lg leading-relaxed">{whyItMatters}</p>

      {actionRequired && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-white border px-2.5 py-1 text-[11px] font-medium text-brand-700 shadow-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-600 animate-pulse" />
          <span>Next step: {actionRequired}</span>
        </div>
      )}

      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action &&
            (action.href ? (
              <Link
                href={action.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
                  action.variant === "secondary"
                    ? "border bg-white text-brand-700 hover:bg-brand-50"
                    : "bg-brand-950 text-white hover:opacity-90"
                )}
              >
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
                  action.variant === "secondary"
                    ? "border bg-white text-brand-700 hover:bg-brand-50"
                    : "bg-brand-950 text-white hover:opacity-90"
                )}
              >
                {action.label}
              </button>
            ))}

          {secondaryAction &&
            (secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="flex items-center gap-1.5 rounded-lg border bg-white px-3.5 py-1.5 text-[12px] font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="flex items-center gap-1.5 rounded-lg border bg-white px-3.5 py-1.5 text-[12px] font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
              >
                {secondaryAction.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/** 1. Not Configured State */
export function NotConfiguredState({
  title = "Feature Not Configured",
  missing = "This service or target has not been set up for this project yet.",
  whyItMatters = "Configuration parameters tell the system which domain, locations, or keywords to monitor.",
  actionRequired = "Add configuration details to begin tracking.",
  action = { label: "Configure Now", href: "/settings" },
  secondaryAction,
  compact,
  className,
}: Partial<TruthfulStateProps>) {
  return (
    <TruthfulState
      icon={Settings2}
      title={title}
      missing={missing}
      whyItMatters={whyItMatters}
      actionRequired={actionRequired}
      action={action}
      secondaryAction={secondaryAction}
      compact={compact}
      className={className}
    />
  );
}

/** 2. Not Connected State */
export function NotConnectedState({
  title = "Data Source Not Connected",
  missing = "A required third-party integration is disconnected or unlinked.",
  whyItMatters = "Direct platform integration is needed to read authoritative metrics without scraping or guessing.",
  actionRequired = "Connect your account to sync live performance.",
  action = { label: "Connect Data Source", href: "/integrations" },
  secondaryAction,
  compact,
  className,
}: Partial<TruthfulStateProps>) {
  return (
    <TruthfulState
      icon={PlugZap}
      title={title}
      missing={missing}
      whyItMatters={whyItMatters}
      actionRequired={actionRequired}
      action={action}
      secondaryAction={secondaryAction}
      compact={compact}
      className={className}
    />
  );
}

/** 3. No Data State (Connected but returned no rows or zero activity) */
export function NoDataState({
  title = "No Data Available",
  missing = "The data source returned 0 records for the selected period.",
  whyItMatters = "This usually means the site has no activity yet for these dates, or Google is still indexing.",
  actionRequired = "Try widening the date range or check if a new sync is pending.",
  action = { label: "Run Fresh Sync", href: "/integrations", variant: "secondary" },
  secondaryAction,
  compact,
  className,
}: Partial<TruthfulStateProps>) {
  return (
    <TruthfulState
      icon={Database}
      title={title}
      missing={missing}
      whyItMatters={whyItMatters}
      actionRequired={actionRequired}
      action={action}
      secondaryAction={secondaryAction}
      compact={compact}
      className={className}
    />
  );
}

/** 4. Loading State */
export function LoadingState({
  title = "Loading Data...",
  message = "Fetching verified records from storage...",
  compact,
}: {
  title?: string;
  message?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8" : "py-16")}>
      <Loader2 size={24} className="animate-spin text-brand-600 mb-3" />
      <h4 className="text-[13px] font-semibold text-brand-950">{title}</h4>
      <p className="text-[11.5px] text-brand-400 mt-0.5">{message}</p>
    </div>
  );
}

/** 5. Failed State */
export function FailedState({
  title = "Failed to Load Data",
  error = "An error occurred while communicating with the API service.",
  onRetry,
  compact,
}: {
  title?: string;
  error?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-error-200 bg-error-50/30 text-center",
        compact ? "p-4 sm:p-6" : "p-8"
      )}
    >
      <AlertCircle size={22} className="text-error-600 mb-2.5" />
      <h4 className="text-[13.5px] font-semibold text-error-950">{title}</h4>
      <p className="text-[11.5px] text-error-700 mt-1 max-w-md">{error}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 flex items-center gap-1.5 rounded-lg border border-error-300 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-error-800 hover:bg-error-50 transition"
        >
          <RefreshCw size={12} />
          Retry Request
        </button>
      )}
    </div>
  );
}

/** 6. Completed State */
export function CompletedState({
  title = "Setup Complete",
  message = "All data sources are connected and up to date.",
  action,
}: {
  title?: string;
  message?: string;
  action?: StateAction;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-success-200 bg-success-50/30 p-6 text-center">
      <CheckCircle2 size={24} className="text-success-600 mb-2" />
      <h4 className="text-[13.5px] font-semibold text-success-950">{title}</h4>
      <p className="text-[12px] text-success-700 mt-0.5 max-w-md">{message}</p>
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-1.5 rounded-lg bg-success-700 px-3.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-success-800 transition"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 rounded-lg bg-success-700 px-3.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-success-800 transition"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** 7. Partial Data State (e.g. Authorized but property not selected) */
export function PartialDataState({
  title = "Action Needed: Property Selection Required",
  missing = "Google authorized your account, but you have not selected a specific property yet.",
  whyItMatters = "GrowthX cannot pull rankings or traffic until you specify which website property to sync.",
  actionRequired = "Select your Google property from the dropdown.",
  action = { label: "Select Property", href: "/integrations" },
  compact,
}: Partial<TruthfulStateProps>) {
  return (
    <TruthfulState
      icon={AlertCircle}
      title={title}
      missing={missing}
      whyItMatters={whyItMatters}
      actionRequired={actionRequired}
      action={action}
      compact={compact}
    />
  );
}

/** Metric truthfulness badge */
export function MetricBadge({ state }: { state: MetricState }) {
  switch (state) {
    case "MEASURED":
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Measured
        </span>
      );
    case "ESTIMATED":
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Estimated
        </span>
      );
    case "NOT_CONFIGURED":
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold bg-brand-100 text-brand-600 border border-brand-200">
          Not Configured
        </span>
      );
    case "NOT_CONNECTED":
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          Not Connected
        </span>
      );
    case "UNAVAILABLE":
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold bg-brand-100 text-brand-500 border border-brand-200">
          Unavailable
        </span>
      );
  }
}

/** Truthful Metric KPI Card */
export function TruthfulKpiCard({
  label,
  value,
  sub,
  state = "MEASURED",
  source,
  dateRange,
  lastUpdated,
  actionHref,
  actionLabel,
  trend,
  className,
}: {
  label: string;
  value?: string | number | null;
  sub?: string;
  state?: MetricState;
  source?: string;
  dateRange?: string;
  lastUpdated?: string;
  actionHref?: string;
  actionLabel?: string;
  trend?: { delta: number; positiveIsGood?: boolean };
  className?: string;
}) {
  const isAvailable = state === "MEASURED" || state === "ESTIMATED";

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border bg-white p-4 transition-all shadow-2xs",
        className
      )}
      style={{ borderColor: "var(--border-color)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-semibold text-brand-500">{label}</span>
        <MetricBadge state={state} />
      </div>

      <div className="my-2.5">
        {isAvailable && value != null ? (
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-bold tracking-[-0.03em] text-brand-950 font-mono">
              {value}
            </span>
            {trend && (
              <span
                className={cn(
                  "text-[11.5px] font-semibold font-mono",
                  trend.delta > 0
                    ? (trend.positiveIsGood ?? true) ? "text-success-600" : "text-error-600"
                    : trend.delta < 0
                      ? (trend.positiveIsGood ?? true) ? "text-error-600" : "text-success-600"
                      : "text-brand-400"
                )}
              >
                {trend.delta > 0 ? `+${trend.delta}%` : `${trend.delta}%`}
              </span>
            )}
          </div>
        ) : (
          <div className="py-1">
            <span className="text-[14px] font-medium text-brand-400 italic">
              {state === "NOT_CONNECTED"
                ? "Connect to view"
                : state === "NOT_CONFIGURED"
                  ? "Not configured"
                  : "No data available"}
            </span>
            {actionHref && (
              <div className="mt-1.5">
                <Link
                  href={actionHref}
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-700 hover:text-accent-800 underline underline-offset-2"
                >
                  {actionLabel || "Configure now →"}
                </Link>
              </div>
            )}
          </div>
        )}

        {sub && <p className="text-[11px] text-brand-400 mt-0.5">{sub}</p>}
      </div>

      <div className="border-t pt-2 mt-auto flex items-center justify-between text-[10px] text-brand-400 font-mono" style={{ borderColor: "var(--color-brand-100)" }}>
        <span>{source ? `Source: ${source}` : "Source: N/A"}</span>
        <span>{dateRange || (lastUpdated ? `Sync: ${lastUpdated}` : "Realtime")}</span>
      </div>
    </div>
  );
}
