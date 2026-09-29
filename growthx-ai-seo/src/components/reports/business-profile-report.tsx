"use client";
import { ReportGap, ReportKpis, ReportLoading, ReportPage, ReportSection, ReportTable, ReportText, useReportContext } from "@/components/reports/report-kit";
import { useGbpOverview, useGbpProposals, useGbpReviews } from "@/hooks/use-growthx";
import { DASH } from "@/lib/google-format";

const pretty = (field: string) => field.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/** The Google Business Profile: how complete it is, its reviews, and the changes proposed. */
export function BusinessProfileReport() {
  const { projectId, clientName, domain } = useReportContext();
  const overview = useGbpOverview(projectId);
  const reviews = useGbpReviews(projectId);
  const proposals = useGbpProposals(projectId);

  if (!projectId || overview.isLoading) return <ReportLoading what="the Business Profile report" />;
  const o = overview.data;
  const profile = o?.profile ?? null;
  const done = o?.completeness;
  const r = reviews.data?.summary;

  return (
    <ReportPage
      title="Google Business Profile report"
      clientName={clientName}
      domain={domain}
      intro="How your business appears on Google Search and Maps: how complete the listing is, what customers say, and what to improve."
    >
      {!profile ? (
        <ReportSection title="Your profile">
          <ReportGap>{o?.connection.statusMessage ?? "No Business Profile is connected or found for this workspace, so there is nothing to report."}</ReportGap>
        </ReportSection>
      ) : (
        <>
          <ReportSection title="Your profile">
            <ReportKpis items={[
              { label: "Complete", value: done ? `${done.present} of ${done.total}` : DASH, sub: "profile fields filled in" },
              { label: "Rating", value: profile.rating != null ? profile.rating.toFixed(1) : DASH },
              { label: "Reviews", value: r ? String(r.total) : DASH, sub: r?.averageRating != null ? `${r.averageRating.toFixed(1)} average` : undefined },
              { label: "Verified", value: profile.verified == null ? "Unknown" : profile.verified ? "Yes" : "No" },
            ]} />
            <ReportText>
              {[profile.businessName, profile.primaryCategory, profile.address].filter(Boolean).join(" · ")}
            </ReportText>
          </ReportSection>

          {done && done.fields.some((f) => !f.present) && (
            <ReportSection title="Missing from the profile" note="Complete profiles are shown more often and convert better.">
              <ReportTable columns={[{ label: "Field" }]} rows={done.fields.filter((f) => !f.present).map((f) => [pretty(f.field)])} empty="" />
            </ReportSection>
          )}
        </>
      )}

      <ReportSection title="Proposed improvements" note="Changes prepared for your approval. Nothing is changed on Google until you approve it.">
        <ReportTable
          columns={[{ label: "Field" }, { label: "Now" }, { label: "Proposed" }, { label: "Why" }, { label: "Status" }]}
          rows={(proposals.data ?? []).map((p) => [pretty(p.field), p.currentValue || "Not set", p.proposedValue, p.rationale, p.status.toLowerCase()])}
          empty="No improvements have been proposed yet."
        />
      </ReportSection>
    </ReportPage>
  );
}
