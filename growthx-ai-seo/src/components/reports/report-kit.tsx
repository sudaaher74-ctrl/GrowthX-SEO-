"use client";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { ActionButton } from "@/components/ui/console";
import { usePortfolio, useWorkspace } from "@/hooks/use-growthx";
import { DASH } from "@/lib/google-format";
import "./report-print.css";

/** Who the report is for, from the selected workspace. */
export function useReportContext() {
  const { orgId, projects, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const project = projects.find((p) => p.id === projectId) ?? null;
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  return { projectId, clientName: project?.name ?? "Your business", domain: client?.domain ?? null };
}

/**
 * One report: a title block, sections, and a Download PDF button that uses the
 * browser's print-to-PDF on just this report. Only figures that were really
 * measured appear; a section without data says so instead of being left out.
 */
export function ReportPage({
  title,
  intro,
  clientName,
  domain,
  children,
}: {
  title: string;
  intro?: string;
  clientName: string;
  domain: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 pb-12">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href="/reports" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent-700 hover:underline">
          <ArrowLeft size={13} /> All reports
        </Link>
        <ActionButton icon={<Printer size={12} />} onClick={() => window.print()}>Download PDF</ActionButton>
      </div>
      <article id="report-root" className="mx-auto max-w-4xl space-y-6 rounded-xl border bg-white p-6 shadow-card sm:p-10">
        <header className="border-b pb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-400">Reigel AI SEO report</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-[-0.02em] text-brand-950">{title}</h1>
          <p className="mt-1 text-[13px] text-brand-600">
            {clientName}
            {domain ? ` · ${domain}` : ""} · {new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
          </p>
          {intro && <p className="mt-3 text-[12.5px] leading-relaxed text-brand-600">{intro}</p>}
        </header>
        {children}
        <footer className="border-t pt-3 text-[10.5px] text-brand-400">
          Figures come from your connected accounts and crawls at the time this report was made. “{DASH}” means a figure was not measured; it is never a zero.
        </footer>
      </article>
    </div>
  );
}

export function ReportSection({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="report-section space-y-2.5">
      <h2 className="text-[15px] font-bold text-brand-950">{title}</h2>
      {note && <p className="text-[11.5px] text-brand-500">{note}</p>}
      {children}
    </section>
  );
}

export function ReportKpis({ items }: { items: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="rounded-lg border p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">{k.label}</p>
          <p className="mt-1 font-mono text-[20px] font-bold text-brand-950">{k.value}</p>
          {k.sub && <p className="mt-0.5 text-[10.5px] text-brand-500">{k.sub}</p>}
        </div>
      ))}
    </div>
  );
}

export function ReportTable({ columns, rows, empty }: { columns: { label: string; right?: boolean }[]; rows: (string | number)[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-[12px] text-brand-500">{empty}</p>;
  return (
    <table className="report-table w-full border-collapse text-[11.5px]">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.label} className={`border-b px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-brand-400 ${c.right ? "text-right" : "text-left"}`}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b last:border-0">
            {r.map((cell, j) => (
              <td key={j} className={`px-2 py-1.5 text-brand-950 ${columns[j]?.right ? "text-right font-mono" : ""}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ReportText({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] leading-relaxed text-brand-950">{children}</p>;
}

/** Shown in place of a section whose source has nothing, so a gap is visible rather than silent. */
export function ReportGap({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-3 py-2 text-[12px] text-brand-500">{children}</p>;
}

export function ReportLoading({ what }: { what: string }) {
  return <p className="no-print py-10 text-center text-[12px] text-brand-500">Preparing {what}…</p>;
}
