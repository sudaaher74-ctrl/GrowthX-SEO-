"use client";
import { IssueTypeView } from "@/components/issues/IssueTypeView";

const TYPES = new Set(["MISSING_ALT_TEXT", "BROKEN_IMAGE"]);

export default function ImageSeoPage() {
  return (
    <IssueTypeView
      title="Image SEO"
      subtitle="Alt text and broken images from the latest crawl"
      matches={(t) => TYPES.has(t)}
      kpis={[
        { label: "Missing alt text", match: (t) => t === "MISSING_ALT_TEXT" },
        { label: "Broken images", match: (t) => t === "BROKEN_IMAGE" },
      ]}
      emptyBody="No image issues on this crawl."
    />
  );
}
