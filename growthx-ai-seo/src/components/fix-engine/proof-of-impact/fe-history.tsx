"use client";

import { useState } from "react";
import { Search, Filter, ExternalLink, ArrowRight } from "lucide-react";
import { Panel, Pill, Table, Th } from "@/components/ui/console";
import type { FixHistoryItem } from "@/lib/api-types";

export function FixEngineHistoryView({
  fixes,
  onSelectFix,
}: {
  fixes: FixHistoryItem[];
  onSelectFix: (runId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredFixes = fixes.filter((fix) => {
    const matchesSearch =
      fix.title.toLowerCase().includes(search.toLowerCase()) ||
      fix.affectedPage.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "VERIFIED" && fix.verificationStatus === "VERIFIED") ||
      (statusFilter === "AWAITING" && fix.verificationStatus === "AWAITING_APPROVAL") ||
      (statusFilter === "FAILED" && fix.deploymentStatus === "FAILED");
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <Panel
        title="Fix History"
        subtitle="Searchable directory of technical SEO fixes with deployment and verification states"
        padded
      >
        <div className="flex flex-col sm:flex-row gap-3 justify-between mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-brand-400" />
            <input
              type="text"
              placeholder="Search by fix title or URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-line bg-white pl-9 pr-3 py-1.5 text-xs text-brand-900 placeholder:text-brand-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={13} className="text-brand-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-brand-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="VERIFIED">Verified Deployed</option>
              <option value="AWAITING">Awaiting Review</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {filteredFixes.length > 0 ? (
          <Table minWidth={900}>
            <thead>
              <tr>
                <Th>Fix Title &amp; Details</Th>
                <Th>Affected Page</Th>
                <Th>Priority</Th>
                <Th>GitHub PR</Th>
                <Th>Deployment</Th>
                <Th>Verification</Th>
                <Th>Impact</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {filteredFixes.map((fix) => (
                <tr key={fix.id} className="hover:bg-brand-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-brand-900">{fix.title}</div>
                    <div className="text-[10px] text-brand-400 font-mono mt-0.5">
                      {fix.date ? new Date(fix.date).toLocaleDateString() : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-brand-600 max-w-xs truncate">
                    {fix.affectedPage}
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        fix.priority === "CRITICAL"
                          ? "bad"
                          : fix.priority === "HIGH"
                          ? "warn"
                          : "default"
                      }
                    >
                      {fix.priority}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    {fix.pullRequestUrl ? (
                      <a
                        href={fix.pullRequestUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary-600 hover:underline font-mono"
                      >
                        PR Link <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="text-brand-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] text-brand-700">{fix.deploymentStatus}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        fix.verificationStatus === "VERIFIED"
                          ? "good"
                          : fix.verificationStatus === "AWAITING_APPROVAL"
                          ? "warn"
                          : "default"
                      }
                    >
                      {fix.verificationStatus}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-semibold ${
                        fix.impactStatus === "OBSERVED"
                          ? "text-success-700"
                          : fix.impactStatus === "ESTIMATED"
                          ? "text-primary-700"
                          : "text-brand-400"
                      }`}
                    >
                      {fix.impactStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onSelectFix(fix.runId)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800"
                    >
                      Inspect <ArrowRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="p-8 text-center text-xs text-brand-400">
            No fixes match the search or filter criteria.
          </div>
        )}
      </Panel>
    </div>
  );
}
