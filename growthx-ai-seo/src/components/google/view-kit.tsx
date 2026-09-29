"use client";
import type { UseQueryResult } from "@tanstack/react-query";
import { Table, Td, Th, Tr } from "@/components/ui/console";
import { FailedState, LoadingState } from "@/components/ui/truthful-state";
import type { GscRow } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { count, percent, position } from "@/lib/google-format";
import { cn } from "@/lib/utils";

/** Loading and failure for one stored read; renders `children` only when there is data. */
export function Gate<T>({
  query,
  what,
  children,
}: {
  query: UseQueryResult<T>;
  what: string;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isLoading) return <LoadingState compact title={`Loading ${what}…`} message="Reading the stored data for this workspace." />;
  if (query.error || query.data === undefined) {
    return <FailedState title={`Could not load ${what}`} error={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  }
  return <>{children(query.data)}</>;
}

export function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-[11.5px] font-medium",
        active ? "border-primary-500 bg-primary-50 text-primary-700" : "bg-white text-brand-600 hover:bg-brand-50",
      )}
    >
      {children}
    </button>
  );
}

/** Search Console rows (a query or a page) with the four search figures. */
export function SearchRowsTable({
  rows,
  label,
  extra,
  format = (k) => k,
}: {
  rows: GscRow[];
  label: string;
  extra?: { header: string; cell: (row: GscRow) => React.ReactNode }[];
  format?: (key: string) => string;
}) {
  return (
    <Table minWidth={640 + (extra?.length ?? 0) * 120}>
      <thead>
        <tr>
          <Th>{label}</Th>
          <Th align="right">Clicks</Th>
          <Th align="right">Impressions</Th>
          <Th align="right">CTR</Th>
          <Th align="right">Position</Th>
          {extra?.map((e) => (
            <Th key={e.header} align="right">{e.header}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.key}>
            <Td>
              <span className="block max-w-[380px] truncate text-[12px] text-brand-950" title={r.key}>{format(r.key)}</span>
            </Td>
            <Td align="right">{count(r.clicks)}</Td>
            <Td align="right">{count(r.impressions)}</Td>
            <Td align="right">{percent(r.ctr)}</Td>
            <Td align="right">{position(r.position)}</Td>
            {extra?.map((e) => (
              <Td key={e.header} align="right">{e.cell(r)}</Td>
            ))}
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="p-4 text-[12px] text-brand-500">{children}</p>;
}

/** Shown under a table to say what the view cannot tell you, rather than implying it. */
export function Caveat({ children }: { children: React.ReactNode }) {
  return <p className="border-t px-4 py-2.5 text-[11px] text-brand-500">{children}</p>;
}
