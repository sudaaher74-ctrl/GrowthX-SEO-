import { useState } from "react";
import { Panel, ActionButton } from "@/components/ui/console";
import {
  Star,
  Loader2,
  Sparkles,
  Send,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Heart,
  ShieldCheck,
  Briefcase,
  Share2,
} from "lucide-react";
import { useLocalReviews, useSyncLocalReviews, useDraftReviewReply, usePublishReviewReply } from "@/hooks/use-growthx";
import type { LocalReview } from "@/lib/api-client";

export type ReplyTone = "PROFESSIONAL" | "WARM" | "DE_ESCALATION";

function ReviewItem({
  review,
  projectId,
  selectedTone,
}: {
  review: LocalReview;
  projectId: string;
  selectedTone: ReplyTone;
}) {
  const [editingReply, setEditingReply] = useState<string | null>(null);

  const draftMutation = useDraftReviewReply(projectId);
  const publishMutation = usePublishReviewReply(projectId);

  const handleDraft = () => {
    draftMutation.mutate({ reviewId: review.id, tone: selectedTone });
  };

  const handlePublish = () => {
    const textToPublish = editingReply !== null ? editingReply : (review.aiDraftedReply || "");
    if (!textToPublish.trim()) return;

    publishMutation.mutate(
      { reviewId: review.id, replyText: textToPublish },
      {
        onSuccess: () => setEditingReply(null),
      }
    );
  };

  return (
    <div className="p-4 border border-brand-200 rounded-xl bg-brand-50/30 space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-200 rounded-full flex items-center justify-center text-brand-950 font-bold">
            {review.authorName.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-brand-950">{review.authorName}</p>
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={12}
                    className={i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-brand-200"}
                  />
                ))}
              </div>
              <span className="text-xs text-[var(--text-muted)]">{review.relativeTime}</span>
            </div>
          </div>
        </div>
        {review.replyStatus === "PUBLISHED" && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 size={12} /> Replied & Synced
          </span>
        )}
      </div>

      <p className="text-sm text-brand-900 leading-relaxed">
        {review.text || <span className="italic text-brand-400">No written text provided with this rating.</span>}
      </p>

      {/* Reply Section */}
      <div className="pt-3 border-t border-brand-200 border-dashed">
        {review.replyStatus === "PUBLISHED" ? (
          <div className="bg-brand-100/60 p-3.5 rounded-lg border border-brand-200/70">
            <p className="text-xs font-semibold text-brand-600 mb-1">Your Published Google Reply</p>
            <p className="text-sm text-brand-900 leading-relaxed">{review.aiDraftedReply}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {review.aiDraftedReply || editingReply !== null ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-accent-700 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-accent-600" />
                    AI Drafted Reply ({selectedTone.toLowerCase()} tone)
                  </label>
                  <span className="text-[10px] text-brand-500">Edit text before publishing if desired</span>
                </div>
                <textarea
                  className="w-full text-sm p-3 rounded-lg border border-accent-300 bg-white focus:outline-none focus:ring-1 focus:ring-accent-500 shadow-sm"
                  rows={3}
                  value={editingReply !== null ? editingReply : (review.aiDraftedReply || "")}
                  onChange={(e) => setEditingReply(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleDraft}
                    disabled={draftMutation.isPending}
                    className="text-xs text-accent-700 hover:text-accent-800 font-medium flex items-center gap-1 disabled:opacity-50"
                  >
                    <Sparkles size={12} />
                    {draftMutation.isPending ? "Regenerating..." : "Regenerate with selected tone"}
                  </button>
                  <ActionButton
                    variant="primary"
                    icon={publishMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    onClick={handlePublish}
                    disabled={publishMutation.isPending}
                  >
                    {publishMutation.isPending ? "Publishing..." : "Publish to Google"}
                  </ActionButton>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <ActionButton
                  variant="secondary"
                  icon={draftMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  onClick={handleDraft}
                  disabled={draftMutation.isPending}
                >
                  {draftMutation.isPending ? "Drafting with AI..." : "Draft AI Reply"}
                </ActionButton>
                <span className="text-[11.5px] text-brand-500">
                  Using <span className="font-semibold text-brand-700 lowercase">{selectedTone}</span> tone
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReviewsPanel({
  projectId,
  businessName,
  placeId,
}: {
  projectId: string | null;
  businessName?: string;
  placeId?: string;
}) {
  const { data: reviews, isLoading } = useLocalReviews(projectId);
  const syncMutation = useSyncLocalReviews(projectId);

  const [selectedTone, setSelectedTone] = useState<ReplyTone>("PROFESSIONAL");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);

  // Generate official Google Review shortlink
  const directReviewLink = placeId
    ? `https://search.google.com/local/writereview?placeid=${placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessName || "My Business")}`;

  const smsTemplate = `Hi! Thank you for choosing ${
    businessName || "our business"
  }! If you had a great experience, could you take 30 seconds to leave us a quick review on Google? It means the world to our team: ${directReviewLink}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directReviewLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopySms = () => {
    navigator.clipboard.writeText(smsTemplate);
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 size={32} className="text-brand-200 mb-4 animate-spin" />
        <p className="text-sm text-[var(--text-muted)]">Loading verified Google reviews...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Review Acquisition Shortlink & QR Accelerator */}
      <Panel
        title="Direct Review Acquisition Link"
        subtitle="1-click Google review submission link to share with happy customers after service"
      >
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-8 space-y-2">
              <label className="block text-xs font-semibold text-brand-700">
                Official Google Review Direct Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={directReviewLink}
                  className="flex-1 h-9 rounded-md border border-brand-200 bg-brand-50/50 px-3 text-xs font-mono text-brand-800 select-all"
                />
                <ActionButton
                  variant="primary"
                  icon={copiedLink ? <Check size={12} className="text-white" /> : <Copy size={12} />}
                  onClick={handleCopyLink}
                >
                  {copiedLink ? "Copied!" : "Copy Link"}
                </ActionButton>
                <a
                  href={directReviewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-3 flex items-center justify-center rounded-md border border-brand-200 hover:bg-brand-50 text-brand-600"
                  title="Open Review Page"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
              <p className="text-[11.5px] text-brand-500">
                Directly opens the 5-star Google Maps review modal on mobile or desktop.
              </p>
            </div>

            <div className="md:col-span-4 p-3 bg-brand-50/60 rounded-xl border border-brand-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-950 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-accent-600" />
                  SMS Invite Template
                </span>
                <button
                  type="button"
                  onClick={handleCopySms}
                  className="text-[11px] text-accent-700 hover:text-accent-800 font-semibold flex items-center gap-1"
                >
                  {copiedSms ? <Check size={11} /> : <Copy size={11} />}
                  {copiedSms ? "Copied" : "Copy SMS"}
                </button>
              </div>
              <p className="text-[11px] text-brand-600 line-clamp-3 leading-relaxed">
                "{smsTemplate}"
              </p>
            </div>
          </div>
        </div>
      </Panel>

      {/* Review Management with Brand Tone Selection */}
      <Panel
        title="Google Reviews Management & AI Response Autopilot"
        subtitle="Monitor customer feedback and draft on-brand responses that boost local SEO visibility"
        actions={
          <ActionButton
            variant="secondary"
            icon={syncMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} />}
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? "Syncing..." : "Sync Latest Reviews"}
          </ActionButton>
        }
      >
        <div className="p-5 space-y-6">
          {/* Brand Voice / Tone Selector */}
          <div className="p-4 bg-brand-50/50 rounded-xl border border-brand-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700 flex items-center gap-1.5">
                <Sparkles size={14} className="text-accent-600" />
                Select AI Response Persona & Tone
              </span>
              <span className="text-[11px] text-brand-500">Applied when drafting replies</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedTone("PROFESSIONAL")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedTone === "PROFESSIONAL"
                    ? "bg-white border-accent-500 ring-2 ring-accent-500/20 shadow-sm"
                    : "bg-white/60 border-brand-200 hover:bg-white text-brand-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Briefcase size={14} className={selectedTone === "PROFESSIONAL" ? "text-accent-600" : "text-brand-500"} />
                  <span className="text-xs font-bold text-brand-950">Professional</span>
                </div>
                <p className="text-[11px] text-brand-500 leading-snug">
                  Polished, courteous, and authoritative business tone.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTone("WARM")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedTone === "WARM"
                    ? "bg-white border-accent-500 ring-2 ring-accent-500/20 shadow-sm"
                    : "bg-white/60 border-brand-200 hover:bg-white text-brand-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Heart size={14} className={selectedTone === "WARM" ? "text-rose-500" : "text-brand-500"} />
                  <span className="text-xs font-bold text-brand-950">Warm & Grateful</span>
                </div>
                <p className="text-[11px] text-brand-500 leading-snug">
                  Heartfelt, enthusiastic, community-focused connection.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTone("DE_ESCALATION")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedTone === "DE_ESCALATION"
                    ? "bg-white border-accent-500 ring-2 ring-accent-500/20 shadow-sm"
                    : "bg-white/60 border-brand-200 hover:bg-white text-brand-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck size={14} className={selectedTone === "DE_ESCALATION" ? "text-emerald-600" : "text-brand-500"} />
                  <span className="text-xs font-bold text-brand-950">Issue De-escalation</span>
                </div>
                <p className="text-[11px] text-brand-500 leading-snug">
                  Empathetic, reassuring, focused on offline resolution.
                </p>
              </button>
            </div>
          </div>

          {/* Reviews Stream */}
          {!reviews || reviews.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-brand-200 rounded-xl bg-brand-50/20">
              <MessageSquare size={24} className="mx-auto text-brand-300 mb-2" />
              <p className="text-xs font-semibold text-brand-700">No reviews found for this profile.</p>
              <p className="text-[11.5px] text-brand-500 mt-1 max-w-sm mx-auto">
                Click 'Sync Latest Reviews' above or send your direct review shortlink to recent customers.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-950">
                  Customer Reviews ({reviews.length})
                </span>
                <span className="text-[11px] text-brand-500">
                  {reviews.filter((r) => r.replyStatus === "PUBLISHED").length} of {reviews.length} replied
                </span>
              </div>
              <div className="space-y-3">
                {reviews.map((review) => (
                  <ReviewItem
                    key={review.id}
                    review={review}
                    projectId={projectId!}
                    selectedTone={selectedTone}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
