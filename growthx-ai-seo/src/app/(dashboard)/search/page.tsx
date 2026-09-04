"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SearchRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/ai-visibility");
  }, [router]);

  return (
    <div className="flex h-40 items-center justify-center text-xs text-brand-400">
      Redirecting to AI Visibility...
    </div>
  );
}
