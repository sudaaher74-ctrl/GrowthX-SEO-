"use client";

import React, { useState } from "react";
import { AlertCircle, BadgeCheck, HelpCircle, Loader2, MapPin, Store } from "lucide-react";
import { GbpStoreIcon, GoogleGLogo } from "./gbp-icons";
import {
  GBP_PROVIDER,
  useGbpLocations,
  useSelectGoogleResource,
  useSyncBusinessProfile,
} from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";

interface SelectGbpLocationProps {
  projectId: string | null;
  /** Called once the location is committed and its first sync has finished. */
  onSelected?: () => void;
  onCancel?: () => void;
}

/**
 * Step two of the real Google connection.
 *
 * Google returns every location the signed-in account can manage, across every
 * account it belongs to, and one project tracks exactly one of them. Committing
 * the choice and running the first sync are done together, because a location
 * selected but never synced is a screen full of nothing with no explanation.
 */
export function SelectGbpLocation({ projectId, onSelected, onCancel }: SelectGbpLocationProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useGbpLocations(projectId);
  const selectMutation = useSelectGoogleResource(projectId);
  const syncMutation = useSyncBusinessProfile(projectId);

  const [chosenId, setChosenId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const busy = selectMutation.isPending || syncMutation.isPending;

  const handleChoose = (location: { id: string; title: string | null }) => {
    if (!projectId) return;
    setChosenId(location.id);
    setFailure(null);

    selectMutation.mutate(
      {
        provider: GBP_PROVIDER,
        resourceId: location.id,
        resourceName: location.title ?? location.id,
      },
      {
        onSuccess: () => {
          // The first sync is started here rather than left to the daily
          // scheduler: a customer who has just finished connecting should not
          // have to wait until tomorrow to see anything.
          syncMutation.mutate(undefined, {
            onSettled: () => onSelected?.(),
          });
        },
        onError: (err) => {
          setChosenId(null);
          setFailure(errorMessage(err));
        },
      },
    );
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      <div className="flex items-start gap-3.5 border-b pb-5" style={{ borderColor: "var(--border-color)" }}>
        <div className="shrink-0 p-1 rounded-2xl bg-brand-50 border border-brand-200/80 shadow-xs">
          <GbpStoreIcon className="w-11 h-11" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-950">
            Choose the location to track
          </h1>
          <p className="mt-0.5 text-xs text-brand-500 max-w-2xl">
            You are signed in with Google. Pick the business listing this project should read — every
            tab on this screen reports on the one you choose. You can change it later.
          </p>
        </div>
      </div>

      {failure && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-error-50 border border-error-200 text-xs text-error-800">
          <AlertCircle size={15} className="text-error-600 shrink-0 mt-0.5" />
          <div className="flex-1">{failure}</div>
        </div>
      )}

      {isLoading ? (
        <div
          className="rounded-2xl border bg-white p-10 shadow-xs flex flex-col items-center gap-3 text-center"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Loader2 size={22} className="animate-spin text-brand-400" />
          <p className="text-xs text-brand-500">Asking Google which locations this account manages…</p>
        </div>
      ) : isError ? (
        <div
          className="rounded-2xl border bg-white p-10 shadow-xs flex flex-col items-center gap-3 text-center"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertCircle size={22} />
          </div>
          <h2 className="text-sm font-bold text-brand-950">Google would not list your locations</h2>
          <p className="text-xs text-brand-500 max-w-md leading-relaxed">{errorMessage(error)}</p>
          <p className="text-[11px] text-brand-400 max-w-md leading-relaxed">
            If this mentions permission or approval, it is a Google-side decision on this
            deployment&apos;s API access rather than a problem with your account.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-1 px-3.5 py-2 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      ) : data && data.locations.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.locations.map((location) => {
            const isChosen = chosenId === location.id;
            return (
              <div
                key={location.id}
                className="rounded-2xl border bg-white p-5 shadow-xs flex items-start justify-between gap-4 transition hover:border-brand-300"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Store size={15} className="text-blue-600 shrink-0" />
                    <h3 className="text-sm font-bold text-brand-950 truncate">
                      {location.title ?? location.id}
                    </h3>
                  </div>
                  <p className="text-xs text-brand-500 flex items-start gap-1.5">
                    <MapPin size={12} className="shrink-0 mt-0.5 text-brand-400" />
                    <span className="truncate">{location.address ?? "No address on this listing"}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="text-[11px] font-medium text-brand-600">
                      {location.primaryCategory ?? "No primary category"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                        location.verified === true
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : location.verified === false
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-brand-50 text-brand-600 border-brand-200"
                      }`}
                    >
                      {location.verified === true ? (
                        <>
                          <BadgeCheck size={11} /> Verified
                        </>
                      ) : location.verified === false ? (
                        "Not verified"
                      ) : (
                        <>
                          <HelpCircle size={11} /> Verification unknown
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-brand-400 truncate pt-0.5">{location.id}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleChoose(location)}
                  disabled={busy}
                  className="shrink-0 px-3.5 py-2 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isChosen && busy && <Loader2 size={12} className="animate-spin" />}
                  {isChosen && syncMutation.isPending
                    ? "Syncing…"
                    : isChosen && selectMutation.isPending
                      ? "Linking…"
                      : "Track this one"}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="rounded-2xl border bg-white p-10 shadow-xs flex flex-col items-center gap-3 text-center"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <GoogleGLogo size={22} />
          </div>
          <h2 className="text-sm font-bold text-brand-950">
            {data && data.diagnostics.accountsReturnedByGoogle === 0
              ? "This Google account manages no Business Profile"
              : "This Google account has no locations in it"}
          </h2>
          <p className="text-xs text-brand-500 max-w-md leading-relaxed">
            {data && data.diagnostics.accountsReturnedByGoogle === 0
              ? "Google returned no Business Profile accounts for the account you signed in with. If your listing lives under a different Google login, or under an agency account you have not been added to, connect again with that one."
              : `Google returned ${data?.diagnostics.accountsReturnedByGoogle} Business Profile account(s) for this login, but no location inside them. Ask the owner to give this account access to the location, then try again.`}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-1 px-3.5 py-2 rounded-lg border border-brand-200 bg-white text-xs font-semibold text-brand-800 hover:bg-brand-50 transition disabled:opacity-50"
          >
            Check again
          </button>
        </div>
      )}

      {onCancel && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-brand-500 hover:text-brand-800 transition"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
