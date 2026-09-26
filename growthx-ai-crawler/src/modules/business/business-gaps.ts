import type { CatalogProduct } from '@prisma/client';

/**
 * Business module, Gaps tab — category-level matching only (v1).
 *
 * Product-level fuzzy/SKU matching across two independently-run sites is a
 * v2 problem: it needs a matching algorithm good enough to trust, and a wrong
 * match here is worse than no match, since it would compare two unrelated
 * products' prices as if they were the same item. Category is the coarsest
 * grain that is still meaningful and that both catalogs already carry.
 *
 * A pure function, the same way rival-moves.ts and gaps-plain.ts are —
 * BusinessGapsService is a thin Prisma read in front of this.
 */

export type GapKind = 'MISSING_CATEGORY' | 'PRICE_DELTA' | 'PRICE_INCOMPARABLE' | 'STOCK_TRANSPARENCY';

export interface CategoryGapItem {
  id: string;
  kind: GapKind;
  competitorId: string;
  competitorLabel: string;
  competitorDomain: string;
  category: string;
  /** One sentence: what the gap is. */
  headline: string;
  /** Why it matters, in plain words. */
  why: string;
  /** What to do about it, step by step — the same format Battleground uses. */
  steps: string[];
  /** Bigger gaps first. */
  weight: number;
}

export interface CompetitorCatalog {
  id: string;
  domain: string;
  label: string;
  products: CatalogProduct[];
}

function groupByCategory(products: CatalogProduct[]): Map<string, CatalogProduct[]> {
  const byCategory = new Map<string, CatalogProduct[]>();
  for (const product of products) {
    if (!product.category) continue;
    const list = byCategory.get(product.category) ?? [];
    list.push(product);
    byCategory.set(product.category, list);
  }
  return byCategory;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const priced = (products: CatalogProduct[]) =>
  products.filter((p) => p.priceStatus === 'FOUND' && p.priceMinorUnits != null);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Below this, a price difference is normal variation, not a gap worth a plan. */
const PRICE_DELTA_THRESHOLD_PCT = 10;
/** Below this gap in how often stock is published, it isn't worth a plan either. */
const STOCK_TRANSPARENCY_THRESHOLD = 0.4;

export function buildCategoryGapItems(mine: CatalogProduct[], competitors: CompetitorCatalog[]): CategoryGapItem[] {
  const myByCategory = groupByCategory(mine);
  const items: CategoryGapItem[] = [];

  for (const competitor of competitors) {
    if (competitor.products.length === 0) continue;
    const theirByCategory = groupByCategory(competitor.products);

    for (const [category, theirProducts] of theirByCategory) {
      const mineInCategory = myByCategory.get(category) ?? [];

      if (mineInCategory.length === 0) {
        items.push({
          id: `missing-category:${competitor.id}:${category}`,
          kind: 'MISSING_CATEGORY',
          competitorId: competitor.id,
          competitorLabel: competitor.label,
          competitorDomain: competitor.domain,
          category,
          headline: `${competitor.label} lists ${plural(theirProducts.length, 'product', 'products')} in "${category}". You have none.`,
          why: 'Category coverage is one of the first things a shopper comparing sites checks. A category you do not carry at all is one they win by default.',
          steps: [
            `See what ${competitor.label} carries in "${category}": ${theirProducts
              .slice(0, 3)
              .map((p) => p.name || p.url)
              .join(', ')}${theirProducts.length > 3 ? ', …' : ''}`,
            'Decide whether this is a category worth carrying for your business.',
            'If yes, publish product pages for it with a clear price and stock status, so the next crawl picks them up here.',
          ],
          weight: 70 + theirProducts.length,
        });
        continue;
      }

      const theirPriced = priced(theirProducts);
      const minePriced = priced(mineInCategory);
      if (theirPriced.length > 0 && minePriced.length > 0) {
        const theirCurrency = theirPriced[0].currency;
        const oneCurrency =
          theirCurrency != null &&
          theirPriced.every((p) => p.currency === theirCurrency) &&
          minePriced.every((p) => p.currency === theirCurrency);

        if (oneCurrency) {
          const theirAvg = average(theirPriced.map((p) => p.priceMinorUnits!));
          const mineAvg = average(minePriced.map((p) => p.priceMinorUnits!));
          const deltaPct = ((mineAvg - theirAvg) / theirAvg) * 100;

          if (Math.abs(deltaPct) >= PRICE_DELTA_THRESHOLD_PCT) {
            const higher = deltaPct > 0;
            items.push({
              id: `price-delta:${competitor.id}:${category}`,
              kind: 'PRICE_DELTA',
              competitorId: competitor.id,
              competitorLabel: competitor.label,
              competitorDomain: competitor.domain,
              category,
              headline: `Your "${category}" prices average ${Math.round(Math.abs(deltaPct))}% ${higher ? 'higher' : 'lower'} than ${competitor.label}'s.`,
              why: higher
                ? `A shopper comparing this category sees ${competitor.label} as the cheaper option.`
                : `You may be underpricing relative to ${competitor.label} — worth checking this is intentional before it eats into margin.`,
              steps: higher
                ? [
                    `Check whether the price gap is explained by something ${competitor.label} does not offer — quality, warranty, delivery.`,
                    'If not, consider narrowing the gap or making the difference explicit on the product page.',
                  ]
                : [
                    `Confirm this pricing is intentional — a promotional price left live, or a genuine positioning choice.`,
                    'If it is a mistake, correct it; if it is deliberate, consider whether the margin still works.',
                  ],
              weight: 50 + Math.min(50, Math.abs(deltaPct)),
            });
          }
        } else {
          items.push({
            id: `price-incomparable:${competitor.id}:${category}`,
            kind: 'PRICE_INCOMPARABLE',
            competitorId: competitor.id,
            competitorLabel: competitor.label,
            competitorDomain: competitor.domain,
            category,
            headline: `Can't compare "${category}" prices with ${competitor.label} — listed in different currencies.`,
            why: 'A price comparison across currencies would need a live exchange rate this module does not fetch, so showing one here would be a guess presented as a fact.',
            steps: [`Compare "${category}" pricing manually, converting ${competitor.label}'s currency at today's rate.`],
            weight: 20,
          });
        }
      }

      const theirPublishRate = theirProducts.filter((p) => p.stockStatus === 'FOUND').length / theirProducts.length;
      const minePublishRate = mineInCategory.filter((p) => p.stockStatus === 'FOUND').length / mineInCategory.length;
      if (theirPublishRate - minePublishRate >= STOCK_TRANSPARENCY_THRESHOLD) {
        items.push({
          id: `stock-transparency:${competitor.id}:${category}`,
          kind: 'STOCK_TRANSPARENCY',
          competitorId: competitor.id,
          competitorLabel: competitor.label,
          competitorDomain: competitor.domain,
          category,
          headline: `${competitor.label} shows stock status on more of their "${category}" products than you do.`,
          why: 'A shopper who cannot tell whether something is in stock is more likely to leave and check a site that says so.',
          steps: [
            `Add "in stock" / "out of stock" to your "${category}" product pages where it is currently missing.`,
            'If a product is genuinely quote-only, say so explicitly rather than leaving the field blank.',
          ],
          weight: 30 + Math.round((theirPublishRate - minePublishRate) * 40),
        });
      }
    }
  }

  return items.sort((a, b) => b.weight - a.weight);
}
