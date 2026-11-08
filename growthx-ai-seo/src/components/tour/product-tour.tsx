"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Compass,
  FileCode2,
  Globe,
  Radar,
  X,
  Zap,
} from "lucide-react";
import { useTour, TOUR_STEPS } from "@/hooks/use-tour";
import { cn } from "@/lib/utils";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function ProductTour() {
  const {
    isOpen,
    isWelcomeOpen,
    currentStep,
    step,
    totalSteps,
    startTour,
    nextStep,
    prevStep,
    closeTour,
    dismissWelcomeModal,
  } = useTour();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Recalculate target element position whenever step or window changes
  const updatePosition = useCallback(() => {
    if (!isOpen || !step) return;

    const el = document.querySelector(step.targetSelector);
    if (!el) {
      setTargetRect(null);
      setPopoverPos(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const padding = 6;
    const target = {
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    };
    setTargetRect(target);

    // Scroll element into view smoothly if offscreen
    if (rect.top < 60 || rect.bottom > window.innerHeight - 60) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Determine popover position
    const cardWidth = 360;
    const cardHeight = 220;
    const margin = 12;

    let left = target.left + target.width / 2 - cardWidth / 2;
    // Keep horizontally within viewport
    left = Math.max(16, Math.min(left, window.innerWidth - cardWidth - 16));

    let top: number;
    if (step.position === "bottom" || target.top < 260) {
      top = target.top + target.height + margin;
    } else {
      top = target.top - cardHeight - margin;
    }

    // Fallback if top overflows viewport
    if (top < 70) top = target.top + target.height + margin;
    if (top + cardHeight > window.innerHeight - 20) {
      top = Math.max(70, window.innerHeight - cardHeight - 20);
    }

    setPopoverPos({ top, left });
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen, step, updatePosition]);

  // Keyboard navigation for power users
  useEffect(() => {
    if (!isOpen && !isWelcomeOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isOpen) closeTour();
        else if (isWelcomeOpen) dismissWelcomeModal();
      } else if (isOpen) {
        if (e.key === "ArrowRight" || e.key === "Enter") {
          nextStep();
        } else if (e.key === "ArrowLeft") {
          prevStep();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isWelcomeOpen, nextStep, prevStep, closeTour, dismissWelcomeModal]);

  // =========================================================================
  // 1. WELCOME MODAL (FIRST-TIME USERS)
  // =========================================================================
  if (isWelcomeOpen) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-welcome-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/70 p-4 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      >
        <div className="relative w-full max-w-lg rounded-3xl border border-brand-200 bg-surface-1 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Ambient Glow */}
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full opacity-20 blur-3xl"
            style={{
              background: "radial-gradient(circle, rgba(212, 255, 0, 0.4) 0%, transparent 70%)",
            }}
          />

          {/* Close button */}
          <button
            type="button"
            onClick={dismissWelcomeModal}
            aria-label="Dismiss welcome dialog"
            className="absolute right-5 top-5 rounded-full p-1.5 text-brand-400 transition hover:bg-surface-2 hover:text-brand-950 cursor-pointer"
          >
            <X size={16} />
          </button>

          {/* Header Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-surface-2 px-3.5 py-1 text-xs font-semibold text-brand-700">
            <span className="flex h-2 w-2 rounded-full bg-signal-400 animate-pulse" />
            <span>Interactive Platform Tour</span>
          </div>

          <h2
            id="tour-welcome-title"
            className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-950"
          >
            Welcome to <span className="text-signal-400">Reigel.</span>
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-brand-500">
            Your autonomous SEO and AI visibility command center. Take a 1-minute guided tour to explore how Reigel maps sites, generates fixes, and tracks AI recommendations.
          </p>

          {/* 3 Core Highlights */}
          <div className="mt-5 space-y-2.5">
            <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-surface-2/60 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-1 text-signal-400 border border-brand-200">
                <Globe size={15} />
              </span>
              <div>
                <p className="text-xs font-bold text-brand-950">Autonomous Sitemap Spider &amp; Audit</p>
                <p className="text-[11px] text-brand-500">Every page, HTTP response, speed metric, and indexability signal mapped step by step.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-surface-2/60 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-1 text-signal-400 border border-brand-200">
                <FileCode2 size={15} />
              </span>
              <div>
                <p className="text-xs font-bold text-brand-950">Autonomous Code Engineer</p>
                <p className="text-[11px] text-brand-500">Finds SEO regressions and opens live PRs on your GitHub or CMS automatically.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-surface-2/60 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-1 text-signal-400 border border-brand-200">
                <Bot size={15} />
              </span>
              <div>
                <p className="text-xs font-bold text-brand-950">AI Search Engine Visibility</p>
                <p className="text-[11px] text-brand-500">Track citations and recommendations across ChatGPT, Perplexity, Gemini, and Claude.</p>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-brand-200/80">
            <button
              type="button"
              onClick={dismissWelcomeModal}
              className="w-full sm:w-auto text-xs font-semibold text-brand-500 hover:text-brand-950 transition cursor-pointer"
            >
              Skip tour &amp; explore
            </button>

            <button
              type="button"
              onClick={() => startTour(0)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-signal-400 px-5 py-2.5 text-xs font-extrabold text-signal-ink shadow-xs transition hover:bg-signal-500 active:scale-95 cursor-pointer"
            >
              <span>Start Interactive Tour</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. INTERACTIVE STEP-BY-STEP TOUR POPUP & SPOTLIGHT
  // =========================================================================
  if (!isOpen || !step) return null;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      {/* Darkened Spotlight Backdrop */}
      {targetRect ? (
        <svg
          className="absolute inset-0 h-full w-full pointer-events-auto transition-all duration-300"
          style={{ width: "100vw", height: "100vh" }}
        >
          <defs>
            <mask id="tour-spotlight-mask">
              {/* White background fills mask (visible overlay) */}
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {/* Black cutout reveals the targeted element */}
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="14"
                ry="14"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(9, 10, 13, 0.72)"
            mask="url(#tour-spotlight-mask)"
            onClick={closeTour}
          />
        </svg>
      ) : (
        <div
          className="absolute inset-0 bg-brand-950/70 backdrop-blur-xs transition-opacity"
          onClick={closeTour}
        />
      )}

      {/* Target Focus Ring with Signature Electric Lime Accent */}
      {targetRect && (
        <div
          className="pointer-events-none absolute rounded-2xl border-2 border-signal-400 transition-all duration-300 shadow-[0_0_24px_rgba(200,245,58,0.35)]"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      )}

      {/* Guided Popover Card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        className={cn(
          "absolute z-50 w-full max-w-[360px] rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xl backdrop-blur-xl transition-all duration-300",
          !popoverPos && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
        )}
        style={
          popoverPos
            ? {
                top: `${popoverPos.top}px`,
                left: `${popoverPos.left}px`,
              }
            : undefined
        }
      >
        {/* Top Header with Step Counter */}
        <div className="flex items-center justify-between border-b border-brand-200/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-signal-400 font-mono text-xs font-black text-signal-ink">
              R
            </span>
            <span className="font-mono text-xs font-bold text-brand-950">
              Step {currentStep + 1} of {totalSteps}
            </span>
            {step.badge && (
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-brand-600 border border-brand-200">
                {step.badge}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={closeTour}
            aria-label="Exit tour"
            title="Exit tour (Esc)"
            className="rounded-md p-1 text-brand-400 transition hover:bg-surface-2 hover:text-brand-950 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Step Title & Description */}
        <div className="mt-3.5">
          <h3
            id="tour-step-title"
            className="text-sm font-bold tracking-tight text-brand-950"
          >
            {step.title}
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-brand-600">
            {step.description}
          </p>
        </div>

        {/* Step Progress Dots */}
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-brand-200/80">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => startTour(idx)}
                aria-label={`Jump to step ${idx + 1}: ${s.title}`}
                className={cn(
                  "h-1.5 rounded-full transition-all cursor-pointer",
                  idx === currentStep
                    ? "w-5 bg-signal-400"
                    : "w-1.5 bg-brand-300 hover:bg-brand-400",
                )}
              />
            ))}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={prevStep}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-surface-3 transition cursor-pointer"
              >
                <ArrowLeft size={12} />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={nextStep}
              className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-1.5 text-xs font-extrabold text-signal-ink shadow-xs transition hover:bg-signal-500 active:scale-95 cursor-pointer"
            >
              <span>{isLastStep ? "Got it!" : "Next"}</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
