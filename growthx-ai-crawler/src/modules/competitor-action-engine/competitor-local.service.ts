import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LocalSeoService } from '../local-seo/local-seo.service';

export interface LocalRefreshResult {
  checked: number;
  matched: number;
  /** Why nothing was looked up, when nothing was. */
  skippedReason?: string;
}

/**
 * Matches tracked competitors to their Google listing.
 *
 * The setup form has always asked for a competitor's Maps name and nothing
 * read it, so the Local tab could only ever show the customer's own listing —
 * a "Local Competitors" view with no competitors in it.
 *
 * Matching is deliberately conservative. A listing is only stored when the
 * search returns something whose name plausibly corresponds to what the
 * operator typed; a near-miss is left unmatched rather than attaching a rival
 * business's reviews to the wrong competitor, which would be worse than an
 * empty panel and much harder to notice.
 */
@Injectable()
export class CompetitorLocalService {
  private readonly logger = new Logger(CompetitorLocalService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly localSeo?: LocalSeoService,
  ) {}

  /**
   * Refreshes every tracked competitor that has something to search on.
   *
   * A competitor with no Maps name and no city is skipped rather than searched
   * by domain: a domain is a poor query for a local listing and would match
   * confidently against the wrong shop.
   */
  async refreshProject(projectId: string): Promise<LocalRefreshResult> {
    if (!this.localSeo) {
      return { checked: 0, matched: 0, skippedReason: 'Local lookups are not available on this deployment.' };
    }
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      return {
        checked: 0,
        matched: 0,
        skippedReason: 'GOOGLE_PLACES_API_KEY is not set, so no competitor listings can be looked up.',
      };
    }

    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId },
      select: { id: true, name: true, label: true, domain: true, mapsName: true, city: true },
    });

    let checked = 0;
    let matched = 0;

    for (const competitor of competitors) {
      const query = searchQueryFor(competitor);
      if (!query) continue;

      checked++;
      try {
        const results = await this.localSeo.searchBusiness(query);
        const best = bestMatch(results, competitor.mapsName || competitor.name || competitor.label || '');

        if (!best) {
          this.logger.debug(`No confident Google listing match for "${query}".`);
          continue;
        }

        await this.prisma.competitorDomain.update({
          where: { id: competitor.id },
          data: {
            placeId: best.placeId,
            localRating: best.rating ?? null,
            localReviewCount: best.userRatingsTotal ?? null,
            localAddress: best.address ?? null,
            localCheckedAt: new Date(),
          },
        });
        matched++;
      } catch (err: any) {
        // One competitor that cannot be found must not end the sweep, and the
        // reason is worth keeping: a quota error and a no-match look identical
        // from the outside otherwise.
        this.logger.warn(`Local lookup failed for "${query}": ${err?.message ?? err}`);
      }
    }

    return { checked, matched };
  }
}

/** What to search Google for, or nothing if we have too little to go on. */
export function searchQueryFor(competitor: {
  mapsName?: string | null;
  name?: string | null;
  label?: string | null;
  city?: string | null;
}): string | null {
  const name = (competitor.mapsName || competitor.name || competitor.label || '').trim();
  if (!name) return null;

  const city = (competitor.city || '').trim();
  return city && !name.toLowerCase().includes(city.toLowerCase()) ? `${name} ${city}` : name;
}

/**
 * The result that is actually this competitor, or nothing.
 *
 * Google ranks by its own relevance, and its first result for a shop name is
 * frequently a different business with a similar name. Requiring the returned
 * name to share the distinctive words of what was asked for is a low bar that
 * still rules out the common wrong answers — and being unmatched is a
 * recoverable state, whereas storing a stranger's reviews under a competitor's
 * name quietly corrupts every comparison built on it.
 */
export interface PlaceResult {
  placeId: string;
  name: string;
  address?: string;
  rating?: number;
  userRatingsTotal?: number;
}

export function bestMatch<T extends PlaceResult>(results: T[], expectedName: string): T | null {
  const wanted = distinctiveWords(expectedName);
  if (wanted.length === 0) return null;

  for (const result of results) {
    const got = distinctiveWords(result.name);
    const shared = wanted.filter((word) => got.includes(word));
    // A strict majority, not half. Half lets a two-word brand match on one
    // word, which is how "Country Delight" matched "Delight Sweets & Bakery" —
    // a different business whose reviews would then be reported as theirs.
    const needed = wanted.length === 1 ? 1 : Math.floor(wanted.length / 2) + 1;
    if (shared.length >= needed) return result;
  }

  return null;
}

/** Words worth matching on: brand terms, not "the" or "private limited". */
function distinctiveWords(value: string): string[] {
  const stop = new Set([
    'the', 'and', 'ltd', 'limited', 'pvt', 'private', 'llp', 'inc', 'co', 'company',
    'store', 'shop', 'services', 'service',
  ]);
  return [
    ...new Set(
      (value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2 && !stop.has(word)),
    ),
  ];
}
