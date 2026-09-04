"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default function AddBusinessPage() {
  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-2">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-600 hover:text-brand-950 transition"
        >
          <ArrowLeft size={14} />
          Back to Projects
        </Link>
      </div>

      <OnboardingWizard />
    </div>
  );
}
