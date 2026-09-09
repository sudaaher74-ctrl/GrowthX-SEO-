"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, api } from "@/lib/api-client";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    if (accessToken && refreshToken) {
      auth.setToken(accessToken);
      auth.setRefreshToken(refreshToken);

      // Auto-select an organization if possible
      api.listOrganizations()
        .then((orgs) => {
          const orgId = orgs?.[0]?.id;
          if (orgId) auth.setOrgId(orgId);

          // Check if this user has already completed onboarding.
          // We key the flag on the first project (or org) so that new
          // accounts always see the onboarding wizard.
          const projectId = localStorage.getItem("growthx.project") || orgId || "";
          const onboardingDone =
            projectId
              ? localStorage.getItem(`growthx_onboarding_done_${projectId}`) === "true"
              : false;

          if (onboardingDone) {
            router.push("/dashboard");
          } else {
            router.push("/onboarding");
          }
        })
        .catch((err) => {
          console.error("Failed to list orgs after google login", err);
          // Fall back to onboarding on any error so user still lands somewhere useful
          router.push("/onboarding");
        });
    } else {
      setError("Authentication failed. Tokens not found.");
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    }
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-[#0c1a35] to-slate-950">
      <div className="text-center">
        {error ? (
          <p className="text-rose-400 text-sm">{error}</p>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-sm text-blue-300 animate-pulse">Completing sign in…</p>
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
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-[#0c1a35] to-slate-950">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-sm text-blue-300 animate-pulse">Completing sign in…</p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
