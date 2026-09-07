"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, api } from "@/lib/api-client";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A one-time code, not the session itself.
    //
    // Google's callback used to redirect here with `access_token` and
    // `refresh_token` in the query string, so a thirty-day refresh token was
    // written into the browser's history, sent in the `Referer` of anything
    // this page loaded, and recorded by every proxy along the way. The code
    // below authenticates nothing on its own and is dead within a minute.
    const code = searchParams.get("code");

    if (!code) {
      setError("Authentication failed. No sign-in code was returned.");
      const timer = setTimeout(() => router.push("/login"), 3000);
      return () => clearTimeout(timer);
    }

    let cancelled = false;

    (async () => {
      try {
        await api.exchangeOAuthCode(code);
      } catch {
        if (cancelled) return;
        setError("That sign-in link has expired. Redirecting you to sign in again…");
        setTimeout(() => router.push("/login"), 3000);
        return;
      }

      // Auto-select an organization if possible. A failure here is not a failed
      // sign-in — the session is already established — so the dashboard gets to
      // handle an unset workspace rather than the user being bounced back.
      try {
        const orgs = await api.listOrganizations();
        if (orgs?.[0]?.id) auth.setOrgId(orgs[0].id);
      } catch (err) {
        console.error("Failed to list orgs after google login", err);
      }

      if (!cancelled) router.push("/dashboard");
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <p className="text-gray-600 animate-pulse">Completing sign in...</p>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
