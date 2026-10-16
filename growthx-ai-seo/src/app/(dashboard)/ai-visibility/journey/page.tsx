import { redirect } from "next/navigation";

export default async function AiVisibilityJourneyRoute({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const query = new URLSearchParams({ tab: "overview", workflow: "open" });
  if (tab) query.set("workflowTab", tab);
  redirect(`/ai-visibility?${query}`);
}
