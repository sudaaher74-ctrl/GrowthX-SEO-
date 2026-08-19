"use client";
import { Suspense, useState } from "react";
import { Loader2, Zap, FileText, UploadCloud, Edit3 } from "lucide-react";
import { PageHeader, Panel, Table, Th, Tr, Td, Pill, ActionButton, Mono } from "@/components/ui/console";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { useWorkspace, useContentPieces, usePlanContent, useDraftContent, useRunContent } from "@/hooks/use-growthx";
import type { ContentPiece } from "@/lib/api-client";

function ContentClient() {
  const { projectId } = useWorkspace();
  const pieces = useContentPieces(projectId);
  const planContent = usePlanContent(projectId);
  const draftContent = useDraftContent(projectId);
  const runContent = useRunContent(projectId);

  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleGeneratePlan = async () => {
    await planContent.mutateAsync();
  };

  const handleDraft = async (pieceId: string) => {
    setDraftingId(pieceId);
    try {
      await draftContent.mutateAsync(pieceId);
    } finally {
      setDraftingId(null);
    }
  };

  const handlePush = async (pieceId: string) => {
    setRunningId(pieceId);
    try {
      await runContent.mutateAsync([pieceId]);
    } finally {
      setRunningId(null);
    }
  };

  const allPieces = pieces.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Content Studio"
        subtitle="Manage the content pipeline from keyword strategy to GitHub publishing."
        actions={
          <ActionButton
            variant="primary"
            icon={planContent.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            onClick={handleGeneratePlan}
            disabled={planContent.isPending || !projectId}
          >
            {planContent.isPending ? "Generating..." : "Generate Content Plan"}
          </ActionButton>
        }
      />

      <QueryState
        isLoading={pieces.isLoading}
        error={pieces.error}
        isEmpty={!projectId}
        emptyTitle="No Project Selected"
        emptyBody="Please select a client project to view content."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <Panel title="Social Integrations" subtitle="Connect brand accounts to train AI">
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between p-3 border border-[var(--border)] rounded-md bg-[var(--bg-subtle)]">
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">Meta (Facebook/Instagram)</h4>
                  <p className="text-[11.5px] text-[var(--text-muted)] mt-0.5">Analyze owned engagement data</p>
                </div>
                <a 
                  href={`http://localhost:3001/api/integrations/facebook/auth?projectId=${projectId}`}
                  className="px-3 py-1.5 text-xs font-medium bg-[#1877F2] text-white rounded hover:bg-[#1877F2]/90 transition-colors"
                >
                  Connect Meta
                </a>
              </div>
              
              <div className="flex items-center justify-between p-3 border border-[var(--border)] rounded-md bg-[var(--bg-subtle)]">
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">YouTube</h4>
                  <p className="text-[11.5px] text-[var(--text-muted)] mt-0.5">Analyze owned video performance</p>
                </div>
                <a 
                  href={`http://localhost:3001/api/integrations/youtube/auth?projectId=${projectId}`}
                  className="px-3 py-1.5 text-xs font-medium bg-[#FF0000] text-white rounded hover:bg-[#FF0000]/90 transition-colors"
                >
                  Connect YouTube
                </a>
              </div>
            </div>
          </Panel>

          <Panel title="Competitor Analysis" subtitle="Track rival social strategies">
            <div className="py-2">
               <div className="flex flex-col items-center justify-center h-full min-h-[140px] text-center">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">Add Competitor Handles</h3>
                <p className="text-xs text-[var(--text-muted)] max-w-[250px] mt-1.5 mb-3">
                  The AI will monitor these handles to identify winning formats and content gaps.
                </p>
                <ActionButton variant="secondary" icon={<Edit3 size={12} />}>
                  Configure Handles
                </ActionButton>
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Content Strategy & Drafts" subtitle={`${allPieces.length} pieces tracked in the pipeline.`}>
          {allPieces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText size={48} className="text-[#e4e4e7] mb-4" />
              <h3 className="text-lg font-medium text-[var(--text-primary)]">No Content Planned</h3>
              <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                Click "Generate Content Plan" to have the AI evaluate your search strategy and propose new topics.
              </p>
            </div>
          ) : (
            <Table minWidth={900}>
              <thead>
                <tr>
                  <Th>Status</Th>
                  <Th>Content Piece</Th>
                  <Th>Target Query</Th>
                  <Th>AI Rationale</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {allPieces.map((piece: ContentPiece) => (
                  <Tr key={piece.id}>
                    <Td>
                      <Pill
                        tone={
                          piece.status === "PLANNED"
                            ? "default"
                            : piece.status === "DRAFTED"
                            ? "warn"
                            : piece.status === "COMMITTED" || piece.status === "PUBLISHED"
                            ? "good"
                            : "bad"
                        }
                      >
                        {piece.status}
                      </Pill>
                    </Td>
                    <Td>
                      <span className="text-[12.5px] font-medium text-[#09090b]">{piece.title}</span>
                      <span className="block mt-0.5 text-[11px] text-[#71717a]">/{piece.slug}</span>
                    </Td>
                    <Td>
                      <Mono tone="soft">{piece.targetQuery || "—"}</Mono>
                    </Td>
                    <Td>
                      <span className="max-w-xs block text-[11.5px] text-[#71717a] truncate" title={piece.rationale || ""}>
                        {piece.rationale || "—"}
                      </span>
                    </Td>
                    <Td align="right">
                      {piece.status === "PLANNED" && (
                        <ActionButton
                          onClick={() => handleDraft(piece.id)}
                          disabled={draftingId === piece.id}
                          icon={draftingId === piece.id ? <Loader2 size={11} className="animate-spin" /> : <Edit3 size={11} />}
                        >
                          {draftingId === piece.id ? "Drafting..." : "Write Draft"}
                        </ActionButton>
                      )}
                      {piece.status === "DRAFTED" && (
                        <ActionButton
                          onClick={() => handlePush(piece.id)}
                          disabled={runningId === piece.id}
                          variant="primary"
                          icon={runningId === piece.id ? <Loader2 size={11} className="animate-spin" /> : <UploadCloud size={11} />}
                        >
                          {runningId === piece.id ? "Pushing..." : "Push to Repo"}
                        </ActionButton>
                      )}
                      {(piece.status === "COMMITTED" || piece.status === "PUBLISHED") && (
                        <ActionButton disabled>
                          Pushed
                        </ActionButton>
                      )}
                      {piece.status === "REJECTED" && (
                        <ActionButton disabled>
                          Rejected
                        </ActionButton>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </QueryState>
    </div>
  );
}

export default function ContentPage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading content studio...</div>}>
      <ContentClient />
    </Suspense>
  );
}
