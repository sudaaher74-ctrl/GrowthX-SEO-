"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * The app had no error boundary at all, so a thrown render error left a blank
 * white page with no way forward except the browser's back button.
 *
 * `unstable_retry` re-fetches and re-renders the segment; `reset` (the older
 * prop) only clears the error state without re-fetching, which for this app —
 * where render errors come from data — would usually just throw again.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-error-50 text-error-600">
        <AlertTriangle size={22} />
      </span>
      <h1 className="mt-4 text-[20px] font-bold tracking-[-0.02em] text-brand-950">This page didn&apos;t load</h1>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-brand-500">
        Something went wrong while rendering it. Retrying re-fetches the data — if it keeps failing, the workspace
        may be mid-sync.
      </p>

      {/* The digest is the only handle support has on a production error, where
          the message itself is withheld from the client. */}
      {error.digest && <p className="mt-3 font-mono text-[11px] text-brand-400">Reference: {error.digest}</p>}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => unstable_retry()}
          className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          <RotateCw size={12} />
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
        >
          Back to overview
        </Link>
      </div>
    </div>
  );
}
