"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Check } from "lucide-react";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

/**
 * Choosing which Google property to read, after authorizing.
 *
 * This screen was missing, and its absence made the whole connect flow
 * unfinishable: authorization succeeded, the tokens were stored, the
 * connection landed in NEEDS_SELECTION — and the page, which only checked for
 * CONNECTED, fell through to "not connected" and offered the Connect button
 * again. Three successful authorizations in the audit trail, and the customer
 * saw the first screen every time.
 *
 * The choice is deliberate rather than automatic. A site can be verified
 * several ways at once — https://example.com, https://www.example.com and
 * sc-domain:example.com are three different properties holding different
 * data — and picking one on the customer's behalf would silently report a
 * fraction of their traffic as all of it.
 */
export function PropertyPicker({
  projectId,
  provider,
  title = provider === "search_console" ? "Select Search Console Property" : "Select GA4 Property",
  emptyHelp = provider === "search_console"
    ? "No verified Search Console properties were found for this Google account. Ensure the site is verified in Google Search Console."
    : "No Google Analytics 4 properties were found for this Google account. Ensure a GA4 property exists.",
}: {
  projectId: string;
  provider: "search_console" | "analytics";
  title?: string;
  /** What to say when the account has no properties — usually a verification problem. */
  emptyHelp?: string;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const properties = useQuery({
    queryKey: ["google-properties", projectId, provider],
    queryFn: async () => {
      if (provider === "search_console") {
        const result = await api.gscProperties(projectId);
        return {
          items: result.properties.map((row) => ({
            id: row.propertyId,
            label: row.propertyId,
            hint:
              row.kind === "DOMAIN"
                ? "Domain property — covers every subdomain and protocol"
                : "URL prefix",
          })),
          diagnostics: result.diagnostics,
        };
      }
      const rows = await api.ga4Properties(projectId);
      return {
        items: rows.map((row) => ({ id: row.propertyId, label: row.displayName, hint: row.accountName })),
        diagnostics: undefined,
      };
    },
  });

  const choose = useMutation({
    mutationFn: (property: { id: string; label: string }) =>
      api.googleSelectResource(projectId, provider, property.id, property.label),
    onSuccess: () => {
      setError(null);
      // The connection flips to CONNECTED, which is what every panel on the
      // page is gated on.
      qc.invalidateQueries({ queryKey: ["google-connections"] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  // The authorization is gone, not merely unfinished.
  //
  // The badge below used to be a hardcoded green tick: this screen asserted
  // "Google account connected" before asking anything, so when the property
  // call came back "…is not connected for this project" the customer was told
  // both at once, in the same card, and had no way to act on either. A picker
  // is the wrong screen entirely for a connection that does not exist.
  const notConnected =
    properties.isError && /not connected|needs to be reconnected/i.test(errorMessage(properties.error));

  if (notConnected) {
    return (
      <div className="rounded-xl border bg-white px-6 py-8" style={{ borderColor: "var(--color-brand-200)" }}>
        <div className="mx-auto max-w-lg">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-error-500" />
            <span className="text-[13px] font-medium text-brand-950">Not connected</span>
          </div>
          <h2 className="mt-3 text-[15px] font-semibold text-brand-950">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-brand-500">
            {errorMessage(properties.error)} Authorize the connection for this project, then come back and pick a
            property. Signing in to GrowthX with a Google account is a separate thing from granting this project
            access to your data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white px-6 py-8" style={{ borderColor: "var(--color-brand-200)" }}>
      <div className="mx-auto max-w-lg">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success-500" />
          <span className="text-[13px] font-medium text-brand-950">Google account connected</span>
        </div>
        <h2 className="mt-3 text-[15px] font-semibold text-brand-950">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-brand-500">
          One more step. Pick which property GrowthX should read — the same site can be verified more than one way,
          and each holds different data.
        </p>

        {properties.isLoading ? (
          <div className="mt-5 flex items-center gap-2 text-[13px] text-brand-500">
            <Loader2 size={14} className="animate-spin" /> Loading your properties…
          </div>
        ) : properties.isError ? (
          <div className="mt-5 flex items-start gap-2 rounded-lg bg-error-50 px-3 py-2.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-error-500" />
            <p className="text-[12px] leading-relaxed text-brand-600">{errorMessage(properties.error)}</p>
          </div>
        ) : !properties.data?.items.length ? (
          // An empty list is almost never an empty account — it is nearly
          // always that the site is verified under a different Google account.
          // Saying "no properties" without saying that leaves someone stuck.
          <div className="mt-5 rounded-lg bg-brand-100 px-4 py-3">
            {/* An empty picker has two opposite causes and the same appearance.
                Google returning nothing means the site is not verified on this
                account; Google returning properties that were all filtered out
                means an access invitation was never accepted. Telling someone
                "no properties found" for both sends half of them to fix the
                wrong thing. */}
            {properties.data?.diagnostics?.excludedAsUnverified ? (
              <>
                <p className="text-[13px] font-medium text-brand-950">
                  {properties.data.diagnostics.excludedAsUnverified} propert
                  {properties.data.diagnostics.excludedAsUnverified === 1 ? "y is" : "ies are"} pending verification
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-brand-600">
                  Google returned {properties.data.diagnostics.returnedByGoogle} propert
                  {properties.data.diagnostics.returnedByGoogle === 1 ? "y" : "ies"} for this account, but the
                  verification was never completed or the access invitation was never accepted. Open Search Console,
                  finish verifying, then come back and reload this page.
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-medium text-brand-950">No properties found on this Google account</p>
                <p className="mt-1 text-[12px] leading-relaxed text-brand-600">{emptyHelp}</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="mt-5 space-y-2">
              {properties.data.items.map((property) => (
                <label
                  key={property.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition ${
                    selected === property.id ? "border-accent-600 bg-accent-600/5" : "border-brand-200 hover:bg-brand-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="property"
                    className="mt-0.5"
                    checked={selected === property.id}
                    onChange={() => setSelected(property.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-brand-950">{property.label}</span>
                    {property.hint && <span className="block text-[11px] text-brand-500">{property.hint}</span>}
                  </span>
                </label>
              ))}
            </div>

            <button
              onClick={() => {
                const property = properties.data!.items.find((p) => p.id === selected);
                if (property) choose.mutate({ id: property.id, label: property.label });
              }}
              disabled={!selected || choose.isPending}
              className="mt-5 flex items-center gap-2 rounded-lg bg-brand-950 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {choose.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {choose.isPending ? "Saving…" : "Continue"}
            </button>
          </>
        )}

        {error && <p className="mt-3 text-[12px] text-error-500">{error}</p>}
      </div>
    </div>
  );
}
