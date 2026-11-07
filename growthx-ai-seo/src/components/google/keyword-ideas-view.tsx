"use client";
import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Plus, Radar, Wand2, XCircle } from "lucide-react";
import { Table, Td, Th, Tr } from "@/components/ui/console";
import { Caveat, EmptyNote } from "@/components/google/view-kit";
import { useKeywordIdeas, usePresenceCheck, useTrackSuggested } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";
import { position } from "@/lib/google-format";
import type { IdeaKind, PresenceResult } from "@/lib/search-intelligence";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<IdeaKind, string> = {
  near_me: "Near me",
  city: "Local",
  product: "Product",
  question: "Question",
  comparison: "Comparison",
};

const MAX_PRESENCE = 10;

/**
 * Keyword ideas for the business, written from its own site by Gemini, with a
 * Google presence check for the ones worth tracking. Works without a paid
 * keyword tool, and says so where a number would otherwise be expected.
 */
export function KeywordIdeasView() {
  const { projectId } = useWorkspace();
  const ideas = useKeywordIdeas(projectId);
  const presence = usePresenceCheck(projectId);
  const track = useTrackSuggested(projectId);

  const [city, setCity] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [justTracked, setJustTracked] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Record<string, PresenceResult>>({});

  const report = ideas.data ?? null;
  const rows = useMemo(() => report?.ideas ?? [], [report]);
  const isTracked = (keyword: string, flag: boolean) => flag || justTracked.has(keyword);
  const selectedList = [...selected];

  function toggle(keyword: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  }

  function generate(force = false) {
    setSelected(new Set());
    setChecked({});
    ideas.mutate({ city: city.trim() || undefined, force });
  }

  function runPresence() {
    presence.mutate(
      { keywords: selectedList.slice(0, MAX_PRESENCE), city: report?.city ?? (city.trim() || undefined) },
      {
        onSuccess: (result) =>
          setChecked((prev) => ({ ...prev, ...Object.fromEntries(result.results.map((r) => [r.keyword, r])) })),
      },
    );
  }

  function trackSelected() {
    const keywords = selectedList;
    track.mutate(keywords, {
      onSuccess: () => {
        setJustTracked((prev) => new Set([...prev, ...keywords]));
        setSelected(new Set());
      },
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Generate bar ── */}
      <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="ideas-city" className="mb-1 block text-[11px] font-semibold text-brand-500">
              City or area you sell in <span className="font-normal text-brand-400">(optional, we read it from your site if blank)</span>
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-surface-2 px-3 py-2">
              <MapPin size={14} className="shrink-0 text-brand-400" />
              <input
                id="ideas-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !ideas.isPending && generate()}
                placeholder="e.g. Panvel"
                maxLength={60}
                className="w-full min-w-0 bg-transparent text-[13px] text-brand-950 placeholder:text-brand-400 outline-none"
                style={{ outline: "none", boxShadow: "none" }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => generate(Boolean(report))}
            disabled={ideas.isPending || !projectId}
            className="inline-flex items-center gap-2 rounded-full bg-signal-400 px-5 py-2.5 text-[12.5px] font-extrabold text-signal-ink transition hover:bg-signal-500 disabled:opacity-60 cursor-pointer"
          >
            {ideas.isPending ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            <span>{report ? "Write new ideas" : "Suggest keywords for my business"}</span>
          </button>
        </div>
        {ideas.isError && (
          <p role="alert" className="mt-3 text-[12px] font-medium text-error-600">
            {errorMessage(ideas.error)}
          </p>
        )}
      </div>

      {!report && !ideas.isPending && (
        <EmptyNote>
          Reigel reads your pages, works out what you sell and who you sell to, and lists the searches your customers are likely to type, such as
          &quot;fresh milk near me&quot; or &quot;milk delivery in Panvel&quot;. Pick the ones that matter to track them.
        </EmptyNote>
      )}

      {report && (
        <div className="rounded-2xl border border-brand-200 bg-surface-1">
          {/* ── Summary ── */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-200 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-brand-950">
                {rows.length} keyword ideas{report.business.industry ? ` for ${report.business.industry}` : ""}
                {report.city ? ` in ${report.city}` : ""}
              </p>
              {report.business.offerings.length > 0 && (
                <p className="mt-0.5 truncate text-[11.5px] text-brand-500">Reads your site as selling: {report.business.offerings.join(", ")}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runPresence}
                disabled={selected.size === 0 || selected.size > MAX_PRESENCE || presence.isPending}
                title={selected.size > MAX_PRESENCE ? `Choose ${MAX_PRESENCE} or fewer to check at once` : "Ask Gemini whether your site appears in Google for these"}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-2 px-3.5 py-1.5 text-[11.5px] font-bold text-brand-950 transition hover:bg-brand-100 disabled:opacity-50 cursor-pointer"
              >
                {presence.isPending ? <Loader2 size={12} className="animate-spin" /> : <Radar size={12} />}
                <span>Check Google ({Math.min(selected.size, MAX_PRESENCE)})</span>
              </button>
              <button
                type="button"
                onClick={trackSelected}
                disabled={selected.size === 0 || track.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-3.5 py-1.5 text-[11.5px] font-extrabold text-signal-ink transition hover:bg-signal-500 disabled:opacity-50 cursor-pointer"
              >
                {track.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                <span>Track selected ({selected.size})</span>
              </button>
            </div>
          </div>

          {report.notice && <p className="border-b border-brand-200 px-4 py-2.5 text-[12px] text-warning-600">{report.notice}</p>}
          {presence.isError && (
            <p role="alert" className="border-b border-brand-200 px-4 py-2.5 text-[12px] font-medium text-error-600">
              {errorMessage(presence.error)}
            </p>
          )}
          {track.isError && (
            <p role="alert" className="border-b border-brand-200 px-4 py-2.5 text-[12px] font-medium text-error-600">
              {errorMessage(track.error)}
            </p>
          )}

          {rows.length === 0 ? (
            <EmptyNote>No ideas could be written yet. Run a website audit, then try again.</EmptyNote>
          ) : (
            <Table minWidth={760}>
              <thead>
                <tr>
                  <Th>
                    <input
                      type="checkbox"
                      aria-label="Select all keywords"
                      checked={selected.size === rows.length && rows.length > 0}
                      onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.keyword)) : new Set())}
                    />
                  </Th>
                  <Th>Keyword</Th>
                  <Th>Type</Th>
                  <Th align="right">Google position (Search Console)</Th>
                  <Th>In Google results?</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const result = checked[row.keyword];
                  return (
                    <Tr key={row.keyword}>
                      <Td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.keyword}`}
                          checked={selected.has(row.keyword)}
                          onChange={() => toggle(row.keyword)}
                        />
                      </Td>
                      <Td>
                        <span className="block max-w-[340px] truncate text-[12.5px] font-semibold text-brand-950" title={row.reason ?? row.keyword}>
                          {row.keyword}
                        </span>
                        {row.reason && <span className="block max-w-[340px] truncate text-[10.5px] text-brand-500">{row.reason}</span>}
                        {isTracked(row.keyword, row.tracked) && (
                          <span className="mt-0.5 inline-block rounded-full border border-brand-200 bg-surface-2 px-1.5 py-0.5 text-[9.5px] font-bold text-success-600">
                            Tracked
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span className="rounded-full border border-brand-200 bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">
                          {KIND_LABEL[row.kind]}
                        </span>
                      </Td>
                      <Td align="right">
                        {row.searchConsole ? (
                          <span className="font-mono text-[12px] text-brand-950">{position(row.searchConsole.position)}</span>
                        ) : (
                          <span className="text-[11px] text-brand-400">Not shown yet</span>
                        )}
                      </Td>
                      <Td>
                        {!result ? (
                          <span className="text-[11px] text-brand-400">Not checked</span>
                        ) : result.error ? (
                          <span className="text-[11px] text-error-600">{result.error}</span>
                        ) : (
                          <div className="space-y-0.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[11.5px] font-bold",
                                result.appears ? "text-success-600" : "text-warning-600",
                              )}
                            >
                              {result.appears ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                              {result.appears ? "Your site appears" : "Not in the results"}
                            </span>
                            {result.competitorsSeen.length > 0 && (
                              <span className="block max-w-[220px] truncate text-[10.5px] text-brand-500" title={result.competitorsSeen.join(", ")}>
                                Also: {result.competitorsSeen.join(", ")}
                              </span>
                            )}
                            {result.sites.length > 0 && (
                              <span className="block max-w-[220px] truncate text-[10.5px] text-brand-400" title={result.sites.join(", ")}>
                                Top sites: {result.sites.slice(0, 3).join(", ")}
                              </span>
                            )}
                          </div>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          <Caveat>{report.volumeNote}</Caveat>
          {presence.data && <Caveat>{presence.data.method}</Caveat>}
        </div>
      )}
    </div>
  );
}
