"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OpportunitiesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/content-opportunities");
  }, [router]);

  return (
    <div className="flex h-40 items-center justify-center text-xs text-brand-400">
      Redirecting to Content & Opportunities...
    </div>
  );
}
