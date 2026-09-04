"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ContentIntelligenceRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/content-opportunities?tab=keyword-gaps");
  }, [router]);

  return (
    <div className="flex h-40 items-center justify-center text-xs text-brand-400">
      Redirecting to Content & Opportunities (Keyword Gaps)...
    </div>
  );
}
