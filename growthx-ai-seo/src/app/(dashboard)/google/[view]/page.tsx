"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { Panel } from "@/components/ui/console";
import { UNBUILT } from "@/components/google/nav";

/**
 * A Google view that is planned and not built yet. It says what the view will
 * answer and when, and points at the existing page that covers part of it.
 * There is no placeholder data: nothing is shown until the real thing exists.
 */
export default function GoogleViewPage() {
  const params = useParams<{ view: string }>();
  const view = UNBUILT.get(params.view);
  if (!view) notFound();

  return (
    <Panel title={view.label}>
      <div className="space-y-3 p-6">
        <p className="text-[13px] text-brand-950">{view.will}</p>
        <p className="text-[12px] text-brand-500">
          This view is not built yet{view.phase ? ` — it is part of release ${view.phase} of the Google section` : ""}. Nothing is shown here until it runs on your real Search Console and Analytics data.
        </p>
        {view.current && (
          <Link href={view.current.href} className="inline-block text-[12px] font-semibold text-accent-700 hover:underline">
            {view.current.label} →
          </Link>
        )}
      </div>
    </Panel>
  );
}
