"use client";

import React from "react";
import { Image as ImageIcon, ExternalLink, Eye } from "lucide-react";
import { GoogleGLogo } from "../gbp-icons";
import { GbpSourceNotice, GbpTabGate, formatGbpTimestamp } from "../gbp-states";
import { useGbpPhotos } from "@/hooks/use-growthx";

interface PhotosTabProps {
  projectId: string | null;
  onConnect?: () => void;
  onChooseLocation?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

/**
 * The media Google holds for this location.
 *
 * Photos come from the legacy v4 API, which many Cloud projects are simply not
 * approved for — so an empty grid here is far more often a refusal than an
 * empty profile, and the two are never rendered the same way.
 */
export function PhotosTab({
  projectId,
  onConnect,
  onChooseLocation,
  onSync,
  isSyncing,
}: PhotosTabProps) {
  const query = useGbpPhotos(projectId);

  return (
    <GbpTabGate
      query={query}
      label="Photos"
      onConnect={onConnect}
      onChooseLocation={onChooseLocation}
      onSync={onSync}
      isSyncing={isSyncing}
    >
      {(data) =>
        data.photos.length === 0 ? (
          <GbpSourceNotice
            source={data.source}
            label="Photos"
            onSync={onSync}
            isSyncing={isSyncing}
            emptyTitle="No photos on this profile yet"
            emptyBody={
              <>
                Google returned this location&apos;s media and there are none. Photos are one of the few
                things a merchant controls entirely, and listings with them are opened far more often
                than listings without.
              </>
            }
          />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={15} className="text-blue-600" />
                <h3 className="text-sm font-bold text-brand-950">
                  {data.photos.length} photo{data.photos.length === 1 ? "" : "s"} on this profile
                </h3>
              </div>
              <a
                href="https://business.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-brand-200 bg-white text-xs font-semibold text-brand-800 hover:bg-brand-50 shadow-2xs transition"
              >
                <GoogleGLogo size={14} />
                <span>Manage photos on Google</span>
                <ExternalLink size={12} className="text-brand-400" />
              </a>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.photos.map((photo) => (
                <div
                  key={photo.id}
                  className="rounded-2xl border bg-white shadow-xs overflow-hidden flex flex-col"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <div className="aspect-4/3 bg-brand-50 flex items-center justify-center overflow-hidden">
                    {photo.thumbnailUrl || photo.url ? (
                      /* Google's media host is not in the Next image allowlist, and
                         these URLs are per-merchant and short-lived. */
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={photo.thumbnailUrl ?? photo.url ?? ""}
                        alt={photo.description ?? "Business Profile photo"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ImageIcon size={22} className="text-brand-300" />
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 truncate">
                        {photo.category ?? "Uncategorised"}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[10px] text-brand-500 shrink-0">
                        <Eye size={10} className="text-brand-400" />
                        {/* Null means Google did not report a view count, which
                            is not the same as nobody having looked. */}
                        {photo.viewCount == null ? "—" : photo.viewCount.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[10px] text-brand-400">
                      {formatGbpTimestamp(photo.createTime) ?? "No date from Google"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      }
    </GbpTabGate>
  );
}
