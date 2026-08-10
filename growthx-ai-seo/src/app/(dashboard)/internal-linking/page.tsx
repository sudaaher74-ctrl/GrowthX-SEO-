"use client";
import { IssueTypeView } from "@/components/issues/IssueTypeView";

const TYPES = new Set(["ORPHAN_PAGE", "BROKEN_LINK_4XX", "SERVER_ERROR_5XX", "REDIRECT_CHAIN", "REDIRECT_LOOP"]);

export default function InternalLinkingPage() {
  return (
    <IssueTypeView
      title="Internal linking"
      subtitle="Orphan pages, broken links and redirect chains from the latest crawl"
      matches={(t) => TYPES.has(t)}
      kpis={[
        { label: "Orphan pages", match: (t) => t === "ORPHAN_PAGE" },
        { label: "Broken links", match: (t) => t === "BROKEN_LINK_4XX" || t === "SERVER_ERROR_5XX" },
        { label: "Redirect chains", match: (t) => t === "REDIRECT_CHAIN" || t === "REDIRECT_LOOP" },
      ]}
      emptyBody="No internal linking issues on this crawl."
    />
  );
}
