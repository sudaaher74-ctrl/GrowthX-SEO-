"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  ActionButton,
  Kpi,
  Mono,
  NotConnected,
  PageHeader,
  Panel,
  Pill,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
} from "@/components/ui/console";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { api } from "@/lib/api-client";
import { useTrackedPrompts, useVisibility, useWorkspace } from "@/hooks/use-growthx";

type Tab = "prompts" | "competitors" | "ranks";

/**
 * Search — the demand side. We track AI prompts rather than classic keyword
 * rankings, so the tabs reflect what actually exists rather than the mockup's
 * placeholder rank data.
 */
export default function SearchPage() {
  const { projectId } = useWorkspace();
  const prompts = useTrackedPrompts(projectId);
  const visibility = useVisibility(projectId);
  const [tab, setTab] = useState<Tab>("prompts");
  const [domain, setDomain] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const competitors = (visibility.data?.shareOfVoice ?? []).filter((r) => r.domain !== null);

  async function addCompetitor() {
    if (!projectId || !domain.trim()) return;
    setSaving(true);
    try {
      await api.addCompetitor(projectId, domain.trim(), label.trim() || undefined);
      setDomain("");
      setLabel("");
      await visibility.refetch();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Search"
        subtitle="The questions buyers ask, and who gets recommended for them"
        actions={
          <Link href="/geo-tracking">
            <ActionButton variant="primary" icon={<Plus size={12} />}>Add prompts</ActionButton>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Prompts tracked" value={String(prompts.data?.length ?? 0)} sub="active questions" />
        <Kpi
          label="Citation share"
          value={visibility.data?.summary.citationSharePct != null ? `${visibility.data.summary.citationSharePct}%` : "—"}
          delta={visibility.data?.summary.deltaPt}
          deltaSuffix="pt"
          sub="across all assistants"
        />
        <Kpi label="Competitors tracked" value={String(competitors.length)} sub="for share of voice" />
        <Kpi
          label="Avg position"
          value={visibility.data?.summary.averagePosition != null ? String(visibility.data.summary.averagePosition) : "—"}
          sub="when cited"
        />
      </div>

      <Tabs
        tabs={[
          { id: "prompts" as Tab, label: "Prompts", tag: String(prompts.data?.length ?? 0) },
          { id: "competitors" as Tab, label: "Competitors", tag: String(competitors.length) },
          { id: "ranks" as Tab, label: "Rank tracking" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "prompts" && (
        <QueryState
          isLoading={prompts.isLoading}
          error={prompts.error}
          isEmpty={!prompts.data?.length}
          emptyTitle="No prompts tracked"
          emptyBody="Add the questions your client's buyers type into ChatGPT or Gemini."
        >
          <Panel title="Tracked prompts" subtitle={`${prompts.data?.length ?? 0} active`}>
            <Table minWidth={760}>
              <thead>
                <tr>
                  <Th>Prompt</Th>
                  <Th>Cluster</Th>
                  <Th align="right">Latest results</Th>
                </tr>
              </thead>
              <tbody>
                {prompts.data?.map((p) => (
                  <Tr key={p.id}>
                    <Td><span className="text-[12.5px] text-brand-950">{p.text}</span></Td>
                    <Td><Mono tone="soft">{p.cluster ?? "—"}</Mono></Td>
                    <Td align="right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {p.latestChecks.length === 0 && <Pill>not checked</Pill>}
                        {p.latestChecks.map((c, i) => (
                          <Pill key={i} tone={c.error ? "default" : c.cited ? "good" : "bad"}>
                            {c.assistant}{c.error ? " n/a" : c.cited ? ` #${c.position ?? "?"}` : " miss"}
                          </Pill>
                        ))}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        </QueryState>
      )}

      {tab === "competitors" && (
        <div className="space-y-4">
          <Panel title="Add a competitor" subtitle="Set the label — an answer saying &quot;Trailhead Co&quot; is missed without it">
            <div className="flex flex-wrap gap-2 p-4">
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="trailheadco.com"
                className="flex-1 rounded-lg border px-3 py-2 text-[12.5px] text-brand-950"
                style={{ borderColor: "var(--color-line)", minWidth: 180 }}
              />
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Trailhead Co"
                className="flex-1 rounded-lg border px-3 py-2 text-[12.5px] text-brand-950"
                style={{ borderColor: "var(--color-line)", minWidth: 180 }}
              />
              <ActionButton variant="primary" onClick={addCompetitor} disabled={saving || !domain.trim()}>
                {saving ? "Adding…" : "Add"}
              </ActionButton>
            </div>
          </Panel>

          <Panel title="Share of voice" subtitle="how often each brand appears in the same answers">
            {competitors.length === 0 ? (
              <p className="px-4 py-10 text-center text-[12px] text-brand-400">
                No competitor has appeared in a checked answer yet.
              </p>
            ) : (
              <Table minWidth={520}>
                <thead>
                  <tr><Th>Brand</Th><Th align="right">Mentions</Th><Th align="right">Share</Th></tr>
                </thead>
                <tbody>
                  {visibility.data?.shareOfVoice.map((row) => (
                    <Tr key={row.label}>
                      <Td>
                        <span className={row.domain === null ? "text-[12.5px] font-semibold text-brand-950" : "text-[12.5px] text-brand-700"}>
                          {row.label}
                        </span>
                      </Td>
                      <Td align="right"><Mono>{row.mentions}</Mono></Td>
                      <Td align="right"><Mono tone={row.domain === null ? "good" : undefined}>{row.sharePct}%</Mono></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
      )}

      {tab === "ranks" && (
        <NotConnected
          title="Classic rank tracking is not connected"
          what="Google position tracking needs a SERP data source. AI citation share, which is what this product measures, is on the Prompts tab."
          needs={["A SERP API subscription (e.g. DataForSEO, SerpAPI)", "A keyword list per client", "A daily rank-check job"]}
        />
      )}
    </div>
  );
}
