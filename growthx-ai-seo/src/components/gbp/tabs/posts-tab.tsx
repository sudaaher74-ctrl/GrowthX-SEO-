"use client";

import React, { useState } from "react";
import {
  FileText,
  Tag,
  Calendar,
  ShoppingBag,
  Sparkles,
  Plus,
  Send,
  Eye,
  MousePointer,
  Clock,
  Image as ImageIcon,
  Link as LinkIcon,
  MoreVertical,
  BarChart2,
  TrendingUp,
  ArrowRight,
  Check,
  Search,
  Filter,
  Grid,
  List,
} from "lucide-react";
import type { LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface PostsTabProps {
  localSeo: LocalSeoData | null | undefined;
}

type PostType = "What's new" | "Offer" | "Event" | "Product";

interface PostItem {
  id: string;
  type: PostType;
  title: string;
  snippet: string;
  date: string;
  views: number;
  clicks: number;
  badgeTone: "blue" | "green" | "purple";
  imageUrl?: string;
  fallbackInitial: string;
}

interface AiSuggestion {
  id: string;
  type: PostType;
  title: string;
  snippet: string;
  initials: string;
  color: string;
}

interface PerformanceDataPoint {
  date: string;
  views: number;
  clicks: number;
  viewsHeightPct: number;
  clicksHeightPct: number;
}

export function PostsTab({ localSeo }: PostsTabProps) {
  const businessName = localSeo?.businessName || "MilQuu Fresh";

  const [activeType, setActiveType] = useState<PostType>("What's new");
  const [postContent, setPostContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Published posts
  const [posts, setPosts] = useState<PostItem[]>([
    {
      id: "p-1",
      type: "Product",
      title: "Fresh Farm Milk Now Available!",
      snippet: "Pure, natural, and healthy milk delivered to your doorstep.",
      date: "10 Sept 2025",
      views: 1200,
      clicks: 84,
      badgeTone: "blue",
      fallbackInitial: "🥛",
    },
    {
      id: "p-2",
      type: "Offer",
      title: "Get 10% Off on Your First Order",
      snippet: `Start your healthy journey with ${businessName}.`,
      date: "8 Sept 2025",
      views: 2100,
      clicks: 156,
      badgeTone: "green",
      fallbackInitial: "🏷️",
    },
    {
      id: "p-3",
      type: "Event",
      title: "Celebrating World Milk Day",
      snippet: "Good health starts with pure milk. Thank you for being a part of...",
      date: "1 Sept 2025",
      views: 980,
      clicks: 64,
      badgeTone: "purple",
      fallbackInitial: "🎉",
    },
    {
      id: "p-4",
      type: "What's new",
      title: "Same Day Delivery",
      snippet: "Fresh milk & vegetables delivered fast across your city.",
      date: "28 Aug 2025",
      views: 1400,
      clicks: 102,
      badgeTone: "blue",
      fallbackInitial: "🚚",
    },
    {
      id: "p-5",
      type: "Product",
      title: "Fresh Vegetables Now Live!",
      snippet: "Farm fresh. Chemical free. Delivered to your home.",
      date: "25 Aug 2025",
      views: 1100,
      clicks: 76,
      badgeTone: "blue",
      fallbackInitial: "🥦",
    },
  ]);

  // AI suggestions
  const aiSuggestions: AiSuggestion[] = [
    {
      id: "sug-1",
      type: "What's new",
      title: "Fresh Farm Milk Now Available! 🥛",
      snippet: "Pure. Fresh. Delivered to your doorstep.",
      initials: "🥛",
      color: "bg-blue-100 text-blue-700",
    },
    {
      id: "sug-2",
      type: "Product",
      title: "Fresh Vegetables Daily",
      snippet: "Farm fresh vegetables, now at your home.",
      initials: "🥬",
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      id: "sug-3",
      type: "Offer",
      title: "Special Offer: 10% Off",
      snippet: "Get 10% off on your first order!",
      initials: "🏷️",
      color: "bg-rose-100 text-rose-700",
    },
    {
      id: "sug-4",
      type: "What's new",
      title: "Same Day Delivery",
      snippet: "Fresh essentials, delivered fast.",
      initials: "🚚",
      color: "bg-purple-100 text-purple-700",
    },
  ];

  // Performance timeline data
  const performanceTimeline: PerformanceDataPoint[] = [
    { date: "Aug 15", views: 950, clicks: 65, viewsHeightPct: 45, clicksHeightPct: 20 },
    { date: "Aug 22", views: 1300, clicks: 90, viewsHeightPct: 62, clicksHeightPct: 28 },
    { date: "Aug 29", views: 1800, clicks: 120, viewsHeightPct: 85, clicksHeightPct: 38 },
    { date: "Sep 5", views: 1450, clicks: 105, viewsHeightPct: 68, clicksHeightPct: 32 },
    { date: "Sep 12", views: 2100, clicks: 156, viewsHeightPct: 98, clicksHeightPct: 48 },
  ];

  // Top performing posts
  const topRankedPosts = [...posts].sort((a, b) => b.clicks - a.clicks).slice(0, 3);

  const handleUseSuggestion = (sug: AiSuggestion) => {
    setActiveType(sug.type);
    setPostContent(`${sug.title}\n\n${sug.snippet}\n\nOrder fresh today with swift delivery right to your door!`);
  };

  const handlePublishPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim()) return;

    const firstLine = postContent.trim().split("\n")[0] || "New Update";
    const snippet = postContent.trim().slice(firstLine.length).trim() || firstLine;

    const newPost: PostItem = {
      id: `post-${posts.length + 1}`,
      type: activeType,
      title: firstLine.length > 35 ? `${firstLine.slice(0, 35)}...` : firstLine,
      snippet: snippet.length > 70 ? `${snippet.slice(0, 70)}...` : snippet,
      date: "Today",
      views: 0,
      clicks: 0,
      badgeTone: activeType === "Offer" ? "green" : activeType === "Event" ? "purple" : "blue",
      fallbackInitial: activeType === "Product" ? "📦" : activeType === "Offer" ? "🏷️" : "📣",
    };

    setPosts([newPost, ...posts]);
    setPostContent("");
  };

  const filteredPosts = posts.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.snippet.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "All Types" || p.type.toLowerCase() === typeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* ── Top Metric Cards (Row 1) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Posts */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Total Posts</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">18</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} />
                <span>+50% vs last 28 days</span>
              </div>
              {/* Mini vertical bar chart */}
              <div className="flex items-end gap-1 h-6">
                <span className="w-1.5 h-2 rounded-xs bg-blue-200" />
                <span className="w-1.5 h-3 rounded-xs bg-blue-300" />
                <span className="w-1.5 h-4 rounded-xs bg-blue-400" />
                <span className="w-1.5 h-6 rounded-xs bg-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Total Views */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Total Views</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Eye size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">
              {localSeo ? "12.4K" : "—"}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} />
                <span>+32% vs last 28 days</span>
              </div>
              {/* Mini sparkline curve green */}
              <svg className="w-16 h-6 text-emerald-500" viewBox="0 0 64 24" fill="none">
                <path
                  d="M2 20 C 14 18, 28 14, 38 10 C 48 12, 54 4, 62 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 3: Total Clicks */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Total Clicks</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <MousePointer size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">
              {localSeo ? "842" : "—"}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} />
                <span>+18% vs last 28 days</span>
              </div>
              {/* Mini sparkline curve purple */}
              <svg className="w-16 h-6 text-purple-500" viewBox="0 0 64 24" fill="none">
                <path
                  d="M2 18 C 16 16, 26 12, 36 10 C 46 8, 54 4, 62 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 4: Avg. Engagement Rate */}
        <div
          className="rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-600">Avg. Engagement Rate</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <BarChart2 size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-brand-950">
              {localSeo ? "6.8%" : "—"}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} />
                <span>+2.1% vs last 28 days</span>
              </div>
              {/* Mini sparkline curve amber */}
              <svg className="w-16 h-6 text-amber-500" viewBox="0 0 64 24" fill="none">
                <path
                  d="M2 18 C 16 16, 26 12, 38 14 C 48 16, 54 6, 62 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ── Middle Row (Row 2): Create a New Post & AI Post Suggestions ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (7 cols): Create a New Post */}
        <div
          className="lg:col-span-7 rounded-2xl border bg-white p-5 shadow-xs space-y-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <h2 className="text-sm font-bold text-brand-950">Create a New Post</h2>
            <p className="text-xs text-brand-500">Share updates, offers, events, or products with your customers.</p>
          </div>

          {/* Type Selector Tabs */}
          <div className="flex items-center gap-2 border-b border-brand-100 pb-3">
            <button
              type="button"
              onClick={() => setActiveType("What's new")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeType === "What's new"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-brand-600 hover:bg-brand-50"
              )}
            >
              <FileText size={13} />
              <span>What&apos;s new</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveType("Offer")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeType === "Offer"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-brand-600 hover:bg-brand-50"
              )}
            >
              <Tag size={13} />
              <span>Offer</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveType("Event")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeType === "Event"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-brand-600 hover:bg-brand-50"
              )}
            >
              <Calendar size={13} />
              <span>Event</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveType("Product")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeType === "Product"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-brand-600 hover:bg-brand-50"
              )}
            >
              <ShoppingBag size={13} />
              <span>Product</span>
            </button>
          </div>

          {/* Text Area */}
          <form onSubmit={handlePublishPost} className="space-y-3">
            <div className="relative rounded-xl border border-brand-200 bg-white p-3 focus-within:ring-1 focus-within:ring-brand-950 focus-within:border-brand-950">
              <textarea
                rows={4}
                value={postContent}
                onChange={(e) => setPostContent(e.target.value.slice(0, 1500))}
                placeholder="Write your post... (e.g., Fresh farm milk now available!)"
                className="w-full text-xs text-brand-950 placeholder:text-brand-400 bg-transparent resize-none focus:outline-none"
              />
            </div>

            {/* Bottom Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-200 bg-white text-xs font-medium text-brand-700 hover:bg-brand-50 shadow-2xs"
                >
                  <ImageIcon size={13} className="text-blue-600" />
                  <span>Add Photo/Video</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-200 bg-white text-xs font-medium text-brand-700 hover:bg-brand-50 shadow-2xs"
                >
                  <LinkIcon size={13} className="text-blue-600" />
                  <span>Add Button</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-200 bg-white text-xs font-medium text-brand-700 hover:bg-brand-50 shadow-2xs"
                >
                  <Clock size={13} className="text-blue-600" />
                  <span>Schedule Post</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-brand-400">{postContent.length}/1500</span>
                <button
                  type="button"
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-brand-200 bg-white text-xs font-semibold text-brand-800 hover:bg-brand-50 shadow-2xs"
                >
                  <Eye size={13} />
                  <span>Preview</span>
                </button>
                <button
                  type="submit"
                  disabled={!postContent.trim()}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all",
                    postContent.trim()
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-brand-100 text-brand-400 cursor-not-allowed"
                  )}
                >
                  <Send size={13} />
                  <span>Post Now</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right (5 cols): AI Post Suggestions */}
        <div
          className="lg:col-span-5 rounded-2xl border bg-white p-5 shadow-xs space-y-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center">
                <Sparkles size={12} />
              </div>
              <h2 className="text-sm font-bold text-brand-950">AI Post Suggestions</h2>
            </div>
            <a href="?tab=ai-recommendations" className="text-xs font-bold text-blue-600 hover:text-blue-700">
              View All &rarr;
            </a>
          </div>

          <p className="text-[11px] text-brand-500 -mt-2">
            Get AI-generated post ideas based on your business and trending topics.
          </p>

          <div className="space-y-2.5 pt-1">
            {aiSuggestions.map((sug) => (
              <div
                key={sug.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-brand-100 hover:border-brand-200 hover:shadow-2xs transition-all bg-white"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                      sug.color
                    )}
                  >
                    {sug.initials}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-brand-950 truncate max-w-[210px]">{sug.title}</h4>
                    <p className="text-[11px] text-brand-500 truncate max-w-[210px]">{sug.snippet}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleUseSuggestion(sug)}
                  className="px-3 py-1 text-xs font-semibold rounded-lg border border-brand-200 bg-white text-blue-600 hover:bg-blue-50 shadow-2xs shrink-0"
                >
                  Use
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Middle-Bottom (Row 3): Your Posts Grid (18) ─────────────── */}
      <div
        className="rounded-2xl border bg-white p-5 shadow-xs space-y-4"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-brand-950">Your Posts ({posts.length})</h2>
            <p className="text-xs text-brand-500">Manage and track the performance of your Google posts.</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-7 pr-2.5 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950 w-36 sm:w-44"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg border border-brand-200 bg-white font-medium text-brand-800 focus:outline-none"
            >
              <option value="All Types">All Types</option>
              <option value="Product">Product</option>
              <option value="Offer">Offer</option>
              <option value="Event">Event</option>
              <option value="What's new">What&apos;s new</option>
            </select>

            <a
              href="#view-all-posts"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 pl-2"
            >
              <span>View All</span>
              <ArrowRight size={12} />
            </a>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="rounded-xl border border-brand-100 bg-white p-3 flex flex-col justify-between space-y-3 hover:shadow-2xs hover:border-brand-200 transition-all"
            >
              <div className="space-y-2">
                {/* Thumbnail banner with tag */}
                <div className="relative w-full h-24 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden border border-brand-100">
                  <span
                    className={cn(
                      "absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md text-white shadow-xs",
                      post.badgeTone === "green"
                        ? "bg-emerald-600"
                        : post.badgeTone === "purple"
                        ? "bg-purple-600"
                        : "bg-blue-600"
                    )}
                  >
                    {post.type}
                  </span>
                  <span className="text-3xl">{post.fallbackInitial}</span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-brand-950 truncate" title={post.title}>
                    {post.title}
                  </h4>
                  <p className="text-[11px] text-brand-500 line-clamp-2 leading-relaxed" title={post.snippet}>
                    {post.snippet}
                  </p>
                </div>
              </div>

              {/* Card Footer: Date, Views, Clicks, Dots */}
              <div className="flex items-center justify-between text-[10px] text-brand-400 pt-2 border-t border-brand-50">
                <span>{post.date}</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5" title="Views">
                    <Eye size={11} className="text-brand-500" />
                    <span className="font-semibold text-brand-700">{post.views.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-0.5" title="Clicks">
                    <MousePointer size={10} className="text-brand-500" />
                    <span className="font-semibold text-brand-700">{post.clicks}</span>
                  </div>
                  <button type="button" className="text-brand-400 hover:text-brand-700">
                    <MoreVertical size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom Row (Row 4): Post Performance, Top Performing Posts, Post Insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card 1 (5 cols): Post Performance Bar Chart */}
        <div
          className="lg:col-span-5 rounded-2xl border bg-white p-5 shadow-xs space-y-3"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-950">Post Performance</h2>
              <p className="text-[11px] text-brand-500">Views vs Clicks over time for your posts.</p>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-brand-700">Views</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-900" />
                <span className="text-brand-700">Clicks</span>
              </div>
            </div>
          </div>

          <div className="h-40 flex items-end justify-between gap-3 pt-4 px-2 border-b border-brand-100">
            {performanceTimeline.map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <div className="w-full flex items-end justify-center gap-1.5 h-28">
                  {/* Views Bar */}
                  <div
                    className="w-3.5 rounded-t bg-blue-500 transition-all hover:bg-blue-600"
                    style={{ height: `${item.viewsHeightPct}%` }}
                    title={`Views: ${item.views}`}
                  />
                  {/* Clicks Bar */}
                  <div
                    className="w-3.5 rounded-t bg-blue-900 transition-all hover:bg-blue-950"
                    style={{ height: `${item.clicksHeightPct}%` }}
                    title={`Clicks: ${item.clicks}`}
                  />
                </div>
                <span className="text-[10px] font-medium text-brand-400">{item.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2 (3 cols): Top Performing Posts */}
        <div
          className="lg:col-span-3 rounded-2xl border bg-white p-5 shadow-xs space-y-3"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <h2 className="text-sm font-bold text-brand-950">Top Performing Posts</h2>
            <p className="text-[11px] text-brand-500">Posts with the highest engagement.</p>
          </div>

          <div className="space-y-3 pt-1">
            {topRankedPosts.map((p, idx) => (
              <div key={p.id} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-brand-950 truncate max-w-[140px]">{p.title}</h4>
                  <p className="text-[11px] text-brand-500">
                    {p.views.toLocaleString()} views | {p.clicks} clicks
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3 (4 cols): Post Insights */}
        <div className="lg:col-span-4 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/70 via-purple-50/40 to-indigo-50/50 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center">
                <Sparkles size={12} />
              </div>
              <h3 className="text-xs font-bold text-purple-950">Post Insights</h3>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2 text-brand-800">
              <Check size={14} className="text-purple-600 shrink-0 mt-0.5" />
              <span>Posts with images get 2.3x more views.</span>
            </div>
            <div className="flex items-start gap-2 text-brand-800">
              <Check size={14} className="text-purple-600 shrink-0 mt-0.5" />
              <span>Offers and events drive the highest engagement.</span>
            </div>
            <div className="flex items-start gap-2 text-brand-800">
              <Check size={14} className="text-purple-600 shrink-0 mt-0.5" />
              <span>Your posting frequency is good (1-2 per week).</span>
            </div>
            <div className="flex items-start gap-2 text-brand-800">
              <Check size={14} className="text-purple-600 shrink-0 mt-0.5" />
              <span>Try posting more product updates and customer stories.</span>
            </div>
          </div>

          <a
            href="?tab=ai-recommendations"
            className="w-full h-9 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <span>Get AI Recommendations</span>
            <ArrowRight size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
