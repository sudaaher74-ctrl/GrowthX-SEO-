"use client";

/**
 * Error boundary for the routes outside the dashboard shell — login, register,
 * onboarding, auth callback and the legal pages. The dashboard has its own at
 * `(dashboard)/error.tsx` so it can keep the sidebar rendered.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] route crashed:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-red-200/60 bg-red-50 text-red-600">
          <AlertTriangle size={20} />
        </div>
        <h1 className="mt-4 text-[17px] font-extrabold tracking-tight text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
          We hit an unexpected error loading this page. Trying again usually clears it.
        </p>

        {error.digest && (
          <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
            Reference: {error.digest}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-[12px] font-bold text-white shadow-sm transition-colors hover:bg-purple-700"
          >
            <RotateCw size={13} />
            Try again
          </button>
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
