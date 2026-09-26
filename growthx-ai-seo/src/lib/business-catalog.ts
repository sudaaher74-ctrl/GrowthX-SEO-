import type { CatalogFieldStatus, CatalogProductRow } from "./api-client";

/**
 * Shared read-side helpers for the Business module's Catalog (You) / Catalog
 * (Them) tables, so both render the same three price/stock states the same
 * way. Never collapse FOUND / NOT_PUBLISHED / NOT_YET_CRAWLED into a blank
 * cell — each means something different and calls for a different next step.
 */

const CURRENCY_SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

/** Null when there is nothing to show as a number — render the status pill instead. */
export function formatCatalogPrice(row: Pick<CatalogProductRow, "priceStatus" | "priceMinorUnits" | "currency">): string | null {
  if (row.priceStatus !== "FOUND" || row.priceMinorUnits == null) return null;
  const amount = row.priceMinorUnits / 100;
  const symbol = row.currency ? (CURRENCY_SYMBOL[row.currency] ?? `${row.currency} `) : "";
  return `${symbol}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function stockLabel(value: string | null): string {
  switch (value) {
    case "IN_STOCK":
      return "In stock";
    case "OUT_OF_STOCK":
      return "Out of stock";
    case "PREORDER":
      return "Preorder";
    default:
      return "—";
  }
}

export function fieldStatusLabel(status: CatalogFieldStatus): string {
  switch (status) {
    case "NOT_PUBLISHED":
      return "Not published";
    case "NOT_YET_CRAWLED":
      return "Not yet crawled";
    default:
      return "";
  }
}

export function fieldStatusTone(status: CatalogFieldStatus): "good" | "warn" | "default" {
  if (status === "FOUND") return "good";
  if (status === "NOT_PUBLISHED") return "warn";
  return "default";
}

/** % of {name, price, currency, stock, category} populated, as a whole number. */
export function completenessPercent(row: Pick<CatalogProductRow, "completenessScore">): number {
  return Math.round(row.completenessScore * 100);
}

const CTA_LABEL: Record<string, string> = {
  ADD_TO_CART: "Add to cart",
  BUY_NOW: "Buy now",
  ENQUIRE: "Enquire",
  REQUEST_QUOTE: "Request a quote",
};

export function ctaLabel(cta: string | null): string {
  return cta ? (CTA_LABEL[cta] ?? cta) : "—";
}
