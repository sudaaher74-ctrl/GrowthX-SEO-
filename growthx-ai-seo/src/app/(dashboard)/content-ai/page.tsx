"use client";

import { useWorkspace } from "@/hooks/use-growthx";
import { ContentStudioPanel } from "@/components/content/content-studio-panel";

export default function ContentAiPage() {
  const { projectId } = useWorkspace();

  if (!projectId) {
    return (
      <div className="p-8 text-center text-sm text-brand-400">
        Please select a project to view the AI Content Studio.
      </div>
    );
  }

  return <ContentStudioPanel projectId={projectId} />;
}
