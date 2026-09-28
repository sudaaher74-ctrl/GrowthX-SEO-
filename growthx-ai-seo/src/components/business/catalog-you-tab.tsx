"use client";

import Link from "next/link";
import { Loader2, PackageSearch, Tag, Boxes, ListChecks } from "lucide-react";
import { ActionButton, Kpi, PageHeader, Panel } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { useBusinessMyCatalog } from "@/hooks/use-growthx";
import type { CatalogProductRow } from "@/lib/api-client";
import { CatalogTable } from "./catalog-table";

/**
 * Your products: products read from the project's own crawl. Read-only — the
 * crawler's product detector (schema.org Product, a price in the page text,
 * a buy/enquire button) finds them in the same crawl Website Audit runs, and
 * pages already stored are read again without a new crawl when needed.
 */
export function CatalogYouTab({ projectId }: { projectId: string }) {
  const query = useBusinessMyCatalog(projectId || null);
  const data = query.data;
  const products = data?.products ?? [];
  const crawlStatus = data?.crawlStatus ?? "NOT_STARTED";
  const inProgress = crawlStatus === "PENDING" || crawlStatus === "RUNNING";
  const reading = Boolean(data?.readingProducts);

  let emptyTitle = "No products found on your website";
  let emptyBody = `We read ${data?.pagesRead ?? 0} pages of your website and none showed a product with a price, a buy or enquire button, or product details we could read. Adding a price and a clear "Buy" or "Enquire" button to each product page helps both customers and Google.`;
  if (reading) {
    emptyTitle = "Finding your products";
    emptyBody = `Reading the ${data?.pagesRead ?? 0} pages we already have from your website. This page updates by itself.`;
  } else if (inProgress) {
    emptyTitle = "Reading your website";
    emptyBody = "Your website is being read now. Products appear here as they're found; this page updates by itself.";
  } else if (crawlStatus === "NOT_STARTED") {
    emptyTitle = "Your website hasn't been read yet";
    emptyBody = "Your products come from the same read Website Audit does. Run one to see them here.";
  } else if (crawlStatus === "FAILED") {
    emptyTitle = "The last read didn't finish";
    emptyBody = "Run Website Audit again to read your products.";
  }

  const priced = products.filter((p) => p.priceStatus === "FOUND").length;
  const stocked = products.filter((p) => p.stockStatus === "FOUND").length;
  const avgDetails = products.length ? Math.round((products.reduce((s, p) => s + p.completenessScore, 0) / products.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Your products"
        subtitle="Every product we found on your website, with its price, stock and the button customers use to buy."
      />

      {(inProgress || reading) && products.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border bg-primary-50 px-4 py-2.5 text-[12.5px] text-primary-700">
          <Loader2 size={14} className="animate-spin" />
          Still reading your website. More products may appear.
        </div>
      )}

      {products.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Products found" value={products.length.toLocaleString()} sub={`from ${data?.pagesRead ?? 0} pages read`} />
          <Kpi label="Show a price" value={`${priced}/${products.length}`} meter={pct(priced, products.length)} />
          <Kpi label="Show stock" value={`${stocked}/${products.length}`} meter={pct(stocked, products.length)} />
          <Kpi label="Details shown" value={`${avgDetails}%`} meter={avgDetails} sub="name, price, stock, category" />
        </div>
      )}

      {products.length > 0 && <ImproveNotes products={products} />}

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={products.length === 0}
        emptyTitle={emptyTitle}
        emptyBody={emptyBody}
        emptyAction={
          inProgress || reading ? undefined : (
            <Link href="/website">
              <ActionButton variant="primary" icon={<PackageSearch size={13} />}>
                {crawlStatus === "NOT_STARTED" ? "Go to Website Audit" : "Run Website Audit again"}
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

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

/** What is missing across the catalog, in plain words, only where something is. */
function ImproveNotes({ products }: { products: CatalogProductRow[] }) {
  const noPrice = products.filter((p) => p.priceStatus !== "FOUND").length;
  const noStock = products.filter((p) => p.stockStatus !== "FOUND").length;
  const noCategory = products.filter((p) => !p.category).length;
  const notes = [
    noPrice > 0 && {
      icon: Tag,
      text: `${noPrice} product${noPrice === 1 ? " doesn't" : "s don't"} show a price.`,
      why: "Customers compare prices before they contact anyone. Show the price on the page.",
    },
    noStock > 0 && {
      icon: Boxes,
      text: `${noStock} product${noStock === 1 ? " doesn't" : "s don't"} say whether it's in stock.`,
      why: "Saying “In stock” builds trust and can show in Google results.",
    },
    noCategory > 0 && {
      icon: ListChecks,
      text: `${noCategory} product${noCategory === 1 ? " has" : "s have"} no category.`,
      why: "Grouping products helps customers find them and lets us compare you with competitors.",
    },
  ].filter(Boolean) as Array<{ icon: React.ElementType; text: string; why: string }>;
  if (notes.length === 0) return null;

  return (
    <Panel title="Quick wins on your product pages" padded>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {notes.map((n) => {
          const Icon = n.icon;
          return (
            <li key={n.text} className="flex gap-2.5 rounded-lg bg-warning-50 p-3">
              <Icon size={15} className="mt-0.5 shrink-0 text-warning-600" />
              <span>
                <span className="block text-[12.5px] font-semibold text-brand-950">{n.text}</span>
                <span className="block text-[11.5px] text-brand-600">{n.why}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
