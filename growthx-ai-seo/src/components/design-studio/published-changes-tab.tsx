"use client";
import { ExternalLink, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import type { PublishedChange } from "@/lib/api-client";
import { Panel, Table, Td, Th, Tr } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { StatusChip } from "./status-chip";

/**
 * Everything that reached a publishing target, and what happened next.
 *
 * "SEO result" and "Visual result" are reported from the stored verification
 * row, not inferred from the change having been sent. A change nobody has
 * re-crawled reads "Not verified", which is the truth — an optimistic tick
 * here would undo the point of verifying at all.
 */

const METHOD_LABELS: Record<PublishedChange["method"], string> = {
  GITHUB_PR: "GitHub PR",
  CMS_DRAFT: "CMS draft",
  DIRECT: "Direct",
  DEVELOPER_HANDOFF: "Developer",
};

export function PublishedChangesTab({
  changes,
  isLoading,
  error,
  busyId,
  onVerify,
  onRollback,
  onView,
}: {
  changes: PublishedChange[];
  isLoading: boolean;
  error: unknown;
  busyId: string | null;
  onVerify: (change: PublishedChange) => void;
  onRollback: (change: PublishedChange) => void;
  onView: (change: PublishedChange) => void;
}) {
  return (
    <Panel>
      <QueryState
        isLoading={isLoading}
        error={error}
        isEmpty={changes.length === 0}
        emptyTitle="Nothing published yet"
        emptyBody="Approved changes appear here with their publishing method, verification result and a rollback action."
      >
        <Table minWidth={980}>
          <thead>
            <tr>
              <Th>Page</Th>
              <Th>Change</Th>
              <Th>Published</Th>
              <Th>Method</Th>
              <Th>SEO result</Th>
              <Th>Visual result</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
              {changes.map((change) => {
                const verification = change.verifications?.[0];
                const rollback = change.rollbacks?.[0];
                const busy = busyId === change.id;

                return (
                  <Tr key={change.id}>
                    <Td className="max-w-[220px]">
                      <span className="block truncate font-mono text-[11px] text-brand-700">
                        {change.pageUrl}
                      </span>
                    </Td>
                    <Td className="max-w-[200px]">
                      <span className="block truncate text-brand-950">
                        {change.suggestion?.title ?? "—"}
                      </span>
                      <span className="text-[10.5px] text-brand-400">
                        {change.suggestion?.contentType ?? ""}
                      </span>
                    </Td>
                    <Td className="font-mono text-[11px] text-brand-500">
                      {change.publishedAt
                        ? new Date(change.publishedAt).toLocaleDateString()
                        : "—"}
                    </Td>
                    <Td className="text-[11.5px] text-brand-600">
                      {METHOD_LABELS[change.method]}
                      {change.pullRequestUrl && (
                        <a
                          href={change.pullRequestUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1.5 inline-flex text-accent-600 hover:text-accent-700"
                          aria-label="Open pull request"
                        >
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </Td>
                    <Td className="text-[11.5px]">
                      {verification ? (
                        <span className={verification.contentFound ? "text-success-700" : "text-warning-700"}>
                          {verification.contentFound ? "Content found live" : "Not found live"}
                        </span>
                      ) : (
                        <span className="text-brand-400">Not verified</span>
                      )}
                    </Td>
                    <Td className="text-[11.5px]">
                      {verification?.visualResult?.available ? (
                        <span className="text-success-700">Checked</span>
                      ) : (
                        <span className="text-brand-400">No capture</span>
                      )}
                    </Td>
                    <Td>
                      <StatusChip status={change.status} />
                      {change.error && (
                        <span className="mt-1 block max-w-[180px] text-[10px] leading-snug text-error-700">
                          {change.error}
                        </span>
                      )}
                      {rollback && !rollback.succeeded && rollback.error && (
                        <span className="mt-1 block max-w-[180px] text-[10px] leading-snug text-error-700">
                          {rollback.error}
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="flex items-center justify-end gap-1.5">
                        <RowButton onClick={() => onView(change)}>View</RowButton>
                        <RowButton onClick={() => onVerify(change)} disabled={busy}>
                          {busy ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                          Verify
                        </RowButton>
                        <RowButton
                          onClick={() => onRollback(change)}
                          disabled={busy || change.status === "ROLLED_BACK"}
                        >
                          <RotateCcw size={11} />
                          Roll back
                        </RowButton>
                      </span>
                    </Td>
                  </Tr>
                );
              })}
          </tbody>
        </Table>
      </QueryState>
    </Panel>
  );
}

function RowButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-[10.5px] font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
