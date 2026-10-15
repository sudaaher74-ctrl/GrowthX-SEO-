"use client";

import { Panel, Pill } from "@/components/ui/console";
import type { FixLedgerEntry } from "@/lib/api-types";
import { GitCommit, CheckCircle2, ShieldCheck, Eye, Clock } from "lucide-react";

export function FixEngineLedgerView({
  events,
}: {
  events: FixLedgerEntry[];
}) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case "ISSUE_DETECTED":
        return <Eye size={14} className="text-brand-500" />;
      case "PR_CREATED":
        return <GitCommit size={14} className="text-primary-600" />;
      case "DEPLOYMENT_VERIFIED":
        return <ShieldCheck size={14} className="text-success-600" />;
      case "TECHNICAL_FIX_CONFIRMED":
        return <CheckCircle2 size={14} className="text-success-600" />;
      default:
        return <Clock size={14} className="text-brand-400" />;
    }
  };

  return (
    <Panel
      title="Reigel Impact Ledger"
      subtitle="Append-only immutable event history tracing every change from detection to verification"
      padded
    >
      {events.length > 0 ? (
        <div className="relative border-l border-brand-200 ml-4 space-y-6 py-2">
          {events.map((evt) => (
            <div key={evt.id} className="relative pl-6">
              {/* Event node */}
              <div className="absolute -left-2.5 top-0.5 rounded-full border bg-white p-1 shadow-xs">
                {getEventIcon(evt.eventType)}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-brand-900">{evt.title}</span>
                  <Pill tone="default">{evt.eventType}</Pill>
                  <span className="font-mono text-[10px] text-brand-400">
                    {new Date(evt.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-brand-600">{evt.description}</p>

                <div className="flex flex-wrap gap-3 text-[10px] font-mono text-brand-400 pt-1">
                  {evt.actor && <span>Actor: {evt.actor}</span>}
                  {evt.affectedUrl && <span>URL: {evt.affectedUrl}</span>}
                  {evt.pullRequestUrl && (
                    <a
                      href={evt.pullRequestUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-600 hover:underline"
                    >
                      PR Link
                    </a>
                  )}
                  {evt.verificationStatus && <span>Status: {evt.verificationStatus}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-brand-400">
          No ledger events recorded yet. Events will be logged automatically as fixes move through the pipeline.
        </div>
      )}
    </Panel>
  );
}
