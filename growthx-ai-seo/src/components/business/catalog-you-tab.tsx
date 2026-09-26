"use client";

import Link from "next/link";
import { Loader2, PackageSearch } from "lucide-react";
import { ActionButton, Kpi, PageHeader } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { useBusinessMyCatalog } from "@/hooks/use-growthx";
import { CatalogTable } from "./catalog-table";

/**
 * Catalog (You): products auto-extracted from the project's own crawl.
 * Read-only — the crawler's product detector (schema.org Product, price
 * regex, CTA detection) is what populates this, as part of the same crawl
 * job Website Audit already runs.
 */
export function CatalogYouTab({ projectId }: { projectId: string }) {
  const query = useBusinessMyCatalog(projectId || null);
  const data = query.data;
  const products = data?.products ?? [];
  const crawlStatus = data?.crawlStatus ?? "NOT_STARTED";
  const inProgress = crawlStatus === "PENDING" || crawlStatus === "RUNNING";

  let emptyTitle = "No product pages found";
  let emptyBody =
    "The crawler looks for schema.org Product markup, a price near the page text, and a buy/enquire button. Nothing on your site matched yet.";
  if (inProgress) {
    emptyTitle = "Crawl in progress";
    emptyBody = "Your site is being crawled. Products will appear here as they're found — this page updates on its own.";
  } else if (crawlStatus === "NOT_STARTED") {
    emptyTitle = "Your site hasn't been crawled yet";
    emptyBody = "Catalog (You) is built from the same crawl Website Audit runs. Run one to see your products here.";
  } else if (crawlStatus === "FAILED") {
    emptyTitle = "The last crawl didn't complete";
    emptyBody = "Run the crawl again from Website Audit to rebuild your catalog.";
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Catalog (You)"
        subtitle="Product name, price, stock and category, auto-extracted from your own crawled site."
      />

      {/* A crawl already in progress with results so far — the empty state
          below only covers "nothing found yet", not "still finding more". */}
      {inProgress && products.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border bg-brand-50 px-4 py-2.5 text-[12.5px] text-brand-600">
          <Loader2 size={14} className="animate-spin text-brand-400" />
          Still crawling — more products may still appear.
        </div>
      )}

      {products.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Products found" value={String(products.length)} />
          <Kpi label="Price published" value={`${products.filter((p) => p.priceStatus === "FOUND").length}/${products.length}`} />
          <Kpi label="Stock published" value={`${products.filter((p) => p.stockStatus === "FOUND").length}/${products.length}`} />
          <Kpi
            label="Avg. completeness"
            value={`${Math.round((products.reduce((sum, p) => sum + p.completenessScore, 0) / products.length) * 100)}%`}
          />
        </div>
      )}

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={products.length === 0}
        emptyTitle={emptyTitle}
        emptyBody={emptyBody}
        emptyAction={
          inProgress ? undefined : (
            <Link href="/website">
              <ActionButton variant="primary" icon={<PackageSearch size={13} />}>
                {crawlStatus === "NOT_STARTED" ? "Go to Website Audit" : "Re-run your crawl"}
              </ActionButton>
            </Link>
          )
        }
      >
        <CatalogTable products={products} />
      </QueryState>
    </div>
  );
}
