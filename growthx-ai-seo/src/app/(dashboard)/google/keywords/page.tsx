import { Suspense } from "react";
import { KeywordsView } from "@/components/google/keywords-view";

export default function GoogleKeywordsViewPage() {
  return (
    <Suspense fallback={null}>
      <KeywordsView />
    </Suspense>
  );
}
