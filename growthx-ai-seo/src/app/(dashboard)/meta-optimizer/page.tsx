"use client";
import { IssueTypeView } from "@/components/issues/IssueTypeView";

const TYPES = new Set([
  "MISSING_TITLE",
  "LONG_TITLE",
  "SHORT_TITLE",
  "DUPLICATE_TITLE",
  "MISSING_META_DESCRIPTION",
]);

export default function MetaOptimizerPage() {
  return (
    <IssueTypeView
      title="Meta optimizer"
      subtitle="Title and meta description issues from the latest crawl"
      matches={(t) => TYPES.has(t)}
      kpis={[
        { label: "Title issues", match: (t) => t.includes("TITLE") },
        { label: "Missing descriptions", match: (t) => t === "MISSING_META_DESCRIPTION" },
      ]}
      emptyBody="No title or meta description issues on this crawl."
    />
  );
}
