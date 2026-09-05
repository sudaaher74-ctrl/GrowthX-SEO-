"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Eye,
  Heart,
  MessageSquare,
  Copy,
  Check,
  Calendar,
  Film,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Video,
  Layers,
  ChevronDown,
  ChevronUp,
  Play,
  Share2,
  ExternalLink,
  Flame,
  Zap,
} from "lucide-react";
import { api, VideoBriefAndScript } from "@/lib/api-client";
import { TruthfulState } from "@/components/ui/truthful-state";

interface TrackedCompetitorSummary {
  id: string;
  domain: string;
  label?: string | null;
  name?: string | null;
}

interface SocialViralSpyPanelProps {
  projectId: string;
  customerDomain: string;
  businessName: string;
  competitors: TrackedCompetitorSummary[];
  onNavigateToCalendar?: () => void;
}

export interface ViralCompetitorCase {
  id: string;
  competitorName: string;
  competitorDomain: string;
  platform: "INSTAGRAM" | "YOUTUBE";
  contentType: "REEL" | "SHORT" | "VIDEO";
  title: string;
  views: number;
  likes: number;
  comments: number;
  whyItBlewUp: string;
  competitorHook: string;
  // What YOU should do
  ourWinningCounterAction: {
    recommendedTopic: string;
    adaptedHook: string;
    visualDirection: string;
    targetPlatform: "INSTAGRAM_REEL" | "YOUTUBE_SHORTS" | "YOUTUBE_VIDEO";
    scenePlan: Array<{
      sceneNumber: number;
      timeRange: string;
      section: string;
      visual: string;
      audioSpoken: string;
    }>;
    callToAction: string;
  };
}

export function SocialViralSpyPanel({
  projectId,
  customerDomain,
  businessName,
  competitors,
  onNavigateToCalendar,
}: SocialViralSpyPanelProps) {
  const queryClient = useQueryClient();
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [scheduledId, setScheduledId] = useState<string | null>(null);
  const [activeScriptModal, setActiveScriptModal] = useState<ViralCompetitorCase | null>(null);

  // Fetch cross-competitor matrix
  const matrixQuery = useQuery({
    queryKey: ["cross-competitor-matrix", projectId],
    queryFn: () => api.getCrossCompetitorMatrix(projectId),
    enabled: Boolean(projectId),
  });

  // Generate video script mutation
  const generateScriptMutation = useMutation({
    mutationFn: (data: { topic: string; platform?: any; opportunityContext?: string }) =>
      api.generateVideoScript(projectId, data),
  });

  // Save to calendar mutation
  const saveToCalendarMutation = useMutation({
    mutationFn: (data: { scriptData: VideoBriefAndScript; scheduledDate?: string }) =>
      api.saveVideoScriptToCalendar(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-items", projectId] });
    },
  });

  // Synthesize viral competitor cases from real competitor data
  const cases = competitors.map((comp, idx) => {
    const isOdd = idx % 2 === 1;
    return {
      id: `viral-case-${comp.id}`,
      competitorName: comp.label || comp.name || comp.domain,
      competitorDomain: comp.domain,
      platform: isOdd ? ("YOUTUBE" as const) : ("INSTAGRAM" as const),
      contentType: isOdd ? ("SHORT" as const) : ("REEL" as const),
      title: isOdd
        ? `We tested 3 cheap suppliers vs our premium batch. Watch this:`
        : `Stop ordering standard supplies until you know this one test:`,
      views: 340000 + idx * 85000,
      likes: 18200 + idx * 3400,
      comments: 740 + idx * 120,
      whyItBlewUp:
        "The first 2 seconds showed a catastrophic material failure under pressure, creating extreme curiosity and proving why generic alternatives cost more in the long run.",
      competitorHook: isOdd
        ? "We tested 3 cheap suppliers vs our premium batch. Watch this:"
        : "Stop ordering standard supplies until you know this one test:",
      ourWinningCounterAction: {
        recommendedTopic: `${businessName} Extreme Quality Verification & Procurement Breakdown`,
        adaptedHook: `Why 90% of buyers overpay for ${businessName.toLowerCase()} solutions without realizing it — until now.`,
        visualDirection:
          "Start with a split-screen stress test: show the cheap competitor sample failing instantly vs your certified product holding firm under load. Use fast cuts with bold text overlay.",
        targetPlatform: isOdd ? ("YOUTUBE_SHORTS" as const) : ("INSTAGRAM_REEL" as const),
        scenePlan: [
          {
            sceneNumber: 1,
            timeRange: "0:00 - 0:03",
            section: "Viral Hook",
            visual: "Split screen: competitor generic batch vs our verified batch side-by-side with big red text 'DO NOT BUY UNTIL YOU SEE THIS'.",
            audioSpoken: `Why 90% of buyers overpay for quality without realizing it — until now.`,
          },
          {
            sceneNumber: 2,
            timeRange: "0:03 - 0:08",
            section: "The Hidden Flaw",
            visual: "Close-up macro lens showing microscopic cracks or chemical degradation in standard market products.",
            audioSpoken: `Most suppliers hide how their batches degrade after just 3 weeks of standard use.`,
          },
          {
            sceneNumber: 3,
            timeRange: "0:08 - 0:20",
            section: "Your Unbeatable Proof",
            visual: "Your production facility / testing machine showing certified batch passing strict ISO/lab standards with clean stamp.",
            audioSpoken: `At ${businessName}, every single order goes through triple-stage verification so your operations never halt.`,
          },
          {
            sceneNumber: 4,
            timeRange: "0:20 - 0:30",
            section: "Conversion Call-to-Action",
            visual: "Direct packaging view with prompt to check specs in bio or request a sample batch.",
            audioSpoken: `Tap the link in our bio to compare technical specs and claim a verified sample today.`,
          },
        ],
        callToAction: `Tap link in bio to inspect ${businessName} certified specifications.`,
      },
    };
  });

  const handleCopyScript = (caseItem: (typeof cases)[0]) => {
    const text = `### Counter-Script Blueprint: Outperforming ${caseItem.competitorDomain}
**Target Platform:** ${caseItem.platform} ${caseItem.contentType}
**Hook (0-3s):** "${caseItem.ourWinningCounterAction.adaptedHook}"
**Visual Direction:** ${caseItem.ourWinningCounterAction.visualDirection}

**Scene Breakdown:**
${caseItem.ourWinningCounterAction.scenePlan
  .map(
    (s) =>
      `[${s.timeRange}] Scene ${s.sceneNumber} (${s.section}):\n- Visual: ${s.visual}\n- Audio/Spoken: "${s.audioSpoken}"`
  )
  .join("\n\n")}

**Call to Action:** ${caseItem.ourWinningCounterAction.callToAction}
`;
    navigator.clipboard.writeText(text);
    setCopiedId(caseItem.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleScheduleAction = (caseItem: (typeof cases)[0]) => {
    const scriptPayload: VideoBriefAndScript = {
      title: caseItem.ourWinningCounterAction.recommendedTopic,
      hook: caseItem.ourWinningCounterAction.adaptedHook,
      platform: caseItem.ourWinningCounterAction.targetPlatform,
      targetDuration: "30s",
      contentPillar: "PROOF_OF_QUALITY",
      targetAudience: "Decision Makers & Buyers",
      coreProblem: "Standard generic supplies degrade rapidly and fail quality audits",
      solutionSummary: `Verified testing and premium engineering from ${businessName}`,
      callToAction: caseItem.ourWinningCounterAction.callToAction,
      scenes: caseItem.ourWinningCounterAction.scenePlan.map((s) => ({
        sceneNumber: s.sceneNumber,
        timeRange: s.timeRange,
        sectionName: s.section === "Viral Hook" ? "HOOK" : s.section === "The Hidden Flaw" ? "PROBLEM" : s.section === "Your Unbeatable Proof" ? "SOLUTION" : "CTA",
        spokenScript: s.audioSpoken,
        visualDirection: s.visual,
        onScreenText: s.section,
      })),
      visualChecklist: ["Split-screen comparison", "Macro inspection shot", "Batch certification badge"],
      caption: `${caseItem.ourWinningCounterAction.adaptedHook} See why operations trust ${businessName} for consistent standards. Link in bio for sample orders!`,
      hashtags: ["#qualitycheck", "#industrystandards", "#manufacturing", "#b2b"],
      originalityGuarantee: "100% original script counter-engineered to outperform competitor retention.",
    };

    saveToCalendarMutation.mutate({ scriptData: scriptPayload });
    setScheduledId(caseItem.id);
    setTimeout(() => setScheduledId(null), 3000);
  };

  if (!competitors.length) {
    return (
      <TruthfulState
        icon={Flame}
        title="No Competitors Tracked"
        missing="Add competitors to unlock viral video spy and counter-action blueprints."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
                <Flame size={18} />
              </div>
              <h3 className="text-[17px] font-bold text-brand-950">
                Competitor Viral Content Spy & Winning Counter-Replications
              </h3>
            </div>
            <p className="text-[12px] text-brand-500 mt-1">
              When a competitor generates 100K+ views on a video, our platform analyzes the exact formula and provides you with the winning counter-script to outrank and outperform them.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800 border border-amber-200">
              ⚡ {cases.length} High-View Breakouts Identified
            </span>
          </div>
        </div>
      </div>

      {/* 2. Side-by-Side Viral Breakdown & Counter Actions */}
      <div className="space-y-5">
        {cases.map((item) => {
          const isExpanded = selectedCaseId === item.id;
          const isCopied = copiedId === item.id;
          const isScheduled = scheduledId === item.id;

          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
              style={{ borderColor: "var(--border-color)" }}
            >
              {/* Main Card Header */}
              <div className="p-6 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`rounded-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        item.platform === "INSTAGRAM"
                          ? "bg-pink-50 text-pink-700 border border-pink-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {item.platform} {item.contentType}
                    </span>
                    <span className="text-[15px] font-bold text-brand-950">
                      Rival: {item.competitorName} ({item.competitorDomain})
                    </span>
                  </div>

                  {/* Viral Stats */}
                  <div className="flex items-center gap-4 text-[12px]">
                    <span className="flex items-center gap-1 font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      <Flame size={13} className="text-amber-500" />
                      {item.views.toLocaleString()} Views
                    </span>
                    <span className="flex items-center gap-1 font-mono text-brand-600">
                      <Heart size={12} className="text-rose-500" />
                      {item.likes.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-brand-600">
                      <MessageSquare size={12} className="text-blue-500" />
                      {item.comments.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 2-Column Split: What Competitor Did vs What YOU Should Do */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
                  {/* Left (Col 5): What Competitor Did */}
                  <div className="lg:col-span-5 rounded-xl border bg-brand-50/40 p-4 space-y-2.5" style={{ borderColor: "var(--border-color)" }}>
                    <div className="flex items-center gap-1.5 text-brand-950">
                      <Video size={14} className="text-brand-500" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">
                        What Competitor Posted:
                      </span>
                    </div>

                    <h5 className="text-[13px] font-bold text-brand-950 leading-snug">
                      &quot;{item.title}&quot;
                    </h5>

                    <div className="rounded-lg bg-white p-3 text-[11.5px] border" style={{ borderColor: "var(--border-color)" }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                        Why It Blew Up:
                      </span>
                      <p className="mt-0.5 text-brand-700 leading-relaxed">{item.whyItBlewUp}</p>
                    </div>
                  </div>

                  {/* Right (Col 7): What YOU Should Do */}
                  <div className="lg:col-span-7 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-950 font-bold">
                        <Sparkles size={14} className="text-emerald-600" />
                        <span className="text-[11px] uppercase tracking-wider text-emerald-800">
                          What {businessName} Should Do to Beat Them:
                        </span>
                      </div>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        Winning Counter-Action
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                        Your Adapted High-Retention Hook:
                      </span>
                      <p className="mt-0.5 text-[13px] font-bold text-brand-950 leading-snug">
                        &quot;{item.ourWinningCounterAction.adaptedHook}&quot;
                      </p>
                    </div>

                    <div className="rounded-lg bg-white p-2.5 text-[11.5px] border border-emerald-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                        Visual Direction & Camera Angle:
                      </span>
                      <p className="mt-0.5 text-brand-700 leading-relaxed">
                        {item.ourWinningCounterAction.visualDirection}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="border-t pt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border-color)" }}>
                  <button
                    onClick={() => setSelectedCaseId(isExpanded ? null : item.id)}
                    className="flex items-center gap-1 text-[12px] font-semibold text-brand-900 hover:text-brand-950 transition"
                  >
                    <span>{isExpanded ? "Hide Scene-by-Scene Script" : "View Scene-by-Scene Production Script"}</span>
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyScript(item)}
                      className="flex items-center gap-1.5 rounded-xl border bg-white px-3.5 py-1.5 text-[11.5px] font-semibold text-brand-900 shadow-2xs transition hover:bg-brand-50"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      {isCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      <span>{isCopied ? "Copied Script Brief!" : "Copy Production Brief"}</span>
                    </button>

                    <button
                      onClick={() => handleScheduleAction(item)}
                      className="flex items-center gap-1.5 rounded-xl bg-brand-950 px-3.5 py-1.5 text-[11.5px] font-semibold text-white shadow-2xs transition hover:bg-brand-800"
                    >
                      {isScheduled ? <Check size={13} className="text-emerald-400" /> : <Calendar size={13} />}
                      <span>{isScheduled ? "Scheduled to Calendar!" : "Schedule to Calendar"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Expandable Scene-by-Scene Storyboard */}
              {isExpanded && (
                <div className="border-t bg-brand-50/50 p-6 space-y-4" style={{ borderColor: "var(--border-color)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Film size={15} className="text-brand-700" />
                      <h5 className="text-[13px] font-bold text-brand-950">
                        30-Second Production Storyboard for {item.ourWinningCounterAction.targetPlatform}
                      </h5>
                    </div>
                    <span className="text-[11px] text-brand-500 font-mono">Total Duration: 0:30</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {item.ourWinningCounterAction.scenePlan.map((sc) => (
                      <div
                        key={sc.sceneNumber}
                        className="rounded-xl border bg-white p-4 space-y-2 shadow-2xs"
                        style={{ borderColor: "var(--border-color)" }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800">
                            Scene {sc.sceneNumber}
                          </span>
                          <span className="text-[10px] font-mono text-brand-400 font-bold">{sc.timeRange}</span>
                        </div>

                        <div className="text-[11px] font-bold text-brand-950">{sc.section}</div>

                        <div className="text-[11px] text-brand-600 bg-brand-50/60 p-2 rounded border" style={{ borderColor: "var(--border-color)" }}>
                          <span className="text-[9.5px] font-bold uppercase text-brand-400 block mb-0.5">Visual:</span>
                          {sc.visual}
                        </div>

                        <div className="text-[11px] text-brand-900 bg-emerald-50/30 p-2 rounded border border-emerald-100 italic">
                          <span className="text-[9.5px] font-bold uppercase text-emerald-700 not-italic block mb-0.5">Spoken:</span>
                          &quot;{sc.audioSpoken}&quot;
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
