"use client";

import React from "react";
import { Briefcase, ExternalLink } from "lucide-react";
import { GoogleGLogo } from "../gbp-icons";
import { GbpSourceNotice, GbpTabGate } from "../gbp-states";
import { useGbpServices } from "@/hooks/use-growthx";
import type { GbpService } from "@/lib/api-client";

interface ServicesTabProps {
  projectId: string | null;
  onConnect?: () => void;
  onChooseLocation?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

/**
 * Price, exactly as Google holds it.
 *
 * Money arrives as units and nanos apart so nothing is rounded on the way in,
 * and nothing is rounded on the way out either. A service with no price set is
 * an em dash, never a zero — "free" and "unpriced" are different claims.
 */
function formatPrice(price: GbpService["price"]): string {
  if (!price) return "—";
  if (!price.units && !price.nanos) return "—";
  const units = price.units ? Number(price.units) : 0;
  const nanos = price.nanos ? price.nanos : 0;
  const amount = units + nanos / 1_000_000_000;
  return price.currency ? `${price.currency} ${amount}` : String(amount);
}

export function ServicesTab({
  projectId,
  onConnect,
  onChooseLocation,
  onSync,
  isSyncing,
}: ServicesTabProps) {
  const query = useGbpServices(projectId);

  return (
    <GbpTabGate
      query={query}
      label="Services"
      onConnect={onConnect}
      onChooseLocation={onChooseLocation}
      onSync={onSync}
      isSyncing={isSyncing}
    >
      {(data) =>
        data.services.length === 0 ? (
          <GbpSourceNotice
            source={data.source}
            label="Services"
            onSync={onSync}
            isSyncing={isSyncing}
            emptyTitle="No services listed on this profile"
            emptyBody={
              <>
                Google returned this location&apos;s profile and it lists no services. Adding them on
                Google gives searchers — and Google&apos;s own matching — a concrete list of what this
                business does.
              </>
            }
          />
        ) : (
          <div className="space-y-6">
            <div
              className="rounded-2xl border bg-white shadow-xs overflow-hidden"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-brand-100">
                <div className="flex items-center gap-2">
                  <Briefcase size={15} className="text-purple-600" />
                  <h3 className="text-sm font-bold text-brand-950">Services on this profile</h3>
                </div>
                <span className="font-mono text-xs font-bold text-brand-600">
                  {data.services.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-brand-500 bg-brand-50/60">
                      <th className="px-5 py-2.5">Service</th>
                      <th className="px-5 py-2.5">Type</th>
                      <th className="px-5 py-2.5">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100">
                    {data.services.map((service) => (
                      <tr key={service.id} className="hover:bg-brand-50/50 transition">
                        <td className="px-5 py-3 align-top">
                          <p className="text-xs font-bold text-brand-950">
                            {service.displayName ?? "Unnamed service"}
                          </p>
                          {service.description && (
                            <p className="mt-0.5 text-[11px] text-brand-500 leading-relaxed max-w-md">
                              {service.description}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3 align-top">
                          <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                            {service.kind ?? "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3 align-top font-mono text-xs text-brand-800">
                          {formatPrice(service.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <a
                href="https://business.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-brand-200 bg-white text-xs font-semibold text-brand-800 hover:bg-brand-50 shadow-2xs transition"
              >
                <GoogleGLogo size={14} />
                <span>Edit services on Google</span>
                <ExternalLink size={12} className="text-brand-400" />
              </a>
            </div>
          </div>
        )
      }
    </GbpTabGate>
  );
}
