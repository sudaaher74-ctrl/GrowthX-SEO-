"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Send,
  Video,
  X,
  Phone,
  Mail,
  Calendar,
  Briefcase,
  Layers,
  ArrowRight,
} from "lucide-react";
import { useCreators } from "@/hooks/use-growthx";
import type { Creator } from "@/lib/api-client";

function InstagramIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function YoutubeIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <polygon points="10 15 15 12 10 9 10 15" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedinIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function TwitterIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
      <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
    </svg>
  );
}

const CREATOR_CATEGORIES = [
  { id: "ALL", label: "All Creators" },
  { id: "REELS", label: "Reels & Shorts" },
  { id: "UGC", label: "UGC & E-commerce" },
  { id: "TECH", label: "Tech & SaaS" },
  { id: "YOUTUBE", label: "YouTube & Long-form" },
  { id: "B2B", label: "B2B & Thought Leadership" },
] as const;

interface SocialCreatorsPanelProps {
  projectId: string;
  businessName?: string;
  customerDomain?: string;
}

export function SocialCreatorsPanel({
  projectId,
  businessName,
  customerDomain,
}: SocialCreatorsPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCreatorForContact, setActiveCreatorForContact] = useState<Creator | null>(null);
  const [localCreators, setLocalCreators] = useState<Creator[]>([]);

  // Collaboration form state
  const [collabBrand, setCollabBrand] = useState(businessName || "");
  const [collabFormat, setCollabFormat] = useState("Instagram Reels & Shorts");
  const [collabMessage, setCollabMessage] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const creatorsQuery = useCreators(projectId);

  // Load any admin-created creators saved in localStorage as a resilient fast layer
  useEffect(() => {
    try {
      const stored = localStorage.getItem("growthx_admin_creators");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setLocalCreators(parsed);
        }
      }
    } catch {
      // Ignore read errors
    }
  }, []);

  // Merge server creators with local admin creators, avoiding duplicates by id or name
  const combinedCreators: Creator[] = useMemo(() => {
    const serverList = creatorsQuery.data || [];
    const list = [...serverList];

    for (const localItem of localCreators) {
      if (!list.some((c) => c.id === localItem.id || c.name.toLowerCase() === localItem.name.toLowerCase())) {
        list.push(localItem);
      }
    }

    return list;
  }, [creatorsQuery.data, localCreators]);

  // Filter creators
  const filteredCreators = useMemo(() => {
    return combinedCreators.filter((creator) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (creator.handle && creator.handle.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (creator.category && creator.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (creator.notes && creator.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (selectedCategory === "ALL") return true;
      const cat = (creator.category || "").toUpperCase();
      if (selectedCategory === "REELS") return cat.includes("REEL") || cat.includes("SHORT") || cat.includes("TIKTOK");
      if (selectedCategory === "UGC") return cat.includes("UGC") || cat.includes("PRODUCT") || cat.includes("COMMERCE");
      if (selectedCategory === "TECH") return cat.includes("TECH") || cat.includes("SAAS") || cat.includes("SOFTWARE");
      if (selectedCategory === "YOUTUBE") return cat.includes("YOUTUBE") || cat.includes("PODCAST") || cat.includes("VIDEO");
      if (selectedCategory === "B2B") return cat.includes("B2B") || cat.includes("LINKEDIN") || cat.includes("BUSINESS");

      return true;
    });
  }, [combinedCreators, searchQuery, selectedCategory]);

  const handleOpenContact = (creator: Creator) => {
    setActiveCreatorForContact(creator);
    setIsSubmitted(false);
    setCollabBrand(businessName || "");
    setCollabMessage("");
  };

  const handleSubmitInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    // Persist inquiry in local collaboration logs
    try {
      const existing = JSON.parse(localStorage.getItem("growthx_creator_inquiries") || "[]");
      existing.push({
        id: `inq_${Date.now()}`,
        creatorId: activeCreatorForContact?.id,
        creatorName: activeCreatorForContact?.name,
        brand: collabBrand,
        format: collabFormat,
        message: collabMessage,
        date: new Date().toISOString(),
      });
      localStorage.setItem("growthx_creator_inquiries", JSON.stringify(existing));
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Network Hero Banner */}
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-950 via-brand-900 to-accent-950 p-6 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/20 px-2.5 py-0.5 text-[11px] font-bold text-accent-300 border border-accent-400/30">
              <Sparkles size={12} />
              <span>Verified Creator Network</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Connect With High-Impact Content Creators
            </h2>
            <p className="text-xs text-brand-200 leading-relaxed">
              Scale your social reach with vetted video creators, UGC specialists, and vertical short-form producers.
              Review their verified social profiles and click <span className="font-semibold text-white">&quot;Talk With Us&quot;</span> to initiate branded campaigns.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-3 border border-white/10 text-center">
              <span className="block text-2xl font-bold font-mono text-white">{combinedCreators.length}</span>
              <span className="text-[10.5px] uppercase font-semibold text-brand-300">Creators Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-brand-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {CREATOR_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-brand-950 text-white shadow-2xs"
                    : "bg-brand-50/60 text-brand-700 hover:bg-brand-100 hover:text-brand-950"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
          <input
            type="text"
            placeholder="Search creator or niche..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8.5 pl-8.5 pr-3 rounded-lg border border-brand-200 bg-brand-50/30 text-xs text-brand-900 focus:outline-none focus:ring-1 focus:ring-accent-600 shadow-2xs"
          />
        </div>
      </div>

      {/* 3. Creators Directory Grid */}
      {filteredCreators.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-brand-200 bg-brand-50/30 space-y-3">
          <Users size={32} className="mx-auto text-brand-300" />
          <h3 className="text-sm font-bold text-brand-950">No Creators Found</h3>
          <p className="text-xs text-brand-500 max-w-md mx-auto">
            {searchQuery
              ? `No creators match "${searchQuery}". Try changing your search or category filter.`
              : "No content creators have been added yet. Platform administrators can add creators from the Admin Control Panel (/admin)."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCreators.map((creator) => {
            // Collect social links
            const instagramLink =
              creator.instagramUrl ||
              (creator.platform === "INSTAGRAM" && creator.profileUrl ? creator.profileUrl : null) ||
              (creator.handle && !creator.handle.includes("http") ? `https://instagram.com/${creator.handle.replace("@", "")}` : null);

            const youtubeLink =
              creator.youtubeUrl ||
              (creator.platform === "YOUTUBE" && creator.profileUrl ? creator.profileUrl : null);

            const tiktokLink =
              creator.tiktokUrl ||
              (creator.platform === "TIKTOK" && creator.profileUrl ? creator.profileUrl : null);

            const linkedinLink =
              creator.linkedinUrl ||
              (creator.platform === "LINKEDIN" && creator.profileUrl ? creator.profileUrl : null);

            const xLink =
              creator.xUrl ||
              (creator.platform === "X" && creator.profileUrl ? creator.profileUrl : null);

            return (
              <div
                key={creator.id}
                className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-white p-5 shadow-2xs hover:shadow-sm hover:border-brand-300 transition-all space-y-4"
              >
                {/* Card Top: Avatar & Info */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-900 to-accent-700 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                        {creator.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-sm text-brand-950 truncate">{creator.name}</h4>
                          <CheckCircle2 size={13} className="text-accent-600 shrink-0" />
                        </div>
                        {creator.handle && (
                          <p className="text-[11.5px] font-mono text-brand-500 truncate">
                            {creator.handle.startsWith("@") ? creator.handle : `@${creator.handle}`}
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                      Active
                    </span>
                  </div>

                  {/* Niche & Audience Metrics */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {creator.category && (
                      <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-brand-100 text-brand-800">
                        {creator.category}
                      </span>
                    )}
                    {creator.location && (
                      <span className="text-[10.5px] text-brand-500 px-1.5 py-0.5">
                        &bull; {creator.location}
                      </span>
                    )}
                    {creator.followerCount && (
                      <span className="text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded-md bg-accent-50 text-accent-800 border border-accent-200">
                        {creator.followerCount >= 1000
                          ? `${(creator.followerCount / 1000).toFixed(0)}K Reach`
                          : `${creator.followerCount} Reach`}
                      </span>
                    )}
                  </div>

                  {/* Bio Description */}
                  <p className="text-xs text-brand-600 line-clamp-3 leading-relaxed">
                    {creator.notes ||
                      "Specializes in high-retention vertical video, viral product hooks, and multi-channel audience engagement."}
                  </p>
                </div>

                {/* Card Bottom: Clickable Social Media Links & Talk With Us Button */}
                <div className="space-y-3 pt-3 border-t border-brand-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">
                      Social Channels:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {instagramLink && (
                        <a
                          href={instagramLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-pink-50 text-pink-600 hover:bg-pink-100 flex items-center justify-center transition"
                          title="View Instagram Profile"
                        >
                          <InstagramIcon size={14} />
                        </a>
                      )}
                      {youtubeLink && (
                        <a
                          href={youtubeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition"
                          title="View YouTube Channel"
                        >
                          <YoutubeIcon size={14} />
                        </a>
                      )}
                      {tiktokLink && (
                        <a
                          href={tiktokLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200 flex items-center justify-center transition"
                          title="View TikTok Profile"
                        >
                          <Video size={13} />
                        </a>
                      )}
                      {linkedinLink && (
                        <a
                          href={linkedinLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center justify-center transition"
                          title="View LinkedIn Profile"
                        >
                          <LinkedinIcon size={13} />
                        </a>
                      )}
                      {xLink && (
                        <a
                          href={xLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-zinc-200 flex items-center justify-center transition"
                          title="View X / Twitter Profile"
                        >
                          <TwitterIcon size={13} />
                        </a>
                      )}
                      {!instagramLink && !youtubeLink && !tiktokLink && !linkedinLink && !xLink && (
                        <span className="text-[11px] text-brand-400 italic">Direct booking</span>
                      )}
                    </div>
                  </div>

                  {/* Talk With Us Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenContact(creator)}
                    className="w-full py-2.5 px-4 rounded-xl bg-brand-950 text-white hover:bg-brand-900 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <MessageCircle size={14} className="text-accent-400" />
                    <span>Talk With Us</span>
                    <ArrowRight size={13} className="text-brand-400 ml-auto" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Connect With Creator / Talk With Us Modal */}
      {activeCreatorForContact && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-brand-100 bg-brand-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-950 text-white flex items-center justify-center font-bold text-xs">
                  {activeCreatorForContact.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-brand-950">
                    Connect with {activeCreatorForContact.name}
                  </h3>
                  <p className="text-[11px] text-brand-500">
                    {activeCreatorForContact.category || "Content Creator"} &bull; Verified Partner
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveCreatorForContact(null)}
                className="p-1.5 text-brand-400 hover:text-brand-950 rounded-lg hover:bg-brand-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {isSubmitted ? (
                <div className="py-6 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-brand-950">Collaboration Brief Dispatched!</h4>
                  <p className="text-xs text-brand-600 max-w-sm mx-auto leading-relaxed">
                    Thank you! Your inquiry has been forwarded to{" "}
                    <span className="font-semibold text-brand-950">{activeCreatorForContact.name}</span>&apos;s team.
                    We will review your campaign requirements and contact you within 24 hours.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveCreatorForContact(null)}
                      className="px-4 py-2 rounded-xl bg-brand-950 text-white text-xs font-semibold hover:bg-brand-900 transition"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitInquiry} className="space-y-3.5">
                  {/* Quick Direct Link if configured */}
                  {activeCreatorForContact.contactUrl && (
                    <div className="p-3 bg-accent-50/60 rounded-xl border border-accent-200 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-accent-950">Instant Booking / WhatsApp Available</p>
                        <p className="text-[11px] text-accent-700">Connect directly on external booking channel</p>
                      </div>
                      <a
                        href={activeCreatorForContact.contactUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-accent-600 text-white text-xs font-semibold hover:bg-accent-700 transition flex items-center gap-1.5 shrink-0"
                      >
                        <span>Open Chat</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-brand-700 mb-1">Your Brand / Company</label>
                      <input
                        type="text"
                        required
                        value={collabBrand}
                        onChange={(e) => setCollabBrand(e.target.value)}
                        placeholder="e.g. Acme Studio"
                        className="w-full h-8.5 px-3 rounded-lg border border-brand-200 bg-white text-xs shadow-2xs focus:outline-none focus:ring-1 focus:ring-accent-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-brand-700 mb-1">Requested Format</label>
                      <select
                        value={collabFormat}
                        onChange={(e) => setCollabFormat(e.target.value)}
                        className="w-full h-8.5 px-2.5 rounded-lg border border-brand-200 bg-white text-xs shadow-2xs"
                      >
                        <option value="Instagram Reels & Shorts">Instagram Reels & Shorts</option>
                        <option value="Product UGC Review">Product UGC Review</option>
                        <option value="Long-form YouTube Video">Long-form YouTube Video</option>
                        <option value="Multi-Platform Campaign">Multi-Platform Campaign</option>
                        <option value="Consultation & Strategy">Consultation & Strategy</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-brand-700 mb-1">
                      Campaign Details & Collaboration Goals *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={collabMessage}
                      onChange={(e) => setCollabMessage(e.target.value)}
                      placeholder="Describe what you want to create (e.g. 'We need 4 Reels showcasing our new sneaker collection with viral sound hooks...')"
                      className="w-full p-2.5 rounded-lg border border-brand-200 bg-white text-xs shadow-2xs focus:outline-none focus:ring-1 focus:ring-accent-600"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-brand-500 flex items-center gap-1">
                      <Calendar size={12} /> Response time ~24 hrs
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveCreatorForContact(null)}
                        className="px-3 py-1.5 rounded-lg border border-brand-200 text-xs font-semibold text-brand-700 hover:bg-brand-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Send size={12} />
                        <span>Send Brief</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
