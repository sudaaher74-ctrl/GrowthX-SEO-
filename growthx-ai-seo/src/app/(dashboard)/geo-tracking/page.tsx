"use client";
import { useState } from "react";
import { Info, Loader2, Plus, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ActionButton, Kpi, Mono, PageHeader, Panel, Pill, Table, Td, Th, Tr,
} from "@/components/ui/console";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { useAddPrompts, useRunSweep, useTrackedPrompts, useVisibility, useWorkspace } from "@/hooks/use-growthx";

const ASSISTANT_LABEL: Record<string, string> = {
  CHATGPT: "ChatGPT", CLAUDE: "Claude", GEMINI: "Gemini",
  PERPLEXITY: "Perplexity", AI_OVERVIEWS: "Google AI Overviews", COPILOT: "Copilot",
};

export default function AiVisibilityPage() {
  const { projectId } = useWorkspace();
  const visibility = useVisibility(projectId);
  const prompts = useTrackedPrompts(projectId);
  const addPrompts = useAddPrompts(projectId);
  const sweep = useRunSweep(projectId);
  const [draft, setDraft] = useState("");

  const summary = visibility.data?.summary;

  async function handleAdd() {
    const lines = draft.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    await addPrompts.mutateAsync(lines.map((text) => ({ text })));
    setDraft("");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Visibility"
        subtitle="Whether AI assistants recommend this client when their buyers ask"
        actions={
          <ActionButton
            variant="primary"
            icon={sweep.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            onClick={() => sweep.mutate()}
            disabled={sweep.isPending || !projectId}
          >
            {sweep.isPending ? "Checking…" : "Run checks now"}
          </ActionButton>
        }
      />

      {sweep.data && (
        <div className="rounded-xl border bg-white px-4 py-2.5 text-[12px] text-[#3f3f46]" style={{ borderColor: "#e5e7eb" }}>
          {sweep.data.checksRun} checks ran · {sweep.data.citations} citations · {sweep.data.checksFailed} failed
          {sweep.data.skippedAssistants.length > 0 && (
            <span className="text-[#a1a1aa]">
              {" "}· skipped {sweep.data.skippedAssistants.map((a) => ASSISTANT_LABEL[a] ?? a).join(", ")}
            </span>
          )}
        </div>
      )}

      <QueryState
        isLoading={visibility.isLoading}
        error={visibility.error}
        isEmpty={!summary || summary.checked === 0}
        emptyTitle="No citation data yet"
        emptyBody="Add the questions this client's buyers ask, then run the checks. Results refresh daily."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Citation share"
            value={`${summary?.citationSharePct ?? 0}%`}
            delta={summary?.deltaPt}
            deltaSuffix="pt"
            sub="of checks that named this client"
          />
          <Kpi label="Avg position" value={summary?.averagePosition?.toFixed(1) ?? "—"} sub="when cited" />
          <Kpi label="Checks run" value={String(summary?.checked ?? 0)} sub={`${summary?.cited ?? 0} citations`} />
          <Kpi
            label="Failed checks"
            value={String(summary?.failedChecks ?? 0)}
            sub="excluded from the rate"
            tone={summary?.failedChecks ? "danger" : "good"}
          />
        </div>

        <div className="flex items-start gap-2 rounded-xl border bg-[#fafafa] px-3 py-2.5 text-[11.5px] text-[#71717a]" style={{ borderColor: "#e5e7eb" }}>
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            Measured directly on{" "}
            <strong className="text-[#3f3f46]">
              {visibility.data?.measurableAssistants.map((a) => ASSISTANT_LABEL[a] ?? a).join(", ")}
            </strong>. Google AI Overviews, Perplexity and Copilot have no public API — they are excluded
            from these percentages rather than counted as zero.
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Citation share by assistant" subtitle="cited / checked">
            <div className="h-[220px] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visibility.data?.byAssistant.map((a) => ({ name: ASSISTANT_LABEL[a.assistant] ?? a.assistant, share: a.citationSharePct }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <YAxis unit="%" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={34} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="share" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Citation share trend" subtitle="weekly, all assistants blended">
            <div className="h-[220px] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visibility.data?.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis dataKey="weekStart" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <YAxis unit="%" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={34} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Line type="monotone" dataKey="citationSharePct" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <Panel title="Share of voice" subtitle="how often each brand appears in the same answers">
          <div className="space-y-2.5 p-4">
            {visibility.data?.shareOfVoice.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className={`w-40 shrink-0 truncate text-[12px] ${row.domain === null ? "font-semibold text-[#09090b]" : "text-[#3f3f46]"}`}>
                  {row.label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f4f4f5]">
                  <div className="h-full rounded-full" style={{ width: `${row.sharePct}%`, background: row.domain === null ? "#2563eb" : "#a1a1aa" }} />
                </div>
                <span className="w-12 text-right font-mono text-[11px] text-[#71717a]">{row.sharePct}%</span>
              </div>
            ))}
          </div>
        </Panel>
      </QueryState>

      <Panel title="Tracked prompts" subtitle={`${prompts.data?.length ?? 0} active`}>
        <div className="border-b p-4" style={{ borderColor: "#f4f4f5" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={"One question per line, e.g.\nbest insulated jacket for winter hiking\nnorthwind vs trailhead"}
            className="w-full resize-y rounded-lg border px-3 py-2 text-[12.5px] text-[#09090b]"
            style={{ borderColor: "#e5e7eb" }}
          />
          <div className="mt-2 flex justify-end">
            <ActionButton icon={<Plus size={12} />} onClick={handleAdd} disabled={addPrompts.isPending || !draft.trim()}>
              {addPrompts.isPending ? "Adding…" : "Add prompts"}
            </ActionButton>
          </div>
        </div>

        {!prompts.data?.length ? (
          <p className="px-4 py-10 text-center text-[12px] text-[#a1a1aa]">No prompts tracked yet.</p>
        ) : (
          <Table minWidth={720}>
            <thead><tr><Th>Prompt</Th><Th align="right">Latest results</Th></tr></thead>
            <tbody>
              {prompts.data.map((p) => (
                <Tr key={p.id}>
                  <Td><span className="text-[12.5px] text-[#09090b]">{p.text}</span></Td>
                  <Td align="right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {p.latestChecks.length === 0 && <Pill>not checked</Pill>}
                      {p.latestChecks.map((c, i) => (
                        <Pill key={i} tone={c.error ? "default" : c.cited ? "good" : "bad"}>
                          {ASSISTANT_LABEL[c.assistant] ?? c.assistant}
                          {c.error ? " n/a" : c.cited ? ` #${c.position ?? "?"}` : " miss"}
                        </Pill>
                      ))}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
