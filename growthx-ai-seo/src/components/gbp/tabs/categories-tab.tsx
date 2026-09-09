"use client";

import React from "react";
import { Tag, ExternalLink } from "lucide-react";
import { GoogleGLogo } from "../gbp-icons";
import { GbpSourceNotice, GbpTabGate } from "../gbp-states";
import { useGbpCategories } from "@/hooks/use-growthx";

interface CategoriesTabProps {
  projectId: string | null;
  onConnect?: () => void;
  onChooseLocation?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

/**
 * The categories Google holds for this location — primary and additional.
 *
 * Categories arrive on the location resource, so their availability is the
 * profile source's: when the profile could not be read there is nothing to show
 * and nothing to infer.
 */
export function CategoriesTab({
  projectId,
  onConnect,
  onChooseLocation,
  onSync,
  isSyncing,
}: CategoriesTabProps) {
  const query = useGbpCategories(projectId);

  return (
    <GbpTabGate
      query={query}
      label="Categories"
      onConnect={onConnect}
      onChooseLocation={onChooseLocation}
      onSync={onSync}
      isSyncing={isSyncing}
    >
      {(data) =>
        !data.primary && data.additional.length === 0 ? (
          <GbpSourceNotice
            source={data.source}
            label="Categories"
            onSync={onSync}
            isSyncing={isSyncing}
            emptyTitle="No categories on this profile"
            emptyBody={
              <>
                Google returned this location&apos;s profile and it carries no category at all. A
                primary category is what decides which searches this business is eligible for, so
                setting one on Google is the single highest-value change available here.
              </>
            }
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div
                className="rounded-2xl border bg-white p-5 shadow-xs"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
                  <Tag size={14} className="text-blue-600" />
                  <span>Primary category</span>
                </div>
                <p className="mt-2 text-lg font-bold text-brand-950 leading-snug">
                  {data.primary?.displayName ?? "—"}
                </p>
                <p className="mt-1 text-[11px] font-mono text-brand-400 truncate">
                  {data.primary?.categoryId ?? "No category id returned"}
                </p>
                <p className="mt-3 text-[11px] text-brand-400 leading-relaxed">
                  Google matches this location to searches primarily through this category.
                </p>
              </div>

              <div
                className="lg:col-span-2 rounded-2xl border bg-white p-5 shadow-xs"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-brand-950">Additional categories</h3>
                  <span className="font-mono text-xs font-bold text-brand-600">
                    {data.additional.length}
                  </span>
                </div>

                {data.additional.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.additional.map((category, index) => (
                      <span
                        key={category.categoryId ?? `${category.displayName}-${index}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800"
                      >
                        <Tag size={11} className="text-brand-400" />
                        {category.displayName ?? category.categoryId ?? "Unnamed category"}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-brand-500 leading-relaxed">
                    Google returned no additional categories for this location. Additional categories
                    are optional; they widen the searches a listing can appear in.
                  </p>
                )}
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
                <span>Edit categories on Google</span>
                <ExternalLink size={12} className="text-brand-400" />
              </a>
            </div>
          </div>
        )
      }
    </GbpTabGate>
  );
}
