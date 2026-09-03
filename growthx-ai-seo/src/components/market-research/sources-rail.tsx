"use client";

import { Panel, Pill } from "@/components/ui/console";
import { Loader2, ExternalLink, BookOpen } from "lucide-react";
import type { ResearchSource } from "@/lib/api-client";
import { SourceCard, SourceMonogram, SOURCE_LABEL } from "@/components/market-research/source-card";

/* ── the sources rail ───────────────────────────────────────────── */

export function SourcesRail({
  sources,
  openSource,
  onOpenSource,
  isPending,
}: {
  sources: ResearchSource[];
  openSource: ResearchSource | null;
  onOpenSource: (s: ResearchSource | null) => void;
  isPending: boolean;
}) {
  return (
    <aside className="w-full shrink-0 space-y-3 lg:sticky lg:top-4 lg:w-[320px]">
      <Panel
        title="Sources"
        subtitle={sources.length ? `${sources.length} retrieved` : isPending ? "Retrieving…" : "None yet"}
      >
        {sources.length === 0 ? (
          <div className="p-6 text-center">
            {isPending ? (
              <>
                <Loader2 size={18} className="mx-auto mb-2 animate-spin text-blue-500" />
                <p className="text-xs text-[var(--text-muted)]">
                  Sources appear here as soon as the run finishes retrieving them.
                </p>
              </>
            ) : (
              <>
                <BookOpen size={18} className="mx-auto mb-2 text-[var(--text-muted)]" />
                <p className="text-xs text-[var(--text-muted)]">
                  Every source retrieved for a question is listed here, numbered to match the
                  citations in the answer.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className="max-h-[calc(100vh-13rem)] space-y-2 overflow-y-auto p-3">
            {sources.map((source, i) => (
              <SourceCard
                key={source.id}
                source={source}
                index={i + 1}
                isActive={openSource?.sourceKey === source.sourceKey}
                onOpen={() => onOpenSource(source)}
              />
            ))}
          </ul>
        )}
      </Panel>

      {openSource && (
        <Panel title="Source detail">
          <div className="space-y-2 p-4">
            <div className="flex items-start gap-2">
              <SourceMonogram source={openSource} />
              <p className="text-[13px] font-semibold leading-snug text-[var(--text-primary)]">
                {openSource.title}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill>{SOURCE_LABEL[openSource.type]}</Pill>
              {openSource.publisher && <Pill>{openSource.publisher}</Pill>}
              <Pill>quality {Math.round(openSource.qualityScore)}</Pill>
            </div>
            <p className="text-[11.5px] text-[var(--text-muted)]">
              {openSource.publishedAt
                ? `Published ${new Date(openSource.publishedAt).toLocaleDateString()}`
                : "Publication date not reported by the source"}
              {" · "}
              Retrieved {new Date(openSource.retrievedAt).toLocaleDateString()}
            </p>
            {openSource.excerpt && (
              <p className="rounded-lg bg-[var(--surface-2)] p-2.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                “{openSource.excerpt}”
              </p>
            )}
            {openSource.url && (
              <a
                href={openSource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:underline"
              >
                <ExternalLink size={12} /> Open source
              </a>
            )}
            <button
              onClick={() => onOpenSource(null)}
              className="block text-[11.5px] text-[var(--text-muted)] hover:underline"
            >
              Close
            </button>
          </div>
        </Panel>
      )}
    </aside>
  );
}
