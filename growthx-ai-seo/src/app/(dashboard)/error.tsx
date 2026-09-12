"use client";

/**
 * Error boundary for every dashboard route.
 *
 * This wraps the pages under `(dashboard)` but not the layout above them, so a
 * crash in one screen leaves the sidebar, the workspace switcher and the rest
 * of the shell intact — the customer loses one panel instead of the whole app.
 *
 * It exists because a single bad hook in the Fix Engine once blanked the entire
 * product with the browser's "This page couldn't load" screen, giving the user
 * nowhere to go and us nothing to read.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw, LayoutDashboard } from "lucide-react";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Production strips the message off server-thrown errors, so the digest is
    // the only handle that ties this screen to the server log.
    console.error("[dashboard] route crashed:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-200/60 bg-red-50 text-red-600">
            <AlertTriangle size={19} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[17px] font-extrabold tracking-tight text-slate-900">
              This screen ran into a problem
            </h1>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
              The rest of your workspace is still running — you can retry this screen or head
              back to the dashboard. Nothing you had saved was lost.
            </p>
          </div>
        </div>

        {error.digest && (
          <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
            Reference: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-[12px] font-bold text-white shadow-sm transition-colors hover:bg-purple-700"
          >
            <RotateCw size={13} />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <LayoutDashboard size={13} />
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
