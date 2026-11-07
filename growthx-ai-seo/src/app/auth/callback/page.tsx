"use client";
import { useEffect, useRef, useState, Suspense } from "react";
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
          setTimeout(() => router.push("/login"), 3000);
        },
      );
    } else {
      const timer = setTimeout(() => {
        router.push("/login");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-950 text-brand-50">
      <div className="text-center">
        {error ? (
          <p className="text-sm text-error-400">{error}</p>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-series-6 border-t-transparent" />
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
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-series-6 border-t-transparent" />
            <p className="animate-pulse text-sm text-brand-300">Completing sign in…</p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
