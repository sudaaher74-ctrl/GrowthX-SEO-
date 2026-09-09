"use client";

import React, { useState } from "react";
import {
  Star,
  Search,
  Sparkles,
  Send,
  CheckCircle2,
  MessageSquare,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { GbpSourceNotice, GbpTabGate, formatGbpTimestamp } from "../gbp-states";
import {
  useGbpReviews,
  useDraftGbpReviewReply,
  usePublishGbpReviewReply,
} from "@/hooks/use-growthx";
import type { GbpReviews } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ReviewsTabProps {
  projectId: string | null;
  onConnect?: () => void;
  onChooseLocation?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

export function ReviewsTab({
  projectId,
  onConnect,
  onChooseLocation,
  onSync,
  isSyncing,
}: ReviewsTabProps) {
  const query = useGbpReviews(projectId);

  return (
    <GbpTabGate
      query={query}
      label="Reviews"
      onConnect={onConnect}
      onChooseLocation={onChooseLocation}
      onSync={onSync}
      isSyncing={isSyncing}
    >
      {(data) =>
        data.reviews.length === 0 ? (
          <GbpSourceNotice
            source={data.source}
            label="Reviews"
            onSync={onSync}
            isSyncing={isSyncing}
            emptyTitle="No reviews on this profile yet"
            emptyBody={
              <>
                Google returned this location&apos;s reviews and there are none. Nothing here is
                missing — this listing simply has not been reviewed.
              </>
            }
          />
        ) : (
          <ReviewsContent data={data} projectId={projectId} />
        )
      }
    </GbpTabGate>
  );
}

function ReviewsContent({ data, projectId }: { data: GbpReviews; projectId: string | null }) {
  const draftMutation = useDraftGbpReviewReply(projectId);
  const publishMutation = usePublishGbpReviewReply(projectId);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRating, setSelectedRating] = useState<number | "ALL">("ALL");
  const [filterReplied, setFilterReplied] = useState<"ALL" | "PENDING" | "PUBLISHED">("ALL");
  const [activeTone, setActiveTone] = useState<"PROFESSIONAL" | "WARM" | "DE_ESCALATION">(
    "PROFESSIONAL",
  );
  const [editingReply, setEditingReply] = useState<{ [reviewId: string]: string }>({});

  const handleDraft = (reviewId: string) => {
    draftMutation.mutate(
      { reviewId, tone: activeTone },
      {
        onSuccess: (result) => {
          if (result.aiDraftedReply) {
            setEditingReply((prev) => ({ ...prev, [reviewId]: result.aiDraftedReply ?? "" }));
          }
        },
      },
    );
  };

  const handlePublish = (reviewId: string) => {
    const textToPublish = editingReply[reviewId];
    if (!textToPublish || !textToPublish.trim()) return;

    publishMutation.mutate(
      { reviewId, replyText: textToPublish.trim() },
      {
        onSuccess: () => {
          setEditingReply((prev) => {
            const next = { ...prev };
            delete next[reviewId];
            return next;
          });
        },
      },
    );
  };

  const filteredReviews = data.reviews.filter((review) => {
    if (selectedRating !== "ALL" && review.rating !== selectedRating) return false;
    if (filterReplied !== "ALL" && review.replyStatus !== filterReplied) return false;
    if (searchQuery.trim()) {
      const needle = searchQuery.toLowerCase();
      const matchAuthor = review.authorName.toLowerCase().includes(needle);
      const matchText = (review.text ?? "").toLowerCase().includes(needle);
      if (!matchAuthor && !matchText) return false;
    }
    return true;
  });

  // A reply counts as answered when Google itself holds one, or when GrowthX
  // published one. Both are facts about the profile; a local draft is not.
  const answered = data.reviews.filter(
    (review) => Boolean(review.googleReply) || review.replyStatus === "PUBLISHED",
  ).length;
  const responseRate = data.reviews.length > 0
    ? Math.round((answered / data.reviews.length) * 100)
    : null;
  const awaitingReply = data.reviews.length - answered;

  return (
    <div className="space-y-6">
      {/* ── Top Row: Review Metrics ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
            <Star size={14} className="text-amber-500 fill-amber-500" />
            <span>Average Rating</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
              {/* Averaged only over the reviews Google gave a rating for. */}
              {data.summary.averageRating == null ? "—" : data.summary.averageRating.toFixed(1)}
            </span>
            <span className="text-xs text-brand-400">/ 5.0</span>
          </div>
          <p className="text-[11px] text-brand-400 mt-0.5">
            Across {data.summary.rated} rated review{data.summary.rated === 1 ? "" : "s"}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
            <MessageSquare size={14} className="text-blue-600" />
            <span>Total Reviews</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
              {data.summary.total}
            </span>
          </div>
          <p className="text-[11px] text-brand-400 mt-0.5">Synced from Google Business Profile</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Replied</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
              {responseRate == null ? "—" : `${responseRate}%`}
            </span>
          </div>
          <p className="text-[11px] text-brand-400 mt-0.5">
            {answered} of {data.reviews.length} carry a reply
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
            <Clock size={14} className="text-purple-600" />
            <span>Awaiting Reply</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
              {awaitingReply}
            </span>
          </div>
          <p className="text-[11px] text-brand-400 mt-0.5">Draft a response below</p>
        </div>
      </div>

      {/* ── Filter Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border shadow-xs" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input
              type="text"
              placeholder="Search reviews by keyword or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={selectedRating}
            onChange={(e) => setSelectedRating(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
            className="h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-700 focus:outline-none"
          >
            <option value="ALL">All Ratings</option>
            <option value={5}>5 Stars ★★★★★</option>
            <option value={4}>4 Stars ★★★★</option>
            <option value={3}>3 Stars ★★★</option>
            <option value={2}>2 Stars ★★</option>
            <option value={1}>1 Star ★</option>
          </select>

          <select
            value={filterReplied}
            onChange={(e) => setFilterReplied(e.target.value as "ALL" | "PENDING" | "PUBLISHED")}
            className="h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Needs Reply</option>
            <option value="PUBLISHED">Replied</option>
          </select>
        </div>
      </div>

      {/* ── Reviews Stream ─────────────────────────────────────────── */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="rounded-2xl border bg-white p-12 text-center shadow-xs" style={{ borderColor: "var(--border-color)" }}>
            <MessageSquare size={32} className="mx-auto text-brand-300 mb-3" />
            <h3 className="text-sm font-bold text-brand-950">No reviews match these filters</h3>
            <p className="text-xs text-brand-500 mt-1">
              {data.reviews.length} synced review{data.reviews.length === 1 ? "" : "s"} are hidden by
              the current search and filters.
            </p>
          </div>
        ) : (
          filteredReviews.map((review) => {
            const publishedReply = review.googleReply ?? null;
            const hasReply = Boolean(publishedReply) || review.replyStatus === "PUBLISHED";
            const currentEdit = editingReply[review.id] ?? review.aiDraftedReply ?? "";

            return (
              <div
                key={review.id}
                className="rounded-2xl border bg-white p-5 shadow-xs space-y-3 transition hover:border-brand-300"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-950 text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {review.authorName.slice(0, 1)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-brand-950">{review.authorName}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        {review.rating == null ? (
                          // Google did not state a rating for this review, so
                          // no stars are drawn — five empty ones would read as
                          // a one-star review.
                          <span className="text-[11px] font-medium text-brand-400">
                            No rating from Google
                          </span>
                        ) : (
                          <div className="flex text-amber-500">
                            {[...Array(5)].map((_, index) => (
                              <Star
                                key={index}
                                size={11}
                                className={index < review.rating! ? "fill-amber-500" : "text-brand-200"}
                              />
                            ))}
                          </div>
                        )}
                        <span className="text-[11px] text-brand-400">
                          {formatGbpTimestamp(review.updateTime ?? review.createTime) ?? "No date from Google"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {hasReply ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 size={12} /> Replied
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      Awaiting Reply
                    </span>
                  )}
                </div>

                <p className="text-xs text-brand-800 leading-relaxed pt-1">
                  {review.text || <span className="italic text-brand-400">Rating left without comment.</span>}
                </p>

                {/* Reply section */}
                <div className="pt-3 border-t border-brand-100 space-y-3">
                  {hasReply ? (
                    <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-200/60 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-brand-700">
                        <span>Your Public Google Reply</span>
                        <span className="text-brand-400 font-medium">
                          {formatGbpTimestamp(review.googleReplyUpdatedAt) ?? "Published"}
                        </span>
                      </div>
                      <p className="text-xs text-brand-800 leading-relaxed">
                        {publishedReply ?? (
                          <span className="italic text-brand-400">
                            Published from GrowthX; Google has not returned the text yet.
                          </span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-purple-50/40 border border-purple-200/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                          <Sparkles size={13} className="text-purple-600" />
                          <span>AI Smart Reply</span>
                        </div>

                        {/* Tone Switcher */}
                        <div className="flex rounded-md bg-white border border-purple-200 p-0.5 text-[10px] font-semibold">
                          {(["PROFESSIONAL", "WARM", "DE_ESCALATION"] as const).map((tone) => (
                            <button
                              key={tone}
                              type="button"
                              onClick={() => setActiveTone(tone)}
                              className={cn(
                                "px-2 py-0.5 rounded transition",
                                activeTone === tone ? "bg-purple-700 text-white" : "text-brand-600 hover:text-brand-950",
                              )}
                            >
                              {tone === "PROFESSIONAL" ? "Professional" : tone === "WARM" ? "Warm" : "De-escalate"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Click 'Generate AI Draft' to create a customized response..."
                        value={currentEdit}
                        onChange={(e) =>
                          setEditingReply((prev) => ({ ...prev, [review.id]: e.target.value }))
                        }
                        className="w-full p-2.5 text-xs rounded-lg border border-purple-200 bg-white focus:outline-none focus:ring-1 focus:ring-purple-700"
                      />

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleDraft(review.id)}
                          disabled={draftMutation.isPending}
                          className="text-xs font-semibold text-purple-700 hover:text-purple-800 flex items-center gap-1 transition"
                        >
                          <Sparkles size={12} className={draftMutation.isPending ? "animate-spin" : ""} />
                          <span>{draftMutation.isPending ? "Generating draft…" : "Generate AI Draft"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePublish(review.id)}
                          disabled={publishMutation.isPending || !currentEdit.trim()}
                          className="px-3 py-1.5 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 transition disabled:opacity-40"
                        >
                          <Send size={12} />
                          <span>{publishMutation.isPending ? "Publishing…" : "Publish Reply to Google"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
