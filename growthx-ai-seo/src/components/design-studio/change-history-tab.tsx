"use client";
import {
  CheckCircle2,
  Eye,
  GitPullRequest,
  RotateCcw,
  Search,
  Sparkles,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignStudioEvent } from "@/lib/api-client";
import { Panel } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";

/**
 * The audit trail: every recorded event, newest first.
 *
 * Only events that actually happened are listed. There is no synthesised
 * "awaiting" row for a step that has not run — the absence of a publish event
 * is what tells a reader the change never published.
 */

const EVENT_STYLES: Record<string, { label: string; Icon: React.ElementType; className: string }> = {
  SUGGESTION_GENERATED: { label: "Suggestion generated", Icon: Sparkles, className: "text-accent-600" },
  PREVIEW_CREATED: { label: "Preview created", Icon: Eye, className: "text-accent-600" },
  USER_APPROVED: { label: "User approved", Icon: CheckCircle2, className: "text-success-600" },
  CHANGE_APPROVED: { label: "Queued for publishing", Icon: UploadCloud, className: "text-accent-600" },
  CHANGE_PUBLISHED: { label: "Change published", Icon: GitPullRequest, className: "text-success-600" },
  CHANGE_VERIFIED: { label: "Change verified", Icon: CheckCircle2, className: "text-success-600" },
  CHANGE_FAILED: { label: "Publishing failed", Icon: XCircle, className: "text-error-600" },
  CHANGE_ROLLED_BACK: { label: "Change rolled back", Icon: RotateCcw, className: "text-brand-500" },
  SEO_VERIFIED: { label: "Re-crawl checked", Icon: Search, className: "text-success-600" },
  ROLLBACK: { label: "Rollback performed", Icon: RotateCcw, className: "text-brand-500" },
};

function styleFor(kind: string) {
  return (
    EVENT_STYLES[kind] ?? {
      label: kind.replace(/_/g, " ").toLowerCase(),
      Icon: Sparkles,
      className: "text-brand-500",
    }
  );
}

export function ChangeHistoryTab({
  events,
  isLoading,
  error,
}: {
  events: DesignStudioEvent[];
  isLoading: boolean;
  error: unknown;
}) {
  return (
    <Panel padded>
      <QueryState
        isLoading={isLoading}
        error={error}
        isEmpty={events.length === 0}
        emptyTitle="No history yet"
        emptyBody="Generating, previewing, approving, publishing and verifying a change are all recorded here."
      >
        <ol className="relative space-y-4 pl-6">
          {/* The rail. Absolute so rows can be any height without breaking it. */}
          <span
            aria-hidden
            className="absolute bottom-2 left-[7px] top-2 w-px bg-brand-200"
          />
          {events.map((event, index) => {
            const style = styleFor(event.kind);
            const Icon = style.Icon;
            return (
              <li key={`${event.ref}-${event.kind}-${index}`} className="relative">
                <span className="absolute -left-6 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                  <Icon size={12} className={cn("shrink-0", style.className)} />
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[12px] font-semibold text-brand-950">{style.label}</p>
                  <time
                    dateTime={event.at}
                    className="font-mono text-[10.5px] text-brand-400"
                  >
                    {new Date(event.at).toLocaleString()}
                  </time>
                </div>
                <p className="mt-0.5 break-words text-[11.5px] text-brand-500">{event.label}</p>
              </li>
            );
          })}
        </ol>
      </QueryState>
    </Panel>
  );
}
