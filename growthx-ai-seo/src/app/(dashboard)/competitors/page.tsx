"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CompetitorsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/competitor-intelligence");
  }, [router]);

  return (
    <div className="flex h-40 items-center justify-center text-xs text-brand-400">
      Redirecting to Competitor Intelligence...
    </div>
  );
}
