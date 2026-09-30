"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, api } from "@/lib/api-client";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  // The code is single-use, and Strict Mode runs effects twice in development.
  const started = useRef(false);

  useEffect(() => {
    // The redirect carries a one-time code, never the tokens: a URL lands in
    // history and logs. Drop it from the address bar as soon as it is read.
    const code = searchParams.get("code");
    if (code) window.history.replaceState(null, "", window.location.pathname);

    if (started.current) return;
    if (code) {
      started.current = true;
      // Auto-select an organization if possible
      api.exchangeLoginCode(code).then(
        () =>
      api.listOrganizations()
        .then(async (orgs) => {
          const orgId = orgs?.[0]?.id;
          if (orgId) {
            auth.setOrgId(orgId);
            
            const pendingDomain = localStorage.getItem("growthx_pending_domain");
            if (pendingDomain) {
              try {
                const proj = await api.createProject(pendingDomain, orgId);
                if (proj?.id) {
                  localStorage.setItem("growthx.project", proj.id);
                  try {
                    const url = pendingDomain.startsWith('http') ? pendingDomain : `https://${pendingDomain}`;
                    const website = await api.registerWebsite(url, pendingDomain, proj.id);
                    await api.startCrawl({ domain: website.domain });
                  } catch (crawlErr) {
                    console.error("Failed to start initial crawl", crawlErr);
                  }
                }
              } catch (err) {
                console.error("Failed to create pending project", err);
              }
              localStorage.removeItem("growthx_pending_domain");
            }
          }

          router.push("/dashboard");
        })
        .catch((err) => {
          console.error("Failed to list orgs after google login", err);
          // Fall back to dashboard on any error so user still lands somewhere useful
          router.push("/dashboard");
        }),
        (err) => {
          // The code was refused (expired or already used): there is no session to land on.
          console.error("Could not complete Google sign-in", err);
          setError("That sign-in link has expired. Please sign in again.");
          setTimeout(() => router.push("/login"), 3000);
        },
      );
    } else {
      setError("Authentication failed. Sign-in code not found.");
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
