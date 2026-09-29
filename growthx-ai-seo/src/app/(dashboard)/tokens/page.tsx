"use client";
import { Info } from "lucide-react";
import { ActionButton, Kpi, MeterBar, Mono, PageHeader, Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { useTokenTransactions, useTokens, useWorkspace } from "@/hooks/use-growthx";
import {
  actionLabel,
  allowanceLeftPct,
  costOf,
  describeTransaction,
  formatTokens,
  formatTokensExact,
  isActive,
  refillDate,
  standingOf,
  type ActiveTokens,
} from "@/lib/tokens";

/**
 * What the workspace can use, what it has used, and what things cost.
 *
 * Every figure here is read from the API: the balance and the ledger from the
 * database, and the prices from the same configuration the server charges by,
 * so this page cannot quote a price the server does not charge.
 */
export default function TokensPage() {
  const { orgId } = useWorkspace();
  const tokens = useTokens(orgId);
  const data = tokens.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tokens"
        subtitle="What your workspace can use each month. AI analysis and local ranking scans use tokens."
      />

      <QueryState isLoading={!orgId || tokens.isLoading} error={tokens.error}>
        {data && !isActive(data) && (
          <Panel padded>
            <p className="text-[13px] font-semibold text-brand-950">Tokens are switched off</p>
            <p className="mt-1 text-[12.5px] text-brand-500">
              Nothing you do here is counted or limited on this deployment.
            </p>
          </Panel>
        )}
        {isActive(data) && <Overview data={data} />}
      </QueryState>

      {isActive(data) && <History orgId={orgId} mode={data.mode} />}
    </div>
  );
}

function Overview({ data }: { data: ActiveTokens }) {
  const standing = standingOf(data);
  const pct = allowanceLeftPct(data);
  const refills = refillDate(data.allowance.periodEnd);
  const shadow = data.mode === "shadow";
  const usedBy = (line: (typeof data.usage.lines)[number]) => costOf(line, data.mode, "usage");
  const totalUsed = data.usage.lines.reduce((sum, line) => sum + usedBy(line), 0);

  return (
    <div className="space-y-4">
      {data.mode === "shadow" && (
        <div className="flex items-start gap-2.5 rounded-xl border bg-accent-50 px-4 py-3 text-[12.5px] text-accent-700">
          <Info size={15} className="mt-0.5 shrink-0" />
          <p>
            Usage is being counted, but nothing is limited yet — features keep working even when the balance
            reaches zero.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Available now"
          value={formatTokens(data.available)}
          tone={standing === "out" ? "danger" : "default"}
          sub={`${formatTokensExact(data.available)} tokens. Monthly tokens are used first.`}
        />
        <Kpi
          label="Monthly tokens left"
          value={formatTokens(data.allowance.remaining)}
          meter={pct}
          sub={
            <>
              of {formatTokens(data.allowance.granted)} · refills {refills}
              {data.allowance.monthly !== data.allowance.granted && (
                <> · then {formatTokens(data.allowance.monthly)} a month</>
              )}
            </>
          }
        />
        <Kpi
          label="Bonus tokens"
          value={formatTokens(data.bonus)}
          sub="Never expire. Used after your monthly tokens."
        />
      </div>

      <Panel
        title="Used this month"
        subtitle={totalUsed > 0 ? `${formatTokensExact(totalUsed)} tokens in total` : undefined}
      >
        {data.usage.lines.length === 0 ? (
          <p className="px-4 py-6 text-[12.5px] text-brand-500">Nothing has used tokens yet this month.</p>
        ) : (
          <Table minWidth={560}>
            <thead>
              <tr>
                <Th>What</Th>
                <Th align="right">Times</Th>
                <Th align="right">Tokens</Th>
                <Th>Share</Th>
              </tr>
            </thead>
            <tbody>
              {data.usage.lines.map((line) => (
                <Tr key={line.action}>
                  <Td>
                    <span className="text-[12.5px] font-medium text-brand-950">{actionLabel(line.action)}</span>
                    {!shadow && line.shortfall > 0 && (
                      <span className="ml-2 align-middle">
                        <Pill tone="warn">{formatTokens(line.shortfall)} not covered</Pill>
                      </span>
                    )}
                  </Td>
                  <Td align="right">
                    <Mono>{formatTokensExact(line.count)}</Mono>
                  </Td>
                  <Td align="right">
                    <Mono>{formatTokensExact(usedBy(line))}</Mono>
                  </Td>
                  <Td>{totalUsed > 0 && <MeterBar value={(usedBy(line) / totalUsed) * 100} width={96} />}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel title="What uses tokens" subtitle="Anything not listed here does not use tokens." padded>
        <ul className="space-y-4">
          <li>
            <p className="text-[12.5px] font-semibold text-brand-950">{actionLabel("AI_USAGE")}</p>
            <p className="mt-0.5 text-[12px] text-brand-500">
              The AI reads and writes in small pieces of text called tokens, about four characters each. Every piece
              it reads costs {data.rates.ai.inputWeight} of your tokens, and every piece it writes costs{" "}
              {data.rates.ai.outputWeight}. A short answer costs little; a full report costs more.
            </p>
          </li>
          {data.rates.actions.map((rate) => (
            <li key={rate.action}>
              <p className="text-[12.5px] font-semibold text-brand-950">{actionLabel(rate.action)}</p>
              <p className="mt-0.5 text-[12px] text-brand-500">
                {formatTokensExact(rate.tokensPerUnit)} tokens per {rate.unit}.
                {rate.action === "GEO_GRID_POINT" &&
                  ` A 3×3 scan checks 9 points (${formatTokensExact(9 * rate.tokensPerUnit)} tokens) and a 9×9 scan checks 81 (${formatTokensExact(81 * rate.tokensPerUnit)}). If a scan fails, its tokens are returned.`}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function History({ orgId, mode }: { orgId: string | null; mode: ActiveTokens["mode"] }) {
  const ledger = useTokenTransactions(orgId);
  const rows = ledger.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Panel title="History" subtitle="Every change to your tokens, newest first.">
      <QueryState
        isLoading={ledger.isLoading}
        error={ledger.error}
        isEmpty={rows.length === 0}
        emptyTitle="No history yet"
        emptyBody="Your tokens will be listed here as they are added and used."
      >
        <Table minWidth={720}>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>What</Th>
              <Th align="right">Tokens</Th>
              <Th align="right">Balance after</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { title, note } = describeTransaction(row);
              return (
                <Tr key={row.id}>
                  <Td className="whitespace-nowrap">
                    <span className="text-[12px] text-brand-500">
                      {new Date(row.createdAt).toLocaleString(undefined, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </Td>
                  <Td>
                    <p className="text-[12.5px] font-medium text-brand-950">{title}</p>
                    {note && <p className="mt-0.5 text-[11px] text-brand-400">{note}</p>}
                    {mode === "enforce" && row.shortfall > 0 && (
                      <p className="mt-0.5 text-[11px] text-warning-700">
                        {formatTokensExact(row.shortfall)} more tokens were needed than you had.
                      </p>
                    )}
                  </Td>
                  <Td align="right">
                    {(() => {
                      // A spend is shown as what it cost; see costOf for why that differs in shadow mode.
                      const amount = row.kind === "SPEND" ? -costOf(row, mode, "row") : row.tokens;
                      return (
                        <Mono tone={amount > 0 ? "good" : undefined}>
                          {amount > 0 ? "+" : ""}
                          {formatTokensExact(amount)}
                        </Mono>
                      );
                    })()}
                  </Td>
                  <Td align="right">
                    <Mono tone="soft">{formatTokensExact(row.balanceAfter)}</Mono>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
        {ledger.hasNextPage && (
          <div className="flex justify-center border-t p-3">
            <ActionButton onClick={() => ledger.fetchNextPage()} disabled={ledger.isFetchingNextPage}>
              {ledger.isFetchingNextPage ? "Loading…" : "Show more"}
            </ActionButton>
          </div>
        )}
      </QueryState>
    </Panel>
  );
}
