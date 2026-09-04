"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MarketResearchRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/competitor-intelligence?tab=market-trends");
  }, [router]);

  return (
    <div className="flex h-40 items-center justify-center text-xs text-brand-400">
      Redirecting to Competitor Intelligence (Market Trends)...
    </div>
  );
}
