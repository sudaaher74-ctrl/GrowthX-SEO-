import { Suspense } from "react";
import { PagesView } from "@/components/google/pages-view";

// The view reads the URL (segment and selected page), so it sits inside a Suspense boundary.
export default function GooglePagesPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl border bg-brand-100" />}>
      <PagesView />
    </Suspense>
  );
}
