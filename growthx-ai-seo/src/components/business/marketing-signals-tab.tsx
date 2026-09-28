"use client";

import { Loader2, Sparkles } from "lucide-react";
import { ActionButton, PageHeader, Panel, Pill, StatusNote } from "@/components/ui/console";
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

  // Which read is running: undefined is your own site, an id is one competitor.
  // Only that button spins, instead of every "Re-read" on the page.
  const reading = (competitorId?: string) => generate.isPending && generate.variables === competitorId;
  const readTarget =
    generate.variables === undefined
      ? "your homepage"
      : (data?.competitors.find((c) => c.competitor.id === generate.variables)?.competitor.label ?? "that competitor");

  // A failed read used to leave the screen exactly as it was, so clicking the
  // button looked like it did nothing. Say what happened either way.
  const outcome = generate.isError ? (
    <StatusNote tone="bad">
      {generate.error instanceof Error ? generate.error.message : "Could not read the page. Please try again."}
    </StatusNote>
  ) : generate.isSuccess && generate.data.length === 0 ? (
    // Not an error: the read worked and the page simply says nothing we can quote.
    <div className="rounded-xl border bg-brand-50 px-4 py-2.5 text-[12px] text-brand-700">
      We read {readTarget}, but it doesn&apos;t clearly state any value props, offers or tone yet. Adding a clear
      headline and what makes you different to that page will give us something to read.
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marketing Signals"
        subtitle="Value-prop phrases, promos and tone, read off the copy already on your crawled pages."
        actions={
          <ReadButton reading={reading(undefined)} disabled={generate.isPending} onClick={() => generate.mutate(undefined)} />
        }
      />

      {outcome}

      <TimedQueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={!hasAny}
        emptyTitle="No marketing signals yet"
        emptyBody={'Click "Read your positioning" to have the AI router read your homepage\'s own copy for value props, promos and tone.'}
        emptyAction={
          <ReadButton reading={reading(undefined)} disabled={generate.isPending} onClick={() => generate.mutate(undefined)} />
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
                  icon={
                    reading(result.competitor.id) ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />
                  }
                  disabled={generate.isPending}
                  onClick={() => generate.mutate(result.competitor.id)}
                >
                  {reading(result.competitor.id) ? "Reading…" : "Re-read"}
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

function ReadButton({ reading, disabled, onClick }: { reading: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <ActionButton
      variant="primary"
      icon={reading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      disabled={disabled}
      onClick={onClick}
    >
      {reading ? "Reading…" : "Read your positioning"}
    </ActionButton>
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
