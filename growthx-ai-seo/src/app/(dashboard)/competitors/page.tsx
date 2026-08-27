"use client";
import { Suspense, useState } from "react";
import { Target, Loader2, Plus, Zap, Trash2 } from "lucide-react";
import { PageHeader, Panel, Table, Th, Tr, Td, ActionButton } from "@/components/ui/console";
import { useWorkspace, useVisibility, useAddCompetitor } from "@/hooks/use-growthx";
import { QueryState } from "@/components/ui/query-state";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

function CompetitorsClient() {
  const { projectId } = useWorkspace();
  const visibility = useVisibility(projectId, 28);
  const addCompetitor = useAddCompetitor(projectId);

  const [domain, setDomain] = useState("");
  const [label, setLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const qc = useQueryClient();
  // Share of voice is built from prompt citations, so a competitor added a
  // moment ago is absent from it — nothing has been asked about them yet.
  // Listing what is tracked is what makes a successful add visible.
  const tracked = useQuery({
    queryKey: ["tracked-competitors", projectId],
    queryFn: () => api.listCompetitors(projectId!),
    enabled: !!projectId,
  });
  const removeCompetitor = useMutation({
    mutationFn: (competitorId: string) => api.removeCompetitor(projectId!, competitorId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracked-competitors", projectId] }),
  });

  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain) return;
    
    setAddError(null);
    try {
      await addCompetitor.mutateAsync({ domain, label: label || undefined });
      setDomain("");
      setLabel("");
      setIsAdding(false);
      await qc.invalidateQueries({ queryKey: ["tracked-competitors", projectId] });
    } catch (err) {
      // Previously the form closed either way, so a rejected save looked
      // exactly like a successful one.
      setAddError(errorMessage(err));
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


      <div className="pt-2">
        {isAdding && (
          <div className="mb-4">
            <Panel title="Add Competitor" subtitle="Track how often AI cites them instead of you.">
            <form onSubmit={handleAddCompetitor} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-brand-950 mb-1">Domain</label>
                  <input
                    type="text"
                    required
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="e.g. competitor.com"
                    className="w-full h-9 px-3 text-[13px] border border-brand-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-950"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-brand-950 mb-1">Label (Optional)</label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Competitor Inc"
                    className="w-full h-9 px-3 text-[13px] border border-brand-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-950"
                  />
                </div>
              </div>
              {addError && (
                <p className="mb-2 text-[12px] text-error-500">{addError}</p>
              )}
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
          {/* Listed separately from share of voice, which only contains brands a
              tracked prompt has actually cited. A competitor added a moment ago
              appears in neither that table nor anywhere else, so the save read
              as a failure even though the row was written. */}
          <Panel
            title="Tracked Competitors"
            subtitle={
              tracked.data?.length
                ? `${tracked.data.length} tracked. Share of voice fills in once visibility prompts have been swept.`
                : "Competitors you add appear here straight away."
            }
          >
            {tracked.isLoading ? (
              <div className="flex items-center gap-2 px-5 py-6 text-[12px] text-[var(--text-muted)]">
                <Loader2 size={13} className="animate-spin" /> Loading competitors…
              </div>
            ) : !tracked.data?.length ? (
              <div className="px-5 py-6 text-[12px] text-[var(--text-muted)]">
                None yet. Add one above to compare AI citations against your own.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--color-brand-100)" }}>
                {tracked.data.map((competitor) => (
                  <div key={competitor.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-brand-950">
                        {competitor.label || competitor.domain}
                      </div>
                      {competitor.label && (
                        <div className="text-[11px] text-brand-500">{competitor.domain}</div>
                      )}
                    </div>
                    <button
                      onClick={() => removeCompetitor.mutate(competitor.id)}
                      disabled={removeCompetitor.isPending}
                      className="rounded-md p-1.5 text-brand-400 transition hover:bg-brand-100 hover:text-error-500 disabled:opacity-50"
                      aria-label={`Stop tracking ${competitor.domain}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

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
