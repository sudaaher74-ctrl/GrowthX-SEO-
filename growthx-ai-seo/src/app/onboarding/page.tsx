"use client";

import { Suspense } from "react";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-sm text-blue-300 animate-pulse">Setting up your workspace…</p>
          </div>
        </div>
      }
    >
      <OnboardingWizard />
    </Suspense>
  );
}
