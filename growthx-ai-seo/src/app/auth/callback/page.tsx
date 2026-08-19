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
        .then(orgs => {
          if (orgs?.[0]?.id) auth.setOrgId(orgs[0].id);
          router.push("/dashboard");
        })
        .catch(err => {
          console.error("Failed to list orgs after google login", err);
          router.push("/dashboard"); // Still go to dashboard, let it handle empty orgs
        });
    } else {
      setError("Authentication failed. Tokens not found.");
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    }
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
