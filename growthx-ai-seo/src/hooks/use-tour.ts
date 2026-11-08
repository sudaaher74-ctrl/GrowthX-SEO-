"use client";

import { useEffect, useSyncExternalStore } from "react";

export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  badge?: string;
  position?: "bottom" | "top" | "left" | "right" | "auto";
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "workspace",
    targetSelector: '[data-tour="workspace-switcher"]',
    title: "Client Workspaces & Domains",
    description:
      "Switch between client websites or add a new root domain. All audits, crawl logs, and fixes are strictly isolated per client.",
    badge: "Multi-Client",
    position: "bottom",
  },
  {
    id: "website-audit",
    targetSelector: '[data-tour="nav-website"]',
    title: "Autonomous Website Audit",
    description:
      "Inspect all crawled pages, response speeds, HTTP status codes, and indexability errors mapped step-by-step in real time.",
    badge: "Crawler",
    position: "right",
  },
  {
    id: "fix-engine",
    targetSelector: '[data-tour="nav-fix-engine"]',
    title: "Autonomous 1-Click Code Fixes",
    description:
      "Reigel doesn't just list issues — our Autonomous Engineer generates code patches and opens pull requests directly on your GitHub or CMS.",
    badge: "Autonomous",
    position: "right",
  },
  {
    id: "ai-visibility",
    targetSelector: '[data-tour="nav-ai-visibility"]',
    title: "AI Search & Citation Tracking",
    description:
      "Track how leading AI search models (Perplexity, ChatGPT, Gemini, Claude) recommend your brand and products against competitors.",
    badge: "AI Visibility",
    position: "right",
  },
  {
    id: "credits",
    targetSelector: '[data-tour="credits-chip"]',
    title: "Real-Time Compute Credits",
    description:
      "Keep track of your active crawl and AI engine compute credits. Live refills and telemetry update in real time.",
    badge: "Telemetry",
    position: "bottom",
  },
  {
    id: "command-search",
    targetSelector: '[data-tour="command-search"]',
    title: "Instant Command Search (⌘K)",
    description:
      "Press ⌘K anywhere on the platform to jump directly to any audit report, client finding, or platform action instantly.",
    badge: "Quick Actions",
    position: "bottom",
  },
];

interface TourState {
  isOpen: boolean;
  isWelcomeOpen: boolean;
  currentStep: number;
}

const STORAGE_KEY = "reigel_tour_completed";

let state: TourState = {
  isOpen: false,
  isWelcomeOpen: false,
  currentStep: 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): TourState {
  return state;
}

export function startTour(initialStep = 0) {
  state = {
    ...state,
    isOpen: true,
    isWelcomeOpen: false,
    currentStep: Math.max(0, Math.min(initialStep, TOUR_STEPS.length - 1)),
  };
  notify();
}

export function nextStep() {
  if (state.currentStep < TOUR_STEPS.length - 1) {
    state = {
      ...state,
      currentStep: state.currentStep + 1,
    };
    notify();
  } else {
    completeTour();
  }
}

export function prevStep() {
  if (state.currentStep > 0) {
    state = {
      ...state,
      currentStep: state.currentStep - 1,
    };
    notify();
  }
}

export function closeTour() {
  state = {
    ...state,
    isOpen: false,
    isWelcomeOpen: false,
  };
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {}
  notify();
}

export function completeTour() {
  closeTour();
}

export function openWelcomeModal() {
  state = {
    ...state,
    isWelcomeOpen: true,
    isOpen: false,
  };
  notify();
}

export function dismissWelcomeModal() {
  state = {
    ...state,
    isWelcomeOpen: false,
  };
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {}
  notify();
}

export function resetTour() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  startTour(0);
}

export function useTour() {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => state);

  // Auto-prompt new visitors if they haven't completed or dismissed the tour yet
  useEffect(() => {
    try {
      const completed = localStorage.getItem(STORAGE_KEY);
      if (!completed && !state.isOpen && !state.isWelcomeOpen) {
        // Wait 1.5s for initial render and data to settle before showing welcome prompt
        const timer = setTimeout(() => {
          if (!localStorage.getItem(STORAGE_KEY)) {
            openWelcomeModal();
          }
        }, 1500);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  return {
    isOpen: current.isOpen,
    isWelcomeOpen: current.isWelcomeOpen,
    currentStep: current.currentStep,
    step: TOUR_STEPS[current.currentStep],
    totalSteps: TOUR_STEPS.length,
    startTour,
    nextStep,
    prevStep,
    closeTour,
    completeTour,
    openWelcomeModal,
    dismissWelcomeModal,
    resetTour,
  };
}
