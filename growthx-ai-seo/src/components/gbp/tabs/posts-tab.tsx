"use client";

import React, { useState } from "react";
import {
  Megaphone,
  Plus,
  Sparkles,
  Calendar,
  Send,
  Eye,
  MousePointer,
  CheckCircle2,
  Clock,
  Tag,
} from "lucide-react";
import type { LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface PostsTabProps {
  localSeo: LocalSeoData | null | undefined;
}

interface GbpPost {
  id: string;
  type: "UPDATE" | "OFFER" | "EVENT";
  content: string;
  ctaText: string;
  ctaUrl: string;
  publishedDate: string;
  views: number;
  clicks: number;
  status: "LIVE" | "EXPIRED";
}

export function PostsTab({ localSeo }: PostsTabProps) {
  const [posts, setPosts] = useState<GbpPost[]>([
    {
      id: "1",
      type: "UPDATE",
      content:
        "We are excited to introduce our new laser whitening technology! Experience gentle, painless results in under 45 minutes.",
      ctaText: "Book Appointment",
      ctaUrl: "https://example.com/book",
      publishedDate: "3 days ago",
      views: 342,
      clicks: 28,
      status: "LIVE",
    },
    {
      id: "2",
      type: "OFFER",
      content:
        "Spring Smile Special: 20% off all cosmetic consultations throughout this month. Mention code SPRING20 at front desk.",
      ctaText: "Claim Offer",
      ctaUrl: "https://example.com/offer",
      publishedDate: "2 weeks ago",
      views: 890,
      clicks: 94,
      status: "LIVE",
    },
  ]);

  const [isCreating, setIsCreating] = useState(false);
  const [postType, setPostType] = useState<"UPDATE" | "OFFER" | "EVENT">("UPDATE");
  const [content, setContent] = useState("");
  const [ctaText, setCtaText] = useState("Learn More");
  const [ctaUrl, setCtaUrl] = useState("");
  const [isAiDrafting, setIsAiDrafting] = useState(false);

  const handleAiDraft = () => {
    setIsAiDrafting(true);
    setTimeout(() => {
      setContent(
        `Looking for trusted local care in ${localSeo?.businessName ? localSeo.businessName : "our neighborhood"}? Our experienced team is ready to welcome you with flexible scheduling, cutting-edge equipment, and transparent pricing. Tap below to reserve your slot today!`
      );
      setIsAiDrafting(false);
    }, 500);
  };

  const handlePublishPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const newPost: GbpPost = {
      id: String(Date.now()),
      type: postType,
      content: content.trim(),
      ctaText,
      ctaUrl: ctaUrl || "https://example.com",
      publishedDate: "Just now",
      views: 1,
      clicks: 0,
      status: "LIVE",
    };

    setPosts([newPost, ...posts]);
    setContent("");
    setCtaUrl("");
    setIsCreating(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border shadow-xs" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <h2 className="text-sm font-bold text-brand-950">Google Business Updates & Posts</h2>
          <p className="text-xs text-brand-500">
            Publish weekly announcements, limited-time offers, and events to signal active business presence to Google&apos;s local algorithm.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition shadow-xs"
        >
          <Plus size={13} />
          <span>Create New Post</span>
        </button>
      </div>

      {/* Post Composer */}
      {isCreating && (
        <form onSubmit={handlePublishPost} className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <Megaphone size={13} />
              <span>Compose Google Update</span>
            </h3>

            {/* Post Type Selector */}
            <div className="flex rounded-lg bg-white border border-blue-200 p-0.5 text-xs font-semibold">
              {(["UPDATE", "OFFER", "EVENT"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPostType(t)}
                  className={cn(
                    "px-3 py-1 rounded transition",
                    postType === t ? "bg-blue-600 text-white" : "text-brand-600 hover:text-brand-950"
                  )}
                >
                  {t === "UPDATE" ? "What's New" : t === "OFFER" ? "Special Offer" : "Event"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-brand-800">Post Copy (up to 1,500 characters)</label>
              <button
                type="button"
                onClick={handleAiDraft}
                disabled={isAiDrafting}
                className="text-[11px] font-semibold text-purple-700 hover:text-purple-800 flex items-center gap-1"
              >
                <Sparkles size={12} className={isAiDrafting ? "animate-spin" : ""} />
                <span>{isAiDrafting ? "Drafting with AI…" : "Draft with AI"}</span>
              </button>
            </div>
            <textarea
              rows={3}
              required
              placeholder="Share news, health tips, service highlights, or updates with customers on Google Maps..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-brand-800 mb-1">Call to Action Button</label>
              <select
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-800 focus:outline-none"
              >
                <option value="Book Appointment">Book Appointment</option>
                <option value="Learn More">Learn More</option>
                <option value="Order Online">Order Online</option>
                <option value="Call Now">Call Now</option>
                <option value="Sign Up">Sign Up</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-800 mb-1">Destination URL</label>
              <input
                type="url"
                placeholder="https://example.com/target-page"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 rounded-lg border border-brand-200 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition flex items-center gap-1.5"
            >
              <Send size={12} />
              <span>Publish to Google Profile</span>
            </button>
          </div>
        </form>
      )}

      {/* Published Posts Stream */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500">
          Published Updates & Performance
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded-2xl border bg-white p-5 shadow-xs space-y-3 flex flex-col justify-between"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {post.type}
                  </span>
                  <span className="text-[11px] text-brand-400">{post.publishedDate}</span>
                </div>

                <p className="text-xs text-brand-800 leading-relaxed">{post.content}</p>
              </div>

              <div className="pt-3 border-t border-brand-100 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-brand-600 font-mono">
                  <span className="flex items-center gap-1">
                    <Eye size={13} className="text-brand-400" />
                    {post.views} views
                  </span>
                  <span className="flex items-center gap-1">
                    <MousePointer size={13} className="text-brand-400" />
                    {post.clicks} clicks
                  </span>
                </div>

                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                  {post.ctaText}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
