"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2, RotateCw } from "lucide-react";
import { api, type TrackedCompetitor } from "@/lib/api-client";
import { ActionButton, Panel, Pill, StatusNote } from "@/components/ui/console";

export function CompetitorSuggestions({ projectId, auditedAt, tracked }: {
  projectId: string;
  auditedAt: string | null;
  tracked: TrackedCompetitor[];
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const suggestions = useQuery({
    queryKey: ["competitor-suggestions", projectId, auditedAt],
    queryFn: () => api.discoverCompetitors(projectId),
    enabled: Boolean(auditedAt),
    staleTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const trackedDomains = new Set(tracked.map((c) => c.domain.toLowerCase().replace(/^www\./, "")));
  // The server checks every domain. Never display an unverified model guess.
  const candidates = (suggestions.data?.topCompetitors ?? []).filter((c) => c.verified).slice(0, 5);
  const chosen = candidates.filter((c) => selected.includes(c.domain) && !trackedDomains.has(c.domain));
  const add = useMutation({
    mutationFn: () => api.addSelectedCompetitors(projectId, chosen),
    onSuccess: (result) => {
      setSelected([]);
      setSavedCount(result.count);
      void qc.invalidateQueries({ queryKey: ["competitors", projectId] });
      void qc.invalidateQueries({ queryKey: ["competitor-websites", projectId] });
    },
  });

  // Close immediately after the save succeeds, including the brief interval
  // before the refreshed tracked-competitor query returns.
  if (tracked.length > 0 || savedCount !== null) return null;

  return <Panel padded title="Choose your competitors" subtitle="We suggest up to five businesses from your audited website, then verify their websites. Select which ones to audit and track.">
    {!auditedAt ? <p className="text-sm text-brand-500">Complete your <Link href="/website" className="underline">Website Audit</Link> to find competitors automatically.</p> : <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-brand-500">AI business discovery with live website checks. Google ranking positions are not measured yet.</p>
        <ActionButton icon={<RotateCw size={13} />} disabled={suggestions.isFetching || add.isPending} onClick={() => { setSavedCount(null); void suggestions.refetch(); }}>Find again</ActionButton>
      </div>
      {suggestions.isFetching && <p role="status" className="flex items-center gap-2 text-sm text-brand-500"><Loader2 size={15} className="animate-spin" />Finding businesses and checking their websites…</p>}
      {suggestions.error && <StatusNote tone="bad">Could not find competitors: {suggestions.error.message}. Use Find again to retry, or add a website manually.</StatusNote>}
      {suggestions.data && <>
        <p className="text-xs text-brand-500">{suggestions.data.businessName} · {suggestions.data.industry} · Checked {new Date(suggestions.data.identifiedAt).toLocaleString()}</p>
        {!candidates.length && <StatusNote>No competitors could be verified. Try again or add a known competitor manually.</StatusNote>}
        <div className="grid gap-3 lg:grid-cols-2">
          {candidates.map((c) => {
            const alreadyTracked = trackedDomains.has(c.domain);
            return <label key={c.domain} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
              <input type="checkbox" aria-label={`Select ${c.domain}`} disabled={alreadyTracked || add.isPending} checked={alreadyTracked || selected.includes(c.domain)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, c.domain] : current.filter((d) => d !== c.domain))} className="mt-1" />
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-brand-950">{c.name}</span><Pill>{alreadyTracked ? "Tracking" : c.verificationLevel === "content" ? "Website checked" : "Website reachable"}</Pill></div>
                <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="break-all text-xs text-brand-600 underline">{c.domain}</a>
                <p className="text-xs leading-relaxed text-brand-500">{c.description}</p>
                {c.location && <p className="text-xs text-brand-400">{c.location}</p>}
              </div>
            </label>;
          })}
        </div>
        <ActionButton variant="primary" disabled={!chosen.length || add.isPending || suggestions.isFetching} onClick={() => add.mutate()}>{add.isPending ? "Starting competitor audits…" : `Audit ${chosen.length || "selected"} competitor${chosen.length === 1 ? "" : "s"}`}</ActionButton>
      </>}
      {add.error && <StatusNote tone="bad">Could not save your selection: {add.error.message}</StatusNote>}
      {savedCount !== null && <StatusNote tone="good">{savedCount} competitor{savedCount === 1 ? "" : "s"} selected. Their website audits are starting; results will appear in the tabs below.</StatusNote>}
    </div>}
  </Panel>;
}
