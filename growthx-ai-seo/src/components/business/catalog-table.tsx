"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { MeterBar, Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import type { CatalogProductRow } from "@/lib/api-client";
import { completenessPercent, ctaLabel, fieldStatusLabel, fieldStatusTone, formatCatalogPrice, stockLabel } from "@/lib/business-catalog";
import { cn } from "@/lib/utils";

/** Below this many products a search box is more clutter than help. */
const TOOLBAR_FROM = 8;

/**
 * The product table shared by Your products and Their products — same
 * fields, same three-state price/stock rendering. Their products adds the
 * "how sure" column, since site structure there varies far more than on the
 * project's own crawl.
 *
 * `wrapInPanel` defaults to true for Your products, which renders this
 * standalone. Their products already puts one Panel per competitor around
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
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [products]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!q || (p.name ?? "").toLowerCase().includes(q) || p.url.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q)),
    );
  }, [products, search, category]);

  const toolbar =
    products.length >= TOOLBAR_FROM ? (
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-[12px] sm:max-w-xs">
          <Search size={13} className="text-brand-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="w-full bg-transparent text-brand-950 outline-none placeholder:text-brand-400"
          />
        </label>
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={!category} onClick={() => setCategory(null)}>
              All ({products.length})
            </FilterChip>
            {categories.map(([name, count]) => (
              <FilterChip key={name} active={category === name} onClick={() => setCategory(category === name ? null : name)}>
                {name} ({count})
              </FilterChip>
            ))}
          </div>
        )}
      </div>
    ) : null;

  const table = (
    <>
      {toolbar}
      {shown.length === 0 ? (
        <p className="p-6 text-center text-[12.5px] text-brand-500">No products match that search.</p>
      ) : (
        <Table minWidth={showMatchConfidence ? 980 : 880}>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>Category</Th>
              <Th>Price</Th>
              <Th>Stock</Th>
              <Th>Button on page</Th>
              <Th>Details shown</Th>
              {showMatchConfidence && <Th align="right">How sure</Th>}
              <Th align="right">Page</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <Tr key={row.id}>
                <Td className="max-w-[300px]">
                  <p className="truncate font-medium text-brand-950">
                    {row.name ?? <span className="text-brand-400">Name not shown</span>}
                  </p>
                  <p className="truncate text-[10.5px] text-brand-400">{pathOf(row.url)}</p>
                </Td>
                <Td>{row.category ? <Pill>{row.category}</Pill> : <span className="text-brand-400">—</span>}</Td>
                <Td>
                  {row.priceStatus === "FOUND" ? (
                    <span className="font-mono text-[12.5px] font-semibold text-brand-950">{formatCatalogPrice(row)}</span>
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
                <Td>
                  <div className="flex items-center gap-2">
                    <MeterBar value={completenessPercent(row)} tone={completenessPercent(row) >= 80 ? "good" : "accent"} width={56} />
                    <span className="font-mono text-[11px] text-brand-500">{completenessPercent(row)}%</span>
                  </div>
                </Td>
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
      )}
    </>
  );

  return wrapInPanel ? <Panel>{table}</Panel> : table;
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active ? "border-primary-600 bg-primary-600 text-white" : "bg-white text-brand-600 hover:bg-primary-50 hover:text-primary-700",
      )}
    >
      {children}
    </button>
  );
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.pathname;
  } catch {
    return url;
  }
}
