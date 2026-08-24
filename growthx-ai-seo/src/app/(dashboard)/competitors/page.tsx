"use client";
import { Suspense, useState } from "react";
import { Target, Loader2, Plus, Zap } from "lucide-react";
import { PageHeader, Panel, Table, Th, Tr, Td, ActionButton } from "@/components/ui/console";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { useWorkspace, useVisibility, useAddCompetitor } from "@/hooks/use-growthx";

function CompetitorsClient() {
  const { projectId } = useWorkspace();
  const visibility = useVisibility(projectId, 28);
  const addCompetitor = useAddCompetitor(projectId);

  const [activeTab, setActiveTab] = useState("overview");
  const [domain, setDomain] = useState("");
  const [label, setLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain) return;
    
    try {
      await addCompetitor.mutateAsync({ domain, label: label || undefined });
      setDomain("");
      setLabel("");
      setIsAdding(false);
    } catch {
      // Swallowed on purpose: the MutationCache in `providers.tsx` has already
      // shown the failure. Catching it keeps the rejection from surfacing as an
      // unhandled promise error, and keeps the success-only cleanup above from
      // running when the call did not succeed.
    }
  };

  const report = visibility.data;
  const shareOfVoice = report?.shareOfVoice ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Competitor Intelligence"
        subtitle="Track AI Share of Voice against your top competitors."
        actions={
          <ActionButton 
            variant="secondary" 
            icon={<Plus size={12} />}
            onClick={() => setIsAdding(!isAdding)}
          >
            Add Competitor
          </ActionButton>
        }
      />

      <div className="flex space-x-1 border-b border-brand-200 overflow-x-auto pb-[-1px]">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "overview"
              ? "border-brand-950 text-brand-950"
              : "border-transparent text-brand-500 hover:text-brand-950 hover:border-brand-300"
          }`}
        >
          <Target size={14} />
          AI Share of Voice
        </button>
      </div>

      <div className="pt-2">
        {isAdding && (
          <div className="mb-4">
            <Panel title="Add Competitor" subtitle="Track how often AI cites them instead of you.">
            <form onSubmit={handleAddCompetitor} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="domain" className="block text-[13px] font-medium text-brand-950 mb-1">Domain</label>
                  <input id="domain"
                    type="text"
                    required
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="e.g. competitor.com"
                    className="w-full h-9 px-3 text-[13px] border border-brand-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-950"
                  />
                </div>
                <div>
                  <label htmlFor="label-optional" className="block text-[13px] font-medium text-brand-950 mb-1">Label (Optional)</label>
                  <input id="label-optional"
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Competitor Inc"
                    className="w-full h-9 px-3 text-[13px] border border-brand-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-950"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-[13px] font-medium text-brand-500 hover:text-brand-950"
                >
                  Cancel
                </button>
                <ActionButton
                  variant="primary"
                  type="submit"
                  disabled={addCompetitor.isPending || !domain}
                >
                  {addCompetitor.isPending ? "Adding..." : "Add Competitor"}
                </ActionButton>
              </div>
            </form>
          </Panel>
          </div>
        )}

        <QueryState
          isLoading={visibility.isLoading}
          error={visibility.error}
          isEmpty={!projectId}
        >
          <Panel title="Share of Voice" subtitle="Percentage of tracked prompts where the brand was cited.">
            {shareOfVoice.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Target size={48} className="text-brand-200 mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">No Data Available</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  Add competitors and sweep your AI visibility prompts to see share of voice.
                </p>
              </div>
            ) : (
              <Table minWidth={600}>
                <thead>
                  <tr>
                    <Th>Brand / Domain</Th>
                    <Th>Total Mentions</Th>
                    <Th>Share of Voice</Th>
                  </tr>
                </thead>
                <tbody>
                  {shareOfVoice.map((row, idx) => (
                    <Tr key={row.domain || idx}>
                      <Td>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium text-brand-950">
                            {row.label || row.domain}
                          </span>
                          {row.label && row.domain && (
                            <span className="text-[11px] text-brand-500">{row.domain}</span>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <span className="text-[13px] font-medium text-brand-950">{row.mentions}</span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-brand-950 w-12">
                            {row.sharePct.toFixed(1)}%
                          </span>
                          <div className="h-2 w-48 bg-brand-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-brand-950 rounded-full" 
                              style={{ width: `${row.sharePct}%` }}
                            />
                          </div>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </QueryState>
      </div>
    </div>
  );
}

export default function CompetitorsPage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading competitors...</div>}>
      <CompetitorsClient />
    </Suspense>
  );
}
