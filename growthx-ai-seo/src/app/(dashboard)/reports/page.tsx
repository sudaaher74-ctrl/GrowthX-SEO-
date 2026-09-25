"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The separate Reports section is gone: every section now has its own Full
 * Report to read and download. Old links land on the Website Audit report.
 */
export default function ReportsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/website?tab=report");
  }, [router]);

  return (
    <div className="flex h-40 items-center justify-center text-xs text-brand-400">
      Reports now live in each section. Opening your website report…
    </div>
  );
}
