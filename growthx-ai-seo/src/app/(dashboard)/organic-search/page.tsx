import { Suspense } from "react";
import { KeywordsView } from "@/components/google/keywords-view";

export default function OrganicSearchPage() {
  return (
    <Suspense fallback={null}>
      <KeywordsView />
    </Suspense>
  );
}
