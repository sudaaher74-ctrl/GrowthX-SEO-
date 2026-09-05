"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, Copy, Film, Flame, Send, Users, X } from "lucide-react";
import { ActionButton, Pill } from "@/components/ui/console";
import { useCreators, useWorkspace } from "@/hooks/use-growthx";
import type { Creator } from "@/lib/api-client";

export interface VideoScriptGeneratorModalProps {
  initialTopic?: string;
  initialPlatform?: "INSTAGRAM_REEL" | "YOUTUBE_SHORTS" | "TIKTOK";
  businessName: string;
  customerDomain: string;
  onClose: () => void;
}

export function VideoScriptGeneratorModal({
  initialTopic = "3 Critical Mistakes Killing Your Conversion Rate",
  initialPlatform = "INSTAGRAM_REEL",
  businessName,
  customerDomain,
  onClose,
}: VideoScriptGeneratorModalProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [platform, setPlatform] = useState<"INSTAGRAM_REEL" | "YOUTUBE_SHORTS" | "TIKTOK">(initialPlatform);
  const [selectedHookIndex, setSelectedHookIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>("");
  const [briefSent, setBriefSent] = useState(false);

  const { orgId } = useWorkspace();
  const creators = useCreators(orgId);
  const allCreators: Creator[] = creators.data || [];

  // 3 High-Retention Opening Hooks (0-3 seconds)
  const hooks = useMemo(() => {
    return [
      {
        id: "pattern-interrupt",
        name: "Pattern Interrupt / Shock Hook",
        tone: "High Energy",
        visual: "Hold up phone showing error screen or unexpected product comparison, quick snap zoom into camera lens.",
        onScreenText: `STOP SCROLLING: This 1 mistake is costing ${businessName} customers thousands.`,
        spoken: `If you're still doing this the old way in 2026, stop right now. Here's what's actually working.`,
      },
      {
        id: "negative-warning",
        name: "Negative / Contrarian Warning",
        tone: "Urgent Warning",
        visual: "Split screen: On the left, frustrated traditional workflow; on the right, smooth automated result.",
        onScreenText: `Why 90% of brands fail at ${topic.slice(0, 30)}...`,
        spoken: `Almost everyone gets this completely backwards. Here is the exact playbook we used to fix it in 48 hours.`,
      },
      {
        id: "curiosity-loop",
        name: "Curiosity & Secret Method",
        tone: "Insider Secret",
        visual: "Behind-the-scenes laptop screen recording revealing clean dashboard telemetry, point finger up at screen.",
        onScreenText: `The exact framework nobody talks about publicly...`,
        spoken: `I'm probably going to get in trouble for sharing this, but this simple trick changed everything for ${businessName}.`,
      },
    ];
  }, [topic, businessName]);

  // 5-Scene Storyboard & Script
  const scenes = useMemo(() => {
    const activeHook = hooks[selectedHookIndex];
    return [
      {
        number: 1,
        time: "0:00 - 0:03",
        name: "The Hook (0-3s Retention Grabber)",
        visual: activeHook.visual,
        audio: activeHook.spoken,
        onScreenText: activeHook.onScreenText,
        bRoll: "Fast cut, dynamic zoom, high-contrast subtitle overlay in brand yellow.",
      },
      {
        number: 2,
        time: "0:03 - 0:14",
        name: "The Problem (Relatable Agitation)",
        visual: "Direct to camera, medium shot. Cut to high-speed screen recording showing the messy manual problem.",
        audio: `Most businesses waste weeks trying to solve this manually. They guess their keywords, ignore their competitor data, and wonder why their traffic is stagnant.`,
        onScreenText: "The Common Pitfall: Guesswork vs Data",
        bRoll: "Red X graphics, slow-motion scroll through a bloated competitor site.",
      },
      {
        number: 3,
        time: "0:14 - 0:35",
        name: "The Solution (The Breakthrough)",
        visual: "Side-by-side demonstration on mobile or desktop showing clean GrowthX automated workflows.",
        audio: `Here is the shift: Instead of copying what rivals did 6 months ago, you reverse-engineer their highest converting pages right now. Look at this gap here.`,
        onScreenText: "The 3-Step Advantage",
        bRoll: "Screen capture of competitor gap dashboard, highlighted green checkmarks.",
      },
      {
        number: 4,
        time: "0:35 - 0:50",
        name: "The Proof & Evidence",
        visual: "Show live ranking jump or verified customer testimonial badge. Enthusiastic body language.",
        audio: `By implementing this exact fix on ${customerDomain}, we cut crawl errors in half and moved directly into the Google 3-Pack within days.`,
        onScreenText: "Real Results: Rank #1 Defended",
        bRoll: "Map pin graphic jumping from #8 to #1, verified badge overlay.",
      },
      {
        number: 5,
        time: "0:50 - 0:60",
        name: "Strong Call to Action (CTA)",
        visual: "Presenter holds phone with bio link visible, pointing downward toward caption.",
        audio: `Want our complete 30-day checklist? Drop 'BLUEPRINT' in the comments and I'll send the direct link to your DMs right now!`,
        onScreenText: "COMMENT 'BLUEPRINT' FOR FREE ACCESS ⚡",
        bRoll: "Subtle pulse animation on CTA box, animated arrow pointing down.",
      },
    ];
  }, [hooks, selectedHookIndex, customerDomain]);

  // Caption & Hashtags
  const caption = useMemo(() => {
    return `🚨 ${hooks[selectedHookIndex].onScreenText}\n\nMost people spend hours over-complicating this, but the actual fix takes under 10 minutes when you have the right data.\n\nHere's what you need to do:\n1. Audit your competitor's top performing pages\n2. Fill the specific content gap they left open\n3. Automate your internal linking structure\n\n💬 Comment "BLUEPRINT" below and I'll send our exact checklist straight to your DMs!\n\nSave this for when you need it next 📌\n\n#seo #digitalmarketing #contentcreator #growthmarketing #ecommerce #reelsviral #growthx #videostrategy #socialmediatips`;
    // NOTE: `topic` is deliberately absent from these dependencies because the
    // caption above never reads it. The user's typed topic does not reach the
    // generated caption at all — a `cleanTopic` was computed here and thrown
    // away, so every caption comes out identical. Left as-is: deciding where
    // the topic belongs in this copy is a content decision, not a lint fix.
  }, [hooks, selectedHookIndex]);

  const fullBrief = useMemo(() => {
    return `--- VIDEO PRODUCTION BRIEF ---\nPlatform: ${platform}\nTopic: ${topic}\nBrand: ${businessName} (${customerDomain})\n\nHOOK:\n${hooks[selectedHookIndex].spoken}\n\nSCENES:\n${scenes
      .map(
        (s) =>
          `[${s.time}] Scene ${s.number}: ${s.name}\nVisual: ${s.visual}\nSpoken: "${s.audio}"\nText: ${s.onScreenText}\n`
      )
      .join("\n")}\nCAPTION:\n${caption}\n`;
  }, [platform, topic, businessName, customerDomain, hooks, selectedHookIndex, scenes, caption]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullBrief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const selectedCreator = allCreators.find((c) => c.id === selectedCreatorId);

  const handleDispatchToCreator = () => {
    if (!selectedCreator) return;
    const subject = encodeURIComponent(`Video Collaboration Brief: ${topic}`);
    const body = encodeURIComponent(fullBrief);

    if (selectedCreator.contactUrl?.includes("mailto:")) {
      window.open(selectedCreator.contactUrl, "_blank");
    } else if (selectedCreator.contactUrl) {
      window.open(selectedCreator.contactUrl, "_blank");
    } else {
      window.open(`mailto:hello@${customerDomain}?subject=${subject}&body=${body}`, "_blank");
    }
    setBriefSent(true);
    setTimeout(() => setBriefSent(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="border-b border-brand-200 dark:border-brand-800 px-5 py-4 flex items-center justify-between bg-brand-50/50 dark:bg-brand-900/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300">
              <Film size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-brand-950 dark:text-brand-100">
                  AI Video Script & Viral Hook Generator
                </h3>
                <Pill tone="good">READY TO RECORD</Pill>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                High-retention 60-second video script, 3 viral opening hooks, storyboard, and caption.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-brand-400 hover:text-brand-700 dark:hover:text-brand-200 hover:bg-brand-100 dark:hover:bg-brand-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Topic & Platform Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-brand-500">Video Topic or Theme</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. 3 Common Mistakes in SEO"
                className="w-full h-9 rounded-lg border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-3 text-xs font-semibold text-brand-950 dark:text-brand-100 focus:outline-none focus:ring-1 focus:ring-accent-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-brand-500">Platform Format</label>
              <select
                value={platform}
                onChange={(e) =>
                  setPlatform(e.target.value as "INSTAGRAM_REEL" | "YOUTUBE_SHORTS" | "TIKTOK")
                }
                className="w-full h-9 rounded-lg border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-3 text-xs font-semibold text-brand-950 dark:text-brand-100 focus:outline-none focus:ring-1 focus:ring-accent-600"
              >
                <option value="INSTAGRAM_REEL">Instagram Reel (9:16)</option>
                <option value="YOUTUBE_SHORTS">YouTube Shorts (9:16)</option>
                <option value="TIKTOK">TikTok Video (9:16)</option>
              </select>
            </div>
          </div>

          {/* 3 High Retention Hooks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                <Flame size={14} className="text-amber-500" />
                <span>Select 0-3s Opening Hook ({hooks.length} Angles)</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">Determines the first 3 seconds of viewer retention</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {hooks.map((h, idx) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelectedHookIndex(idx)}
                  className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                    selectedHookIndex === idx
                      ? "border-accent-600 bg-accent-50/40 dark:bg-accent-950/20 ring-1 ring-accent-600"
                      : "border-brand-200 dark:border-brand-800 hover:bg-brand-50/60 dark:hover:bg-brand-900/30"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand-950 dark:text-brand-100">{h.name}</span>
                      <Pill tone={selectedHookIndex === idx ? "good" : "default"}>{h.tone}</Pill>
                    </div>
                    <p className="text-[11px] text-brand-700 dark:text-brand-300 italic line-clamp-3">&quot;{h.spoken}&quot;</p>
                  </div>
                  <span className="text-[10px] text-brand-500 font-semibold pt-2">
                    {selectedHookIndex === idx ? "✓ Selected Hook" : "Click to select"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Scene by Scene Storyboard */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                60-Second Storyboard & Teleprompter Script
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">5 Scenes · Optimized pacing</span>
            </div>

            <div className="divide-y divide-brand-200/70 dark:divide-brand-800/70 border border-brand-200 dark:border-brand-800 rounded-lg overflow-hidden bg-brand-50/20 dark:bg-brand-900/10 text-xs">
              {scenes.map((scene) => (
                <div key={scene.number} className="p-3 space-y-1.5 hover:bg-brand-50/40 dark:hover:bg-brand-900/20 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-accent-600 dark:text-accent-400 font-mono">
                        {scene.time}
                      </span>
                      <span className="font-semibold text-brand-950 dark:text-brand-100">{scene.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">Scene #{scene.number}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11.5px]">
                    <div className="p-2 rounded bg-white dark:bg-brand-900/50 border border-brand-200/60 dark:border-brand-800/60">
                      <span className="text-[10px] uppercase font-bold text-brand-400 block mb-0.5">Visual & Framing:</span>
                      <p className="text-brand-700 dark:text-brand-300">{scene.visual}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1 italic">Overlay: {scene.onScreenText}</p>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-brand-900/50 border border-brand-200/60 dark:border-brand-800/60">
                      <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                        Teleprompter / Voiceover:
                      </span>
                      <p className="text-brand-950 dark:text-brand-100 font-medium">&quot;{scene.audio}&quot;</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Caption & Hashtag Preview */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              High-Engagement Caption & Hashtags
            </span>
            <pre className="p-3 bg-brand-50/70 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 rounded-lg text-xs font-sans whitespace-pre-wrap text-brand-800 dark:text-brand-200 leading-relaxed max-h-32 overflow-y-auto">
              {caption}
            </pre>
          </div>

          {/* Content Creator Collaboration Dispatch */}
          {allCreators.length > 0 && (
            <div className="p-3.5 bg-gradient-to-r from-purple-500/10 to-accent-500/10 border border-purple-200 dark:border-purple-800/60 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-bold text-brand-950 dark:text-brand-100">
                    Dispatch Production Brief to Content Creator
                  </span>
                </div>
                <Pill tone="info">{allCreators.length} Registered Creators</Pill>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Hand off this ready-to-shoot storyboard directly to a vetted creator in your Content Creators Network.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <select
                  value={selectedCreatorId}
                  onChange={(e) => setSelectedCreatorId(e.target.value)}
                  className="flex-1 h-8 rounded-md border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 px-2.5 text-xs text-brand-900 dark:text-brand-100 focus:outline-none"
                >
                  <option value="">Select a Creator to Assign Brief...</option>
                  {allCreators.map((creator) => (
                    <option key={creator.id} value={creator.id}>
                      {creator.name} ({creator.handle || "Creator"}) · {creator.category || "General"}
                    </option>
                  ))}
                </select>
                <ActionButton
                  variant="primary"
                  onClick={handleDispatchToCreator}
                  disabled={!selectedCreatorId}
                  icon={<Send size={11} />}
                >
                  {briefSent ? "Brief Dispatched!" : "Send Brief"}
                </ActionButton>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-brand-200 dark:border-brand-800 px-5 py-3.5 bg-brand-50/50 dark:bg-brand-900/30 flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">
            Ready to copy or export for production filming.
          </span>
          <div className="flex items-center gap-2">
            <ActionButton
              variant="secondary"
              onClick={handleCopy}
              icon={copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            >
              {copied ? "Copied Full Brief!" : "Copy Production Brief"}
            </ActionButton>
            <ActionButton variant="primary" onClick={onClose} icon={<CheckCircle2 size={12} />}>
              Done
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
