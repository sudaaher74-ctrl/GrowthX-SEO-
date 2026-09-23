"use client";

import Link from "next/link";
import { Wand2, ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/console";

export default function DesignStudioPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto py-8">
      <PageHeader
        title="Design Studio"
        subtitle="Visual on-page content editing and real-time element remediation."
      />
      <Panel padded>
        <div className="py-12 px-6 text-center space-y-4 max-w-md mx-auto">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <Wand2 size={24} />
          </div>
          <h3 className="text-base font-bold text-brand-950">Design Studio is Disabled</h3>
          <p className="text-xs text-brand-600 leading-relaxed">
            Visual page modifications and direct on-page element overwrites are currently disabled for this workspace. Please follow your SEO Action Queue for prioritized technical and content recommendations.
          </p>
          <div className="pt-2">
            <Link
              href="/action-queue"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 text-white px-3.5 py-2 text-xs font-semibold hover:bg-brand-900 transition"
            >
              <ArrowLeft size={13} />
              <span>Go to Action Queue</span>
            </Link>
          </div>
        </div>
      </Panel>
    </div>
  );
}
