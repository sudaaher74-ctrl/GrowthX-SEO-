"use client";

import Link from "next/link";
import { Wrench, ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/console";

/**
 * The Fix Engine is switched off. Its screen marked fixes "Applied & Verified"
 * after a timer, without changing or re-checking the customer's site, so it is
 * closed here the same way Design Studio is, and remediation runs through the
 * Action Queue.
 */
export default function FixEnginePage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto py-8">
      <PageHeader title="Fix Engine" subtitle="Automated code fixes for crawl findings." />
      <Panel padded>
        <div className="py-12 px-6 text-center space-y-4 max-w-md mx-auto">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <Wrench size={24} />
          </div>
          <h3 className="text-base font-bold text-brand-950">Fix Engine is Disabled</h3>
          <p className="text-xs text-brand-600 leading-relaxed">
            Automated fixes are currently disabled for this workspace. Follow your SEO Action Queue for prioritized
            technical and content recommendations, each with the pages it affects.
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
