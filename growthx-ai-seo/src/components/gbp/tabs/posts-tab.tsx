"use client";

import React from "react";
import { Megaphone, ExternalLink, CalendarDays } from "lucide-react";
import { GoogleGLogo } from "../gbp-icons";
import { GbpSourceNotice, GbpTabGate, formatGbpTimestamp } from "../gbp-states";
import { useGbpPosts } from "@/hooks/use-growthx";

interface PostsTabProps {
  projectId: string | null;
  onConnect?: () => void;
  onChooseLocation?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

/**
 * Google posts for this location.
 *
 * Posts, like reviews and photos, live only on the legacy v4 API, so a refusal
 * is a routine answer here and is reported as one rather than as no posts.
 */
export function PostsTab({
  projectId,
  onConnect,
  onChooseLocation,
  onSync,
  isSyncing,
}: PostsTabProps) {
  const query = useGbpPosts(projectId);

  return (
    <GbpTabGate
      query={query}
      label="Posts"
      onConnect={onConnect}
      onChooseLocation={onChooseLocation}
      onSync={onSync}
      isSyncing={isSyncing}
    >
      {(data) =>
        data.posts.length === 0 ? (
          <GbpSourceNotice
            source={data.source}
            label="Posts"
            onSync={onSync}
            isSyncing={isSyncing}
            emptyTitle="No posts on this profile yet"
            emptyBody={
              <>
                Google returned this location&apos;s posts and there are none. Posts appear directly on
                the listing in Search and Maps, so an empty feed is visible to anyone who looks the
                business up.
              </>
            }
          />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone size={15} className="text-blue-600" />
                <h3 className="text-sm font-bold text-brand-950">
                  {data.posts.length} post{data.posts.length === 1 ? "" : "s"} on this profile
                </h3>
              </div>
              <a
                href="https://business.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-brand-200 bg-white text-xs font-semibold text-brand-800 hover:bg-brand-50 shadow-2xs transition"
              >
                <GoogleGLogo size={14} />
                <span>Manage posts on Google</span>
                <ExternalLink size={12} className="text-brand-400" />
              </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.posts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-2xl border bg-white p-5 shadow-xs space-y-3"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 shrink-0">
                        {post.topicType ?? "Post"}
                      </span>
                      <span className="text-[11px] font-semibold text-brand-500 truncate">
                        {post.state ?? "State not reported"}
                      </span>
                    </div>
                    <span className="text-[10px] text-brand-400 shrink-0">
                      {formatGbpTimestamp(post.createTime) ?? "No date from Google"}
                    </span>
                  </div>

                  <p className="text-xs text-brand-800 leading-relaxed">
                    {post.summary ?? (
                      <span className="italic text-brand-400">This post has no text.</span>
                    )}
                  </p>

                  {post.event && (
                    <div className="flex items-center gap-1.5 text-[11px] text-brand-600">
                      <CalendarDays size={12} className="text-brand-400" />
                      <span>
                        {post.event.title ?? "Event"}
                        {post.event.start ? ` · ${post.event.start}` : ""}
                        {post.event.end ? ` – ${post.event.end}` : ""}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    {post.callToAction?.url && (
                      <a
                        href={post.callToAction.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                      >
                        {post.callToAction.type ?? "Call to action"}
                        <ExternalLink size={11} />
                      </a>
                    )}
                    {post.searchUrl && (
                      <a
                        href={post.searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-brand-500 hover:text-brand-800 inline-flex items-center gap-1"
                      >
                        View on Google
                        <ExternalLink size={11} />
                      </a>
                    )}
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
