"use client";

import { Loader2, Sparkles } from "lucide-react";
import { ActionButton, PageHeader, Panel, Pill } from "@/components/ui/console";
import { TimedQueryState } from "@/components/ui/timed-query-state";
import { useBusinessMarketingSignals, useGenerateBusinessMarketingSignals } from "@/hooks/use-growthx";
import type { MarketingSignalDto } from "@/lib/api-client";

/**
 * Marketing Signals: positioning/messaging claims read off the already-
 * crawled homepage copy by the multi-AI router — on-page copy only. No new
 * crawl, no ad-spend or social-listening data (a different, higher-cost data
 * category, out of scope for this pass).
 */
export function MarketingSignalsTab({ projectId }: { projectId: string }) {
  const query = useBusinessMarketingSignals(projectId || null);
  const generate = useGenerateBusinessMarketingSignals(projectId || null);
  const data = query.data;
  const hasAny = Boolean(data && (data.mine.length > 0 || data.competitors.some((c) => c.signals.length > 0)));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marketing Signals"
        subtitle="Value-prop phrases, promos and tone, read off the copy already on your crawled pages."
        actions={
          <ActionButton
            variant="primary"
            icon={generate.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            disabled={generate.isPending}
            onClick={() => generate.mutate(undefined)}
          >
            {generate.isPending ? "Reading…" : "Read your positioning"}
          </ActionButton>
        }
      />

      <TimedQueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={!hasAny}
        emptyTitle="No marketing signals yet"
        emptyBody={'Click "Read your positioning" to have the AI router read your homepage\'s own copy for value props, promos and tone.'}
        emptyAction={
          <ActionButton variant="primary" icon={<Sparkles size={13} />} onClick={() => generate.mutate(undefined)}>
            Read your positioning
          </ActionButton>
        }
        onRetry={() => query.refetch()}
      >
        <div className="space-y-4">
          <Panel title="You" padded>
            <SignalList signals={data?.mine ?? []} />
          </Panel>

          {data?.competitors.map((result) => (
            <Panel
              key={result.competitor.id}
              title={result.competitor.label}
              subtitle={result.competitor.domain}
              actions={
                <ActionButton
                  icon={generate.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  disabled={generate.isPending}
                  onClick={() => generate.mutate(result.competitor.id)}
                >
                  Re-read
                </ActionButton>
              }
              padded
            >
              <SignalList signals={result.signals} />
            </Panel>
          ))}
        </div>
      </TimedQueryState>
    </div>
  );
}

function SignalList({ signals }: { signals: MarketingSignalDto[] }) {
  const valueProps = signals.filter((s) => s.kind === "VALUE_PROP");
  const promos = signals.filter((s) => s.kind === "PROMO");
  const tone = signals.find((s) => s.kind === "TONE");

  if (signals.length === 0) {
    return <p className="py-2 text-[12.5px] text-brand-500">Nothing read yet.</p>;
  }

  return (
    <div className="space-y-3">
      {valueProps.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">Value props</p>
          <ul className="mt-1.5 space-y-1">
            {valueProps.map((s) => (
              <li key={s.id} className="text-[12.5px] text-brand-950">
                {s.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {promos.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">Promos detected</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {promos.map((s) => (
              <Pill key={s.id} tone="info">
                {s.text}
              </Pill>
            ))}
          </div>
        </div>
      )}
      {tone && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">Tone</p>
          <p className="mt-1 text-[12.5px] text-brand-600">{tone.text}</p>
        </div>
      )}
    </div>
  );
}
