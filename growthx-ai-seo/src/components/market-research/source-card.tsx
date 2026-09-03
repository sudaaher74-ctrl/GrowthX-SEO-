"use client";

import { ExternalLink, FileText, Globe, BarChart3 } from "lucide-react";
import type { ResearchSource, ResearchSourceType } from "@/lib/api-client";

export const SOURCE_LABEL: Record<ResearchSourceType, string> = {
  PUBLIC_WEB: "Web",
  CLIENT_WEBSITE: "Client site",
  UPLOADED_FILE: "Upload",
  AI_VISIBILITY_CHECK: "AI visibility",
  INTEGRATION_DATA: "Integration",
};

export const SOURCE_ICON: Record<ResearchSourceType, typeof Globe> = {
  PUBLIC_WEB: Globe,
  CLIENT_WEBSITE: FileText,
  UPLOADED_FILE: FileText,
  AI_VISIBILITY_CHECK: BarChart3,
  INTEGRATION_DATA: BarChart3,
};

/** Hostname without `www.`, or "" for a source that has no URL. */
export function hostOf(source: ResearchSource): string {
  if (!source.url) return "";
  try {
    return new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Six fixed hues, picked by a hash of the domain.
 *
 * Deliberately not `google.com/s2/favicons` or any other favicon service: that
 * would send every source domain this client researched to a third party on
 * render, and leave a column of broken images when it is blocked. A monogram
 * needs no network at all and is stable per domain, which is what makes the
 * rail scannable — the same publisher keeps the same colour across runs.
 */
const MONOGRAM_TONES = [
  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
];

function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return MONOGRAM_TONES[Math.abs(hash) % MONOGRAM_TONES.length];
}

export function SourceMonogram({ source, size = 28 }: { source: ResearchSource; size?: number }) {
  const host = hostOf(source);
  const seed = host || source.publisher || source.title || source.id;
  const letter = (seed.replace(/[^a-z0-9]/gi, "")[0] || "?").toUpperCase();

  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-lg font-semibold ${toneFor(seed)}`}
    >
      <span style={{ fontSize: size * 0.45 }}>{letter}</span>
    </span>
  );
}

/**
 * One retrieved source in the rail.
 *
 * The number is the citation marker used inline in the answer, so the two are
 * readable against each other: clicking [3] in a claim and finding 3 here is
 * the whole point of showing sources at all.
 */
export function SourceCard({
  source,
  index,
  isActive,
  onOpen,
}: {
  source: ResearchSource;
  index: number;
  isActive: boolean;
  onOpen: () => void;
}) {
  const Icon = SOURCE_ICON[source.type] ?? Globe;
  const host = hostOf(source);

  return (
    <li>
      <button
        id={`source-${source.sourceKey}`}
        onClick={onOpen}
        className={`w-full scroll-mt-4 rounded-xl border p-2.5 text-left transition-all ${
          isActive
            ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/30 dark:bg-blue-950/20"
            : "border-[var(--border-color)] bg-[var(--surface-2)] hover:border-accent-600"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <SourceMonogram source={source} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-[4px] bg-blue-500/10 px-1 font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
                {index}
              </span>
              <span className="truncate font-mono text-[10.5px] text-[var(--text-muted)]">
                {host || SOURCE_LABEL[source.type]}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[12.5px] font-medium leading-snug text-[var(--text-primary)]">
              {source.title}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[10.5px] text-[var(--text-muted)]">
              <Icon size={10} />
              {SOURCE_LABEL[source.type]}
              {source.publisher ? ` · ${source.publisher}` : ""}
            </p>
          </div>
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open in a new tab"
              className="mt-0.5 shrink-0 text-[var(--text-muted)] transition-colors hover:text-blue-600"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </button>
    </li>
  );
}
