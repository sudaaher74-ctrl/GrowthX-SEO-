"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, Sparkles } from "lucide-react";
import { ActionButton, Panel } from "@/components/ui/console";
import { useAiva } from "@/components/voice/aiva-provider";
import { setActiveProject } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";

/**
 * The one-step start: give your website and the autopilot does the rest.
 * Shown to a new account with no website, and to one with no competitors yet.
 */
export function AutopilotStart({ projectId, domain }: { projectId: string | null; domain: string | null }) {
  const qc = useQueryClient();
  const { toggleOpen, isOpen } = useAiva();
  const [site, setSite] = useState(domain ?? "");

  const latest = useQuery({
    queryKey: ["autopilot", projectId],
    queryFn: () => api.autopilot.latest(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
  const start = useMutation({
    mutationFn: (d: string) => api.autopilot.start(d, projectId),
    onSuccess: (run) => {
      if (run.projectId !== projectId) {
        setActiveProject(run.projectId);
        qc.invalidateQueries({ queryKey: ["projects"] });
        qc.invalidateQueries({ queryKey: ["portfolio"] });
      }
      qc.setQueryData(["autopilot", run.projectId], run);
    },
  });

  const status = latest.data?.status;
  if (status === "DISCOVERING" || status === "AWAITING_CONFIRMATION" || status === "RUNNING") return null;

  return (
    <Panel
      title={domain ? "Find your competitors and get a full report" : "Start here: tell us your website"}
      subtitle="We read your website, find your competitors, read theirs and write a complete report of what they do better and how to beat them. You only confirm the competitors; everything else is automatic."
      padded
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={site}
          onChange={(e) => setSite(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && site.trim() && start.mutate(site.trim())}
          placeholder="yourwebsite.com"
          aria-label="Your website"
          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-[13px] text-brand-950"
        />
        <ActionButton
          variant="primary"
          icon={<Sparkles size={13} />}
          disabled={!site.trim() || start.isPending}
          onClick={() => start.mutate(site.trim())}
        >
          {start.isPending ? "Starting…" : "Do it for me"}
        </ActionButton>
      </div>
      {start.error && <p className="mt-2 text-[12px] text-error-600">{(start.error as Error).message}</p>}
      <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-brand-500">
        <Mic size={12} /> Or{" "}
        <button type="button" onClick={() => !isOpen && toggleOpen()} className="font-semibold text-brand-950 hover:underline">
          ask Nexa
        </button>
        : &quot;My website is {domain || "brandkettle.co.in"}, find my competitors.&quot;
      </p>
    </Panel>
  );
}
