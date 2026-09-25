"use client";

import Link from "next/link";
import { Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import { useLocalSeo } from "@/hooks/use-growthx";
import type { TrackedCompetitor } from "@/lib/api-client";

/**
 * Local standing vs rivals, from the Google listings already read.
 *
 * The map grid against rivals is not built yet; the grid for your own
 * listing lives on Google Business Profile → Local Rankings.
 */
export function LocalMapTab({ projectId, competitors }: { projectId: string; competitors: TrackedCompetitor[] }) {
  const local = useLocalSeo(projectId || null);
  const rows = [
    { id: "you", name: local.data?.businessName ? `You · ${local.data.businessName}` : "You", rating: local.data?.rating ?? null, reviews: local.data?.reviewCount ?? null },
    ...competitors.map((c) => ({ id: c.id, name: c.name || c.label || c.domain, rating: c.rating ?? null, reviews: c.reviewCount ?? null })),
  ];
  const anyRival = competitors.some((c) => c.rating != null || c.reviewCount != null);

  return (
    <div className="space-y-4">
      <Panel
        title="Google listings: you vs rivals"
        subtitle="From Google Places. A rival with no listing matched shows as not measured, not zero."
        actions={<Pill tone="info">Google Places</Pill>}
      >
        <Table minWidth={520}>
          <thead>
            <tr>
              <Th>Business</Th>
              <Th align="right">Rating</Th>
              <Th align="right">Reviews</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className={r.id === "you" ? "font-semibold text-brand-950" : undefined}>{r.name}</Td>
                <Td align="right">{r.rating != null ? `${r.rating.toFixed(1)}★` : <span className="text-brand-400">not measured</span>}</Td>
                <Td align="right">
                  {r.reviews != null ? r.reviews.toLocaleString("en-IN") : <span className="text-brand-400">not measured</span>}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        {!anyRival && (
          <p className="border-t px-4 py-3 text-[11px] text-brand-500">
            No rival listing has been matched yet. Rival listings are looked up by their Maps name and city.
          </p>
        )}
      </Panel>

      <Panel title="Map grid vs rivals" subtitle="Coming next" padded>
        <p className="text-[12px] leading-relaxed text-brand-600">
          The map grid of rankings for you against rivals is not built yet. Your own grid scan is on{" "}
          <Link href="/google-business-profile?tab=rankings" className="font-medium text-accent-600 hover:underline">
            Google Business Profile → Local Rankings
          </Link>
          .
        </p>
      </Panel>
    </div>
  );
}
