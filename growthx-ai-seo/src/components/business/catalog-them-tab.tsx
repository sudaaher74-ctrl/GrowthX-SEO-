"use client";

import Link from "next/link";
import { Loader2, RefreshCw, Store } from "lucide-react";
import { ActionButton, PageHeader, Panel } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { useBusinessCompetitorCatalogs, useCrawlBusinessCompetitor } from "@/hooks/use-growthx";
import type { CompetitorCatalogResult } from "@/lib/api-client";
import { CatalogTable } from "./catalog-table";

/**
 * Catalog (Them): the same product extraction, run against every competitor
 * already tracked in Competitor Intelligence. Never asks the user to re-add
 * competitors — the list comes straight from CompetitorDomain, and "Crawl"
 * here queues the same crawl job Competitor Intelligence already uses.
 */
export function CatalogThemTab({ projectId }: { projectId: string }) {
  const query = useBusinessCompetitorCatalogs(projectId || null);
  const competitors = query.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Catalog (Them)"
        subtitle="The same extraction, run against the competitors you've already added in Competitor Intelligence."
      />

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={competitors.length === 0}
        emptyTitle="No competitors tracked yet"
        emptyBody="Catalog (Them) reuses the competitor list from Competitor Intelligence — add one there and it shows up here automatically."
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
            <CompetitorCatalogPanel key={result.competitor.id} projectId={projectId} result={result} />
          ))}
        </div>
      </QueryState>
    </div>
  );
}

function CompetitorCatalogPanel({ projectId, result }: { projectId: string; result: CompetitorCatalogResult }) {
  const crawl = useCrawlBusinessCompetitor(projectId || null);
  const { competitor, crawlStatus, products } = result;
  const inProgress = crawlStatus === "PENDING" || crawlStatus === "RUNNING" || crawl.isPending;

  return (
    <Panel
      title={competitor.label}
      subtitle={competitor.domain}
      actions={
        <ActionButton
          icon={inProgress ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          disabled={inProgress}
          onClick={() => crawl.mutate(competitor.id)}
        >
          {inProgress ? "Crawling…" : crawlStatus === "NOT_STARTED" ? "Crawl" : "Re-crawl"}
        </ActionButton>
      }
      padded={products.length === 0}
    >
      {products.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-[12.5px] text-brand-600">
            {inProgress
              ? "Reading their site now. Products will appear here as they're found."
              : crawlStatus === "FAILED"
                ? "The last crawl didn't complete. Try again."
                : crawlStatus === "NOT_STARTED"
                  ? "Not crawled yet — click Crawl to build this competitor's catalog."
                  : "No product pages found on their site."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {inProgress && (
            <div className="flex items-center gap-2 border-b bg-brand-50 px-4 py-2 text-[11.5px] text-brand-600">
              <Loader2 size={12} className="animate-spin text-brand-400" />
              Still crawling — more products may still appear.
            </div>
          )}
          <CatalogTable products={products} showMatchConfidence wrapInPanel={false} />
        </div>
      )}
    </Panel>
  );
}
