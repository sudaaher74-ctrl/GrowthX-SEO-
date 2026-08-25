import { useState } from "react";
import { Panel, ActionButton } from "@/components/ui/console";
import { Star, Loader2, Sparkles, Send, CheckCircle2 } from "lucide-react";
import { useLocalReviews, useSyncLocalReviews, useDraftReviewReply, usePublishReviewReply } from "@/hooks/use-growthx";
import type { LocalReview } from "@/lib/api-client";

function ReviewItem({ review, projectId }: { review: LocalReview, projectId: string }) {
  const [editingReply, setEditingReply] = useState<string | null>(null);
  
  const draftMutation = useDraftReviewReply(projectId);
  const publishMutation = usePublishReviewReply(projectId);

  const handleDraft = () => {
    draftMutation.mutate(review.id);
  };

  const handlePublish = () => {
    const textToPublish = editingReply !== null ? editingReply : (review.aiDraftedReply || "");
    if (!textToPublish.trim()) return;
    
    publishMutation.mutate({ reviewId: review.id, replyText: textToPublish }, {
      onSuccess: () => setEditingReply(null)
    });
  };

  return (
    <div className="p-4 border border-brand-200 rounded-lg bg-brand-50/30">
      <div className="flex justify-between items-start mb-2">
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
        {review.replyStatus === 'PUBLISHED' && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
            <CheckCircle2 size={12} /> Replied
          </span>
        )}
      </div>
      
      <p className="text-sm text-brand-900 mt-3">{review.text || <span className="italic text-brand-400">No review text provided.</span>}</p>

      {/* Reply Section */}
      <div className="mt-4 pt-4 border-t border-brand-200 border-dashed">
        {review.replyStatus === 'PUBLISHED' ? (
          <div className="bg-brand-100/50 p-3 rounded-md">
            <p className="text-xs font-semibold text-brand-500 mb-1">Your Reply</p>
            <p className="text-sm text-brand-800">{review.aiDraftedReply}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {review.aiDraftedReply || editingReply !== null ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-brand-500 flex items-center gap-1">
                  <Sparkles size={12} className="text-accent-500" /> AI Drafted Reply
                </label>
                <textarea
                  className="w-full text-sm p-3 rounded-md border border-accent-200 bg-accent-50/30 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  rows={4}
                  value={editingReply !== null ? editingReply : (review.aiDraftedReply || "")}
                  onChange={(e) => setEditingReply(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <ActionButton 
                    variant="primary" 
                    icon={publishMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    onClick={handlePublish}
                    disabled={publishMutation.isPending}
                  >
                    Publish Reply
                  </ActionButton>
                </div>
              </div>
            ) : (
              <ActionButton 
                variant="secondary" 
                icon={draftMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                onClick={handleDraft}
                disabled={draftMutation.isPending}
              >
                {draftMutation.isPending ? "Drafting..." : "Draft AI Reply"}
              </ActionButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReviewsPanel({ projectId }: { projectId: string | null }) {
  const { data: reviews, isLoading } = useLocalReviews(projectId);
  const syncMutation = useSyncLocalReviews(projectId);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 size={32} className="text-brand-200 mb-4 animate-spin" />
        <p className="text-sm text-[var(--text-muted)]">Loading reviews...</p>
      </div>
    );
  }

  return (
    <Panel 
      title="Review Management" 
      subtitle="View and reply to your Google reviews"
      actions={
        <ActionButton 
          variant="secondary" 
          icon={syncMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} />}
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? "Syncing..." : "Sync Reviews"}
        </ActionButton>
      }
    >
      <div className="p-4 space-y-4">
        {!reviews || reviews.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-brand-500">No reviews found. Click 'Sync Reviews' to fetch recent reviews.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewItem key={review.id} review={review} projectId={projectId!} />
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
