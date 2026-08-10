"use client";
import { IssueTypeView } from "@/components/issues/IssueTypeView";

export default function SchemaGeneratorPage() {
  return (
    <IssueTypeView
      title="Schema markup"
      subtitle="Structured data errors from the latest crawl"
      matches={(t) => t.startsWith("SCHEMA_ERROR_")}
      kpis={[{ label: "Schema errors", match: (t) => t.startsWith("SCHEMA_ERROR_") }]}
      emptyBody="No structured data issues on this crawl."
    />
  );
}
