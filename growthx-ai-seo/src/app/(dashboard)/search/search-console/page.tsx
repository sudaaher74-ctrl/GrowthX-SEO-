"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SearchConsoleRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/search-performance");
  }, [router]);

  return (
    <div className="flex h-40 items-center justify-center text-xs text-brand-400">
      Redirecting to Search Performance...
    </div>
  );
}
