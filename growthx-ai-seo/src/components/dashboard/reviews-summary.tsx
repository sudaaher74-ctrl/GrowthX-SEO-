import React from "react";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { relativeTime } from "@/components/ui/console";

export function ReviewsSummary({
  businessName,
  rating,
  reviewCount,
  updatedAt,
}: {
  businessName: string;
  rating: number;
  reviewCount: number;
  updatedAt?: string | null;
}) {
  if (reviewCount === 0) {
    return (
      <div className="space-y-2">
        <p className="text-[12.5px] font-semibold text-brand-950">{businessName}</p>
        <p className="text-[16px] font-bold text-brand-950">No reviews yet</p>
        <p className="text-[11.5px] text-brand-500">
          Reviews help new customers trust you. Ask happy customers to leave one on Google.
        </p>
        <Link
          href="/google-business-profile"
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-700 hover:underline"
        >
          Get more reviews <ArrowRight size={11} />
        </Link>
      </div>
    );
  }

  const rounded = Math.round(rating);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
      <div>
        <p className="text-[12.5px] font-semibold text-brand-950">{businessName}</p>
        <div className="mt-0.5 flex items-center gap-2.5">
          <span className="text-[24px] sm:text-[26px] font-bold leading-none tracking-tight text-brand-950">{rating.toFixed(1)}</span>
          <div>
            <div className="flex gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={13}
                  className={n <= rounded ? "fill-warning-400 text-warning-400" : "text-brand-300"}
                />
              ))}
            </div>
            <p className="mt-0.5 text-[11px] text-brand-400">
              from {reviewCount.toLocaleString()} {reviewCount === 1 ? "review" : "reviews"}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        {updatedAt && <p className="text-[10.5px] text-brand-400">Updated {relativeTime(updatedAt)}</p>}
        <Link
          href="/google-business-profile"
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-700 hover:underline"
        >
          See your reviews <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}
