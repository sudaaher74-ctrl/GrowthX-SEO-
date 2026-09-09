"use client";

import React, { useState } from "react";
import {
  Star,
  RefreshCw,
  Search,
  Sparkles,
  Send,
  CheckCircle2,
  Filter,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  useLocalReviews,
  useSyncLocalReviews,
  useDraftReviewReply,
  usePublishReviewReply,
} from "@/hooks/use-growthx";
import type { LocalReview, LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ReviewsTabProps {
  localSeo: LocalSeoData | null | undefined;
  projectId: string | null;
}

export function ReviewsTab({ localSeo, projectId }: ReviewsTabProps) {
  const { data: reviews = [], isLoading, refetch } = useLocalReviews(projectId);
  const syncMutation = useSyncLocalReviews(projectId);
  const draftMutation = useDraftReviewReply(projectId);
  const publishMutation = usePublishReviewReply(projectId);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRating, setSelectedRating] = useState<number | "ALL">("ALL");
  const [filterReplied, setFilterReplied] = useState<"ALL" | "PENDING" | "PUBLISHED">("ALL");
  const [activeTone, setActiveTone] = useState<"PROFESSIONAL" | "WARM" | "DE_ESCALATION">("PROFESSIONAL");
  const [editingReply, setEditingReply] = useState<{ [reviewId: string]: string }>({});

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: () => refetch(),
    });
  };

  const handleDraft = (reviewId: string) => {
    draftMutation.mutate(
      { reviewId, tone: activeTone },
      {
        onSuccess: (data) => {
          if (data.aiDraftedReply) {
            setEditingReply((prev) => ({ ...prev, [reviewId]: data.aiDraftedReply || "" }));
          }
        },
      }
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
      }
    );
  };

  // Filter reviews
  const filteredReviews = reviews.filter((r) => {
    if (selectedRating !== "ALL" && r.rating !== selectedRating) return false;
    if (filterReplied !== "ALL" && r.replyStatus !== filterReplied) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchAuthor = r.authorName.toLowerCase().includes(q);
      const matchText = (r.text || "").toLowerCase().includes(q);
      if (!matchAuthor && !matchText) return false;
    }
    return true;
  });

  const totalReviewsCount = reviews.length > 0 ? reviews.length : (localSeo?.reviewCount ?? 0);
  const avgRating = localSeo?.rating && localSeo.rating > 0 ? localSeo.rating.toFixed(1) : "—";
  const publishedReplies = reviews.filter((r) => r.replyStatus === "PUBLISHED").length;
  const responseRate = reviews.length > 0 ? Math.round((publishedReplies / reviews.length) * 100) : 100;

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
            <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">{avgRating}</span>
            <span className="text-xs text-brand-400">/ 5.0</span>
          </div>
          <p className="text-[11px] text-brand-400 mt-0.5">Across verified Google reviews</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
            <MessageSquare size={14} className="text-blue-600" />
            <span>Total Reviews</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
              {totalReviewsCount || "—"}
            </span>
          </div>
          <p className="text-[11px] text-brand-400 mt-0.5">Google Maps feedback volume</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Response Rate</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-brand-950">
              {reviews.length > 0 ? `${responseRate}%` : "—"}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 rounded">Target 95%+</span>
          </div>
          <p className="text-[11px] text-brand-400 mt-0.5">High reply rate boosts rankings</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
            <Sparkles size={14} className="text-purple-600" />
            <span>AI Review Responder</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm font-bold text-brand-950">Active & Automated</span>
          </div>
          <p className="text-[11px] text-brand-400 mt-0.5">Instant personalized reply drafts</p>
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

          <button
            type="button"
            onClick={handleSync}
            disabled={syncMutation.isPending}
            className="h-9 px-3.5 rounded-lg border border-brand-200 bg-white hover:bg-brand-50 text-brand-800 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncMutation.isPending ? "animate-spin" : ""} />
            <span>{syncMutation.isPending ? "Syncing..." : "Sync Reviews"}</span>
          </button>
        </div>
      </div>

      {/* ── Reviews Stream ─────────────────────────────────────────── */}
      <div className="space-y-4">
        {filteredReviews.length > 0 ? (
          filteredReviews.map((rev) => {
            const hasReply = rev.replyStatus === "PUBLISHED";
            const currentEdit = editingReply[rev.id] ?? rev.aiDraftedReply ?? "";

            return (
              <div
                key={rev.id}
                className="rounded-2xl border bg-white p-5 shadow-xs space-y-3 transition hover:border-brand-300"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-950 text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {rev.authorName.slice(0, 1)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-brand-950">{rev.authorName}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex text-amber-500">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={11}
                              className={i < rev.rating ? "fill-amber-500" : "text-brand-200"}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-brand-400">{rev.relativeTime}</span>
                      </div>
                    </div>
                  </div>

                  {hasReply ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 size={12} /> Replied & Synced
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      Awaiting Reply
                    </span>
                  )}
                </div>

                <p className="text-xs text-brand-800 leading-relaxed pt-1">
                  {rev.text || <span className="italic text-brand-400">Rating left without comment.</span>}
                </p>

                {/* Reply section */}
                <div className="pt-3 border-t border-brand-100 space-y-3">
                  {hasReply ? (
                    <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-200/60 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-brand-700">
                        <span>Your Public Google Reply</span>
                        <span className="text-emerald-700 font-medium">Published</span>
                      </div>
                      <p className="text-xs text-brand-800 leading-relaxed">{rev.aiDraftedReply}</p>
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
                                activeTone === tone ? "bg-purple-700 text-white" : "text-brand-600 hover:text-brand-950"
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
                          setEditingReply((prev) => ({ ...prev, [rev.id]: e.target.value }))
                        }
                        className="w-full p-2.5 text-xs rounded-lg border border-purple-200 bg-white focus:outline-none focus:ring-1 focus:ring-purple-700"
                      />

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleDraft(rev.id)}
                          disabled={draftMutation.isPending}
                          className="text-xs font-semibold text-purple-700 hover:text-purple-800 flex items-center gap-1 transition"
                        >
                          <Sparkles size={12} className={draftMutation.isPending ? "animate-spin" : ""} />
                          <span>{draftMutation.isPending ? "Generating draft…" : "Generate AI Draft"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePublish(rev.id)}
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
        ) : (
          <div className="rounded-2xl border bg-white p-12 text-center shadow-xs" style={{ borderColor: "var(--border-color)" }}>
            <MessageSquare size={32} className="mx-auto text-brand-300 mb-3" />
            <h3 className="text-sm font-bold text-brand-950">No Reviews Recorded Yet</h3>
            <p className="text-xs text-brand-500 mt-1 max-w-sm mx-auto">
              Sync reviews directly from your Google Business Profile to monitor ratings and draft instant replies.
            </p>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="mt-4 px-4 py-2 rounded-xl bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition"
            >
              Sync Reviews Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
