"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, api } from "@/lib/api-client";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("code") ? null : "Authentication failed. Sign-in code not found.",
  );
  // The code is single-use, and Strict Mode runs effects twice in development.
  const started = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) window.history.replaceState(null, "", window.location.pathname);

    if (started.current) return;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    if (code) {
      started.current = true;
      api.exchangeLoginCode(code).then(
        () =>
          api
            .listOrganizations()
            .then(async (orgs) => {
              const orgId = orgs?.[0]?.id;
              if (orgId) {
                auth.setOrgId(orgId);
              }

              let pendingDomain = "";
              try {
                pendingDomain = (localStorage.getItem("growthx_pending_domain") || "").trim();
              } catch {}

              if (pendingDomain) {
                router.push(`/analyze?url=${encodeURIComponent(pendingDomain)}`);
                return;
              }

              const existingProjects = orgId ? await api.listProjects(orgId).catch(() => []) : [];
              if (!existingProjects || existingProjects.length === 0) {
                router.push("/analyze");
                return;
              }

              router.push("/dashboard");
            })
            .catch((err) => {
              console.error("Failed to list orgs after google login", err);
              router.push("/analyze");
            }),
        (err) => {
          console.error("Could not complete Google sign-in", err);
          setError("That sign-in link has expired. Please sign in again.");
          redirectTimer = setTimeout(() => router.push("/login"), 4000);
        },
      );
    } else {
      redirectTimer = setTimeout(() => {
        router.push("/login");
      }, 4000);
    }

    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-950 px-4 text-brand-50">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-error-500/40 bg-brand-900/90 p-6 shadow-xl space-y-4"
          >
            <p className="text-sm font-medium text-error-400">{error}</p>
            <p className="text-xs text-brand-400">
              Redirecting back to sign in…
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-signal-400 px-5 py-2.5 text-xs font-extrabold text-signal-ink hover:bg-signal-500 transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-signal-400 border-t-transparent" />
            <p className="animate-pulse text-sm text-brand-300">Completing sign in…</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-brand-950 text-brand-50">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-signal-400 border-t-transparent" />
            <p className="animate-pulse text-sm text-brand-300">Completing sign in…</p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
