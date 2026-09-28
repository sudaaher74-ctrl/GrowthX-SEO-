"use client";

import Link from "next/link";
import { AlertTriangle, Loader2, PackageSearch, RefreshCw, Store, Target } from "lucide-react";
import { ActionButton, PageHeader, Panel, relativeTime } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { useBusinessCompetitorCatalogs, useCrawlBusinessCompetitor } from "@/hooks/use-growthx";
import type { CompetitorCatalogResult } from "@/lib/api-client";
import { CatalogTable } from "./catalog-table";

type TabId = "catalog-you" | "catalog-them" | "gaps" | "marketing" | "plans";

/**
 * Their products: the same product reading, run against every competitor
 * already tracked in Competitor Intelligence, from the pages it already read.
 *
 * It used to answer an empty catalog with "Re-crawl", beside a Competitor
 * Intelligence card saying 300 pages had been read. The pages are already
 * stored, so products are now read from them without a new crawl, and a site
 * that really shows no products says so — with what was read — instead of
 * sending the customer round the same crawl again.
 */
export function CatalogThemTab({ projectId, onOpenTab }: { projectId: string; onOpenTab: (tab: TabId) => void }) {
  const query = useBusinessCompetitorCatalogs(projectId || null);
  const competitors = query.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Their products"
        subtitle="What each competitor sells, with prices and stock, read from the pages Competitor Intelligence already crawled."
      />

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={competitors.length === 0}
        emptyTitle="No competitors yet"
        emptyBody="Their products come from the competitors in Competitor Intelligence. Add one there and it shows up here automatically."
        emptyAction={
          <Link href="/competitor-intelligence">
            <ActionButton variant="primary" icon={<Store size={13} />}>
              Add a competitor
            </ActionButton>
          </Link>
        }
      >
        <div className="space-y-4">
          {competitors.map((result) => (
            <CompetitorCatalogPanel key={result.competitor.id} projectId={projectId} result={result} onOpenTab={onOpenTab} />
          ))}
        </div>
      </QueryState>
    </div>
  );
}

function CompetitorCatalogPanel({
  projectId,
  result,
  onOpenTab,
}: {
  projectId: string;
  result: CompetitorCatalogResult;
  onOpenTab: (tab: TabId) => void;
}) {
  const crawl = useCrawlBusinessCompetitor(projectId || null);
  const { competitor, crawlStatus, products, crawledAt } = result;
  const pagesRead = result.pagesRead ?? 0;
  const crawling = crawlStatus === "PENDING" || crawlStatus === "RUNNING" || crawl.isPending;
  const reading = Boolean(result.readingProducts);
  const priced = products.filter((p) => p.priceStatus === "FOUND").length;
  const stocked = products.filter((p) => p.stockStatus === "FOUND").length;

  const readAgain = (
    <ActionButton
      icon={crawling ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
      disabled={crawling}
      onClick={() => crawl.mutate(competitor.id)}
    >
      {crawling ? "Reading their site…" : crawlStatus === "NOT_STARTED" ? "Read their site" : "Read again"}
    </ActionButton>
  );

  const subtitle = [
    competitor.domain,
    crawledAt && crawlStatus === "COMPLETED" ? `read ${relativeTime(crawledAt)}` : null,
    pagesRead ? `${pagesRead.toLocaleString()} pages` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Panel title={competitor.label} subtitle={subtitle} actions={readAgain}>
      {products.length > 0 && (
        <div className="grid grid-cols-3 divide-x border-b bg-brand-50">
          <MiniStat label="Products found" value={products.length.toLocaleString()} />
          <MiniStat label="Show a price" value={`${priced}/${products.length}`} />
          <MiniStat label="Show stock" value={`${stocked}/${products.length}`} />
        </div>
      )}

      {products.length === 0 ? (
        <EmptyCatalog
          reading={reading}
          crawling={crawling}
          crawlStatus={crawlStatus}
          pagesRead={pagesRead}
          label={competitor.label}
          onOpenStrategy={() => onOpenTab("marketing")}
        />
      ) : (
        <div>
          {(crawling || reading) && (
            <div className="flex items-center gap-2 border-b bg-primary-50 px-4 py-2 text-[11.5px] text-primary-700">
              <Loader2 size={12} className="animate-spin" />
              Still reading. More products may appear.
            </div>
          )}
          <CatalogTable products={products} showMatchConfidence wrapInPanel={false} />
        </div>
      )}
    </Panel>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">{label}</p>
      <p className="font-mono text-[16px] font-bold text-brand-950">{value}</p>
    </div>
  );
}

function EmptyCatalog({
  reading,
  crawling,
  crawlStatus,
  pagesRead,
  label,
  onOpenStrategy,
}: {
  reading: boolean;
  crawling: boolean;
  crawlStatus: CompetitorCatalogResult["crawlStatus"];
  pagesRead: number;
  label: string;
  onOpenStrategy: () => void;
}) {
  if (reading) {
    return (
      <Message icon={<Loader2 size={18} className="animate-spin" />} title="Finding their products">
        Reading the {pagesRead.toLocaleString()} pages we already have from their website. No new crawl needed; this
        updates by itself.
      </Message>
    );
  }
  if (crawling) {
    return (
      <Message icon={<Loader2 size={18} className="animate-spin" />} title="Reading their website">
        Products appear here as they&apos;re found. This updates by itself.
      </Message>
    );
  }
  if (crawlStatus === "NOT_STARTED") {
    return (
      <Message icon={<PackageSearch size={18} />} title="Not read yet">
        Competitor Intelligence reads {label}&apos;s website automatically. Their products appear here once it has.
      </Message>
    );
  }
  if (crawlStatus === "FAILED" && pagesRead === 0) {
    return (
      <Message icon={<AlertTriangle size={18} />} title="Their website couldn't be read">
        The last attempt didn&apos;t finish. Use &ldquo;Read again&rdquo; to try once more.
      </Message>
    );
  }
  return (
    <Message icon={<PackageSearch size={18} />} title="No products with prices on their website">
      We read {pagesRead.toLocaleString()} pages of {label}&apos;s website. None shows a product with a price, a buy
      button or product details we can read. They may sell through an app, by phone or on WhatsApp.
      <span className="mt-3 block">
        <ActionButton variant="primary" icon={<Target size={13} />} onClick={onOpenStrategy}>
          See what they push hardest
        </ActionButton>
      </span>
    </Message>
  );
}

function Message({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-7 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">{icon}</div>
      <p className="mt-2.5 text-[13.5px] font-semibold text-brand-950">{title}</p>
      <div className="mt-1 text-[12.5px] text-brand-500">{children}</div>
    </div>
  );
}
