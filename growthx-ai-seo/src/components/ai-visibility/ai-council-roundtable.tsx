"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  Globe,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  Cpu,
  Layers,
  HelpCircle,
  TrendingUp,
  ShieldCheck,
  Send,
  Loader2,
  Check,
  Share2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActionButton, Pill } from "@/components/ui/console";
import {
  useAiCouncil,
  useAskCouncil,
  useWorkspace,
  usePortfolio,
  useLatestCrawl,
} from "@/hooks/use-growthx";
import type {
  CouncilDiscussionReport,
  CouncilDialogueTurn,
  CouncilSpeaker,
  CouncilActionPillar,
} from "@/lib/api-client";

interface AiCouncilRoundtableProps {
  projectId: string;
  domain?: string;
  businessName?: string;
}

const PRESET_TOPICS = [
  "How do we outrank our top competitor in AI search?",
  "How to get cited in Google AI Overviews?",
  "What quotable definition blocks should we write first?",
  "How to convert users recommended by ChatGPT?",
];

const SPEAKER_THEMES: Record<
  string,
  {
    bg: string;
    border: string;
    pillBg: string;
    pillText: string;
    accentText: string;
    icon: React.ElementType;
    badgeBg: string;
  }
> = {
  claude: {
    bg: "bg-amber-50/50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-900/60",
    pillBg: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300",
    pillText: "text-amber-800 dark:text-amber-300",
    accentText: "text-amber-700 dark:text-amber-400",
    icon: Sparkles,
    badgeBg: "bg-amber-500",
  },
  chatgpt: {
    bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-900/60",
    pillBg: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300",
    pillText: "text-emerald-800 dark:text-emerald-300",
    accentText: "text-emerald-700 dark:text-emerald-400",
    icon: Zap,
    badgeBg: "bg-emerald-500",
  },
  gemini: {
    bg: "bg-blue-50/50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-900/60",
    pillBg: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300",
    pillText: "text-blue-800 dark:text-blue-300",
    accentText: "text-blue-700 dark:text-blue-400",
    icon: Globe,
    badgeBg: "bg-blue-500",
  },
};

export function AiCouncilRoundtable({ projectId, domain, businessName }: AiCouncilRoundtableProps) {
  const [customTopic, setCustomTopic] = useState<string>("");
  const [activeTopic, setActiveTopic] = useState<string | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2>(1);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);
  const [showFullTranscript, setShowFullTranscript] = useState<boolean>(false);

  const councilQuery = useAiCouncil(projectId, activeTopic);
  const askCouncilMutation = useAskCouncil(projectId);

  const data: CouncilDiscussionReport | undefined = councilQuery.data;

  const dialogue = useMemo(() => data?.dialogue || [], [data]);
  const participants = useMemo(() => data?.participants || [], [data]);
  const collaborativePlan = useMemo(() => data?.collaborativePlan || [], [data]);

  // Autoplay timer
  useEffect(() => {
    if (!isPlaying || showFullTranscript || dialogue.length === 0) return;

    const intervalTime = playbackSpeed === 1 ? 4200 : 2200;
    const timer = setInterval(() => {
      setCurrentTurnIndex((prev) => {
        if (prev < dialogue.length - 1) {
          return prev + 1;
        } else {
          setIsPlaying(false);
          return prev;
        }
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, dialogue.length, showFullTranscript]);

  const handleAskQuestion = async (e?: React.FormEvent, preset?: string) => {
    if (e) e.preventDefault();
    const topicToAsk = preset || customTopic.trim();
    if (!topicToAsk || askCouncilMutation.isPending) return;

    setActiveTopic(topicToAsk);
    setCurrentTurnIndex(0);
    setIsPlaying(true);
    setShowFullTranscript(false);

    try {
      await askCouncilMutation.mutateAsync(topicToAsk);
      setCustomTopic("");
    } catch (err) {
      console.error("Failed to query council:", err);
    }
  };

  const handleRestart = () => {
    setCurrentTurnIndex(0);
    setIsPlaying(true);
  };

  const activeTurn = dialogue[currentTurnIndex];
  const activeSpeakerId = activeTurn?.speaker || "claude";

  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-white to-brand-50/40 p-5 sm:p-6 shadow-sm transition-all"
      style={{ borderColor: "var(--border-color)" }}
    >
      {/* Decorative ambient background */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-accent-50/50 blur-3xl opacity-60" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-amber-50/40 blur-3xl opacity-60" />

      {/* Header Banner */}
      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b pb-5" style={{ borderColor: "var(--color-brand-100)" }}>
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-950 text-white shadow-xs">
              <Cpu size={15} />
            </div>
            <h3 className="text-base font-bold tracking-tight text-brand-950">
              The AI Intelligence Council: Claude × ChatGPT × Gemini
            </h3>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Deliberation Active
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-brand-600 leading-relaxed max-w-2xl">
            Watch the world's 3 premier AI reasoning engines debate {businessName ? <strong>{businessName}</strong> : "your business"}&apos;s authority, critique blind spots, and collaboratively engineer a plan to capture more customers.
          </p>
        </div>

        {/* Action button: Restart / Instant Read */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFullTranscript(!showFullTranscript)}
            className="text-xs h-8"
          >
            {showFullTranscript ? "Step-by-Step Mode" : "Read Full Transcript"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => councilQuery.refetch()}
            disabled={councilQuery.isFetching}
            className="text-xs h-8"
          >
            <RotateCcw size={12} className={cn("mr-1", councilQuery.isFetching && "animate-spin")} />
            Re-deliberate
          </Button>
        </div>
      </div>

      {/* The 3 AI Council Participants Row */}
      <div className="relative z-10 mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        {participants.length > 0 ? (
          participants.map((speaker) => {
            const theme = SPEAKER_THEMES[speaker.id] || SPEAKER_THEMES.claude;
            const isSpeaking = activeSpeakerId === speaker.id && isPlaying && !showFullTranscript;
            const Icon = theme.icon;

            return (
              <div
                key={speaker.id}
                className={cn(
                  "relative rounded-xl border p-3.5 transition-all duration-300",
                  theme.bg,
                  theme.border,
                  isSpeaking ? "ring-2 ring-brand-950/20 shadow-md scale-[1.01]" : "opacity-90"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs border" style={{ borderColor: "var(--border-color)" }}>
                    <Icon size={16} className={theme.accentText} />
                    {isSpeaking && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-bold text-brand-950 truncate">
                        {speaker.name}
                      </h4>
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold", theme.pillBg)}>
                        {speaker.provider}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-brand-700 mt-0.5 truncate">
                      {speaker.roleTitle}
                    </p>
                    <p className="text-[10.5px] text-brand-500 mt-1 line-clamp-2 leading-relaxed">
                      {speaker.corePhilosophy}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-3 py-6 text-center text-xs text-brand-400">
            <Loader2 size={16} className="inline animate-spin mr-2" /> Initializing AI Intelligence Council...
          </div>
        )}
      </div>

      {/* Main Deliberation Stage */}
      <div className="relative z-10 mt-6 rounded-xl border bg-white p-4 sm:p-5 shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
        {/* Stage Subheader & Playback Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3.5" style={{ borderColor: "var(--color-brand-100)" }}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
              Council Chamber
            </span>
            <span className="text-brand-300">•</span>
            <span className="text-[12px] font-medium text-brand-800">
              {data?.topic || "Comprehensive Business Assessment"}
            </span>
          </div>

          {!showFullTranscript && dialogue.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-brand-400 mr-2">
                Turn {currentTurnIndex + 1} of {dialogue.length}
              </span>

              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex h-7 w-7 items-center justify-center rounded-md border text-brand-700 hover:bg-brand-50 transition"
                style={{ borderColor: "var(--border-color)" }}
                title={isPlaying ? "Pause conversation" : "Play conversation"}
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className="flex h-7 w-7 items-center justify-center rounded-md border text-brand-700 hover:bg-brand-50 transition"
                style={{ borderColor: "var(--border-color)" }}
                title="Restart dialogue"
              >
                <RotateCcw size={12} />
              </button>

              <button
                type="button"
                onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 2 : 1)}
                className="flex h-7 px-2 items-center justify-center rounded-md border text-[11px] font-mono font-bold text-brand-700 hover:bg-brand-50 transition"
                style={{ borderColor: "var(--border-color)" }}
                title="Toggle playback speed"
              >
                {playbackSpeed}x
              </button>
            </div>
          )}
        </div>

        {/* Dialogue Stream */}
        <div className="mt-4">
          {showFullTranscript ? (
            /* Full Transcript Mode */
            <div className="space-y-4">
              {dialogue.map((turn, idx) => {
                const theme = SPEAKER_THEMES[turn.speaker] || SPEAKER_THEMES.claude;
                const Icon = theme.icon;

                return (
                  <motion.div
                    key={turn.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                    className={cn(
                      "flex gap-3.5 rounded-xl border p-4 transition-all",
                      theme.bg,
                      theme.border
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-2xs border" style={{ borderColor: "var(--border-color)" }}>
                      <Icon size={16} className={theme.accentText} />
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[13px] font-bold text-brand-950">
                          {turn.speakerName}
                        </span>
                        {turn.referencedMetric && (
                          <span className="rounded-full bg-white/80 border px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-700" style={{ borderColor: "var(--border-color)" }}>
                            {turn.referencedMetric}
                          </span>
                        )}
                      </div>

                      <p className="text-[12.5px] leading-relaxed text-brand-800 font-normal">
                        {turn.message}
                      </p>

                      {turn.targetedInsight && (
                        <div className="pt-1 flex items-center gap-1.5 text-[11px] font-semibold text-brand-500">
                          <CheckCircle2 size={12} className="text-accent-600" />
                          <span>Core Takeaway: {turn.targetedInsight}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* Step-by-Step Live Stage Mode */
            <div className="min-h-[190px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {activeTurn && (
                  <motion.div
                    key={activeTurn.id}
                    initial={{ opacity: 0, y: 10, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.99 }}
                    transition={{ duration: 0.28 }}
                    className={cn(
                      "rounded-xl border p-5 transition-all shadow-xs",
                      SPEAKER_THEMES[activeTurn.speaker]?.bg || "bg-brand-50",
                      SPEAKER_THEMES[activeTurn.speaker]?.border || "border-brand-200"
                    )}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-2xs border" style={{ borderColor: "var(--border-color)" }}>
                        {(() => {
                          const Icon = SPEAKER_THEMES[activeTurn.speaker]?.icon || Sparkles;
                          return <Icon size={18} className={SPEAKER_THEMES[activeTurn.speaker]?.accentText} />;
                        })()}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-[13.5px] font-bold text-brand-950">
                              {activeTurn.speakerName}
                            </span>
                            <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                              {activeTurn.phase.replace("_", " ")}
                            </span>
                          </div>

                          {activeTurn.referencedMetric && (
                            <span className="rounded-full bg-white border px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-brand-700 shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
                              {activeTurn.referencedMetric}
                            </span>
                          )}
                        </div>

                        <p className="text-[13px] leading-relaxed text-brand-900 font-medium">
                          &ldquo;{activeTurn.message}&rdquo;
                        </p>

                        {activeTurn.targetedInsight && (
                          <div className="pt-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-600">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-accent-600" />
                            <span>Insight: {activeTurn.targetedInsight}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Progress Dots Indicator */}
              <div className="mt-4 flex items-center justify-center gap-1.5">
                {dialogue.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentTurnIndex(idx);
                      setIsPlaying(false);
                    }}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      idx === currentTurnIndex
                        ? "w-6 bg-brand-950"
                        : "w-1.5 bg-brand-200 hover:bg-brand-400"
                    )}
                    title={`Jump to turn ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* "Ask the AI Council" Question Box */}
      <div className="relative z-10 mt-5 rounded-xl border bg-white p-4 sm:p-5" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-2 mb-2.5">
          <MessageSquare size={14} className="text-accent-600" />
          <h4 className="text-[12.5px] font-bold text-brand-950">
            Ask the AI Council a Custom Question
          </h4>
          <span className="text-[11px] text-brand-400 ml-auto">
            Claude, ChatGPT &amp; Gemini will deliberate your question
          </span>
        </div>

        {/* Preset Prompt Pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESET_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => handleAskQuestion(undefined, topic)}
              className="rounded-lg border bg-brand-50/70 hover:bg-brand-100/70 px-2.5 py-1 text-[11px] font-medium text-brand-700 transition"
              style={{ borderColor: "var(--color-brand-100)" }}
            >
              {topic}
            </button>
          ))}
        </div>

        {/* Question Input Form */}
        <form onSubmit={handleAskQuestion} className="flex gap-2">
          <input
            type="text"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="e.g., How should we position our pricing against our top competitors to win more deals?"
            className="flex-1 rounded-lg border px-3.5 py-2 text-[12.5px] text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
            style={{ borderColor: "var(--border-color)" }}
          />
          <ActionButton
            variant="primary"
            disabled={!customTopic.trim() || askCouncilMutation.isPending}
            icon={askCouncilMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          >
            {askCouncilMutation.isPending ? "Deliberating..." : "Deliberate Question"}
          </ActionButton>
        </form>
      </div>

      {/* Tri-Engine Collaborative Action Plan */}
      {collaborativePlan.length > 0 && (
        <div className="relative z-10 mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3" style={{ borderColor: "var(--color-brand-100)" }}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              <h4 className="text-[13.5px] font-bold text-brand-950">
                Council Consensus Action Plan {data?.consensusScorePct != null ? `(${data.consensusScorePct}% Model Agreement)` : ""}
              </h4>
            </div>
            <p className="text-[11.5px] text-brand-500">
              Joint roadmap formulated by Claude, ChatGPT &amp; Gemini to capture market share
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {collaborativePlan.map((pillar) => (
              <div
                key={pillar.step}
                className="rounded-xl border bg-white p-4 shadow-2xs space-y-3 transition-all hover:shadow-xs"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-950 font-mono text-[10px] font-bold text-white">
                      {pillar.step}
                    </span>
                    <span className="text-[12.5px] font-bold text-brand-950">
                      {pillar.title}
                    </span>
                  </div>
                  <span className="rounded bg-accent-50 border border-accent-200 px-1.5 py-0.5 text-[9.5px] font-semibold text-accent-700 shrink-0">
                    Impact: {pillar.impactScore}/100
                  </span>
                </div>

                <div className="space-y-1 text-[11.5px]">
                  <p className="text-brand-700 leading-relaxed">
                    <strong className="text-brand-950">Objective:</strong> {pillar.objective}
                  </p>
                  <p className="text-brand-500 leading-relaxed">
                    <strong className="text-brand-800">Why it matters:</strong> {pillar.whyItMatters}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "var(--color-brand-100)" }}>
                  <span className="text-[10.5px] font-mono text-brand-400">
                    Lead: {pillar.leadSpeakerName} ({pillar.timeframe})
                  </span>

                  <Link
                    href={pillar.actionHref}
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-600 hover:text-accent-700 transition"
                  >
                    Deploy in Fix Engine <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
