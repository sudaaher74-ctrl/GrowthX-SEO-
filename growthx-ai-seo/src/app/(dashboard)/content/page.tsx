"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ContentRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/content-opportunities?tab=drafts");
  }, [router]);

  return (
    <div className="flex h-40 items-center justify-center text-xs text-brand-400">
      Redirecting to Content & Opportunities (Drafts)...
    </div>
  );
}
