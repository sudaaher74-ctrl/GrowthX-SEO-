"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ContentVelocityPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center text-xs text-brand-400">
      Redirecting to Dashboard...
    </div>
  );
}
