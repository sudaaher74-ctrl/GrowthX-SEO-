"use client";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ActionButton, NotConnected, PageHeader, Panel } from "@/components/ui/console";
import { useStrategies, useWorkspace } from "@/hooks/use-growthx";

/**
 * Content AI. The brief pipeline in the design is not built; what does exist is
 * the strategy engine's content plan, which is generated from real crawl and
 * visibility evidence — so we point there rather than mocking a pipeline.
 */
export default function ContentAiPage() {
  const { projectId } = useWorkspace();
  const strategies = useStrategies(projectId);
  const latest = strategies.data?.[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Content AI"
        subtitle="Briefs written against the prompts assistants actually answer"
        actions={
          <Link href="/strategy">
            <ActionButton variant="primary" icon={<Sparkles size={12} />}>Open strategy</ActionButton>
          </Link>
        }
      />

      {latest ? (
        <Panel title="Content plan available" subtitle={`from the strategy generated ${new Date(latest.createdAt).toLocaleDateString()}`}>
          <div className="p-6 text-center">
            <p className="text-[13px] text-[#3f3f46]">
              This client has a generated content plan built from lost prompts and crawl evidence.
            </p>
            <Link href="/strategy" className="mt-3 inline-block text-[12.5px] font-medium text-[#2563eb] hover:underline">
              View the content plan →
            </Link>
          </div>
        </Panel>
      ) : (
        <Panel title="No content plan yet">
          <div className="p-6 text-center">
            <p className="text-[13px] text-[#3f3f46]">
              Generate a strategy to get a content plan targeted at the prompts competitors are winning.
            </p>
            <Link href="/strategy" className="mt-3 inline-block text-[12.5px] font-medium text-[#2563eb] hover:underline">
              Generate a strategy →
            </Link>
          </div>
        </Panel>
      )}

      <NotConnected
        title="The brief editor and publishing pipeline are not built"
        what="The design specifies a draft/review/published pipeline with per-piece content scores and an outline editor."
        needs={["A content/brief model with workflow stages", "A scoring method", "A CMS integration to publish"]}
      />
    </div>
  );
}
