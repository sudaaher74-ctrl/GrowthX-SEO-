"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { ActionButton, Panel } from "@/components/ui/console";
import { api, type TenantStat } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { formatTokensExact } from "@/lib/tokens";

/** The most the API accepts in one adjustment. Checked here too so the mistake is caught before the request. */
const MAX_ADJUSTMENT = 1_000_000_000;

const field =
  "h-8 w-full rounded-lg border bg-white px-3 text-[12px] text-brand-950 focus:outline-none focus:ring-1 focus:ring-accent-600";

/**
 * How an operator gives a customer tokens (or takes some back).
 *
 * Bonus tokens never lapse, which is what a grant is for. The note is kept on
 * the ledger for operators; the customer sees "Tokens added by GrowthX" and the
 * amount, never the note.
 */
export function GrantTokensForm({
  tenant,
  onClose,
  onDone,
}: {
  tenant: TenantStat;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(amount.replace(/,/g, "").trim());
  const valid = amount.trim() !== "" && Number.isInteger(value) && value !== 0 && Math.abs(value) <= MAX_ADJUSTMENT;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.adjustTokens(tenant.id, value, note.trim() || undefined);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={`Add tokens to ${tenant.name}`}
      subtitle="Bonus tokens never expire and are used after the monthly tokens. Enter a negative number to take some back."
      padded
      actions={
        <button type="button" onClick={onClose} aria-label="Close" className="text-brand-400 hover:text-brand-950">
          <X size={14} />
        </button>
      }
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-400">Tokens</span>
          <input
            inputMode="numeric"
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="e.g. 2,000,000"
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-400">
            Note (only operators see this)
          </span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="Why, e.g. goodwill after the outage"
            className={field}
          />
        </label>
        <ActionButton type="submit" variant="primary" disabled={!valid || busy}>
          {busy ? "Saving…" : valid ? `${value > 0 ? "Add" : "Take back"} ${formatTokensExact(Math.abs(value))}` : "Add tokens"}
        </ActionButton>
      </form>
      {amount.trim() !== "" && !valid && (
        <p className="mt-2 text-[11.5px] text-error-700">
          Enter a whole number of tokens other than zero, up to {formatTokensExact(MAX_ADJUSTMENT)}.
        </p>
      )}
      {error && <p className="mt-2 text-[11.5px] text-error-700">{error}</p>}
    </Panel>
  );
}
