"use client";

import { ExternalLink } from "lucide-react";
import { Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import type { CatalogProductRow } from "@/lib/api-client";
import { completenessPercent, ctaLabel, fieldStatusLabel, fieldStatusTone, formatCatalogPrice, stockLabel } from "@/lib/business-catalog";

/**
 * The product table shared by Catalog (You) and Catalog (Them) — same
 * fields, same three-state price/stock rendering. Catalog (Them) adds the
 * match-confidence column, since site structure there varies far more than
 * on the project's own crawl.
 *
 * `wrapInPanel` defaults to true for Catalog (You), which renders this
 * standalone. Catalog (Them) already puts one Panel per competitor around
 * it, so it passes false — a Panel nested in a Panel is a stacked-shadow,
 * double-border look the design system explicitly avoids.
 */
export function CatalogTable({
  products,
  showMatchConfidence = false,
  wrapInPanel = true,
}: {
  products: CatalogProductRow[];
  showMatchConfidence?: boolean;
  wrapInPanel?: boolean;
}) {
  const table = (
      <Table minWidth={showMatchConfidence ? 1100 : 980}>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Category</Th>
            <Th>Price</Th>
            <Th>Stock</Th>
            <Th>Call to action</Th>
            <Th align="right">Completeness</Th>
            {showMatchConfidence && <Th align="right">Match confidence</Th>}
            <Th align="right">Page</Th>
          </tr>
        </thead>
        <tbody>
          {products.map((row) => (
            <Tr key={row.id}>
              <Td className="max-w-[260px] truncate font-medium text-brand-950">{row.name ?? <span className="text-brand-400">Untitled product</span>}</Td>
              <Td>{row.category ?? <span className="text-brand-400">—</span>}</Td>
              <Td>
                {row.priceStatus === "FOUND" ? (
                  <span className="font-mono text-[12px] text-brand-950">{formatCatalogPrice(row)}</span>
                ) : (
                  <Pill tone={fieldStatusTone(row.priceStatus)}>{fieldStatusLabel(row.priceStatus)}</Pill>
                )}
              </Td>
              <Td>
                {row.stockStatus === "FOUND" ? (
                  <Pill tone={row.stockValue === "OUT_OF_STOCK" ? "bad" : "good"}>{stockLabel(row.stockValue)}</Pill>
                ) : (
                  <Pill tone={fieldStatusTone(row.stockStatus)}>{fieldStatusLabel(row.stockStatus)}</Pill>
                )}
              </Td>
              <Td className="text-brand-600">{ctaLabel(row.ctaType)}</Td>
              <Td align="right" className="font-mono text-brand-600">{completenessPercent(row)}%</Td>
              {showMatchConfidence && (
                <Td align="right" className="font-mono text-brand-600">
                  {row.matchConfidence != null ? `${Math.round(row.matchConfidence * 100)}%` : "—"}
                </Td>
              )}
              <Td align="right">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent-600 hover:underline"
                >
                  Open <ExternalLink size={11} />
                </a>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
  );

  return wrapInPanel ? <Panel>{table}</Panel> : table;
}
