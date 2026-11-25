import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  BusinessContextSummary,
  CatalogHighlight,
  LocalPresenceSummary,
} from './report-playbook.types';

const UTILITY_PATH_RE =
  /^\/(app|account|my-account|cart|checkout|login|signin|sign-in|signup|sign-up|register|auth|privacy|terms|refund|shipping|return|policy|policies|search|404|admin|api|wp-admin|dashboard|orders|profile|wishlist|wallet)(\/|$)/i;

const GENERIC_TITLE_RE =
  /^(home|homepage|about|about us|contact|contact us|privacy policy|terms|login|sign in|cart|checkout|404|page not found)$/i;

const NON_LOCATION_WORDS = new Set([
  'home',
  'online',
  'india',
  'minutes',
  'hours',
  'days',
  'weeks',
  'months',
  'steps',
  'hindi',
  'english',
  'marathi',
  'bulk',
  'glass',
  'bottles',
  'bottle',
  'morning',
  'evening',
  'stock',
  'detail',
  'details',
  'touch',
  'progress',
  'general',
  'seconds',
  'packs',
  'pack',
  'liters',
  'litres',
  'grams',
  'offer',
  'offers',
  'sale',
  'store',
  'shop',
  'delivery',
  'service',
  'services',
  'fresh',
  'pure',
  'best',
  'near',
  'me',
  'area',
  'areas',
  'city',
  'cities',
  'location',
  'locations',
  'your',
  'our',
  'the',
  'this',
  'that',
  'all',
  'new',
  'top',
  '2024',
  '2025',
  '2026',
  '2027',
]);

function titleCaseLocation(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
  return cleaned
    .split(' ')
    .map((word) => {
      if (!word) return '';
      if (/^[A-Z]{2,4}$/.test(word)) return word;
      if (word.toLowerCase() === 'cbd') return 'CBD';
      if (word.toLowerCase() === 'hsr') return 'HSR';
      if (word.toLowerCase() === 'dlf') return 'DLF';
      if (word.toLowerCase() === 'omr') return 'OMR';
      if (word.toLowerCase() === 'jp') return 'JP';
      if (word.toLowerCase() === 'sg') return 'SG';
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function normalizeLocationCandidate(raw: string): string | null {
  const trimmed = raw
    .replace(/[|–—,:;!?()[\]{}].*$/, '')
    .replace(/\b(city|district|area|region|delivery|online|services?|near me)\b.*$/i, '')
    .trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 36) return null;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return null;
  if (words.every((w) => NON_LOCATION_WORDS.has(w.toLowerCase()))) return null;
  if (NON_LOCATION_WORDS.has(words[0].toLowerCase())) return null;
  if (/^\d+$/.test(trimmed)) return null;
  return titleCaseLocation(trimmed);
}

/**
 * Extracts concrete neighborhood/city names dynamically from crawled page titles
 * and URL slugs (e.g., "Fresh Delivery in <Area>" or "/delivery-in-<area>")
 * without relying on any hardcoded city list.
 */
export function extractLocationsFromPages(
  pages: Array<{ path: string; title: string; pageType?: string }>,
  excludeNames: string[] = [],
): string[] {
  const excluded = new Set(excludeNames.map((n) => n.trim().toLowerCase()).filter(Boolean));
  const seen = new Map<string, string>();

  const add = (candidate: string | null) => {
    if (!candidate) return;
    const key = candidate.toLowerCase();
    if (excluded.has(key)) return;
    if (!seen.has(key)) seen.set(key, candidate);
  };

  for (const page of pages) {
    // 1. Title pattern: "... in <Area Name>" (e.g. "Fresh Milk Delivery in <Area> | Brand")
    const titleMatches = page.title.matchAll(/\bin\s+([A-Za-z][A-Za-z0-9]*(?:\s+[A-Za-z][A-Za-z0-9]*){0,2})/gi);
    for (const m of titleMatches) {
      add(normalizeLocationCandidate(m[1]));
    }

    // 2. URL slug patterns: /...-in-<area>, /locations/<area>, /areas/<area>, /service-areas/<area>
    const decodedPath = page.path.replace(/\/+$/, '');
    const inSlug = decodedPath.match(/(?:^|[/-])in-([a-z0-9]+(?:-[a-z0-9]+){0,2})$/i);
    if (inSlug) add(normalizeLocationCandidate(inSlug[1].replace(/-/g, ' ')));

    const dirSlug = decodedPath.match(/\/(?:locations?|areas?|service-areas?|cities|neighborhoods|delivery)\/([a-z0-9]+(?:-[a-z0-9]+){0,2})$/i);
    if (dirSlug) add(normalizeLocationCandidate(dirSlug[1].replace(/-/g, ' ')));

    // 3. Explicit LOCATION pageType with trailing area slug (e.g. /fresh-delivery-<area>)
    if (page.pageType === 'LOCATION') {
      const deliverySlug = decodedPath.match(/(?:delivery|service|services|store|clinic|near)-([a-z0-9]+(?:-[a-z0-9]+){0,2})$/i);
      if (deliverySlug) add(normalizeLocationCandidate(deliverySlug[1].replace(/-/g, ' ')));
    }
  }

  return [...seen.values()];
}

function formatMinorPrice(minor: number | null | undefined, currency: string | null | undefined): string | null {
  if (minor == null || !Number.isFinite(minor) || minor <= 0) return null;
  const major = minor / 100;
  const code = (currency || 'INR').toUpperCase();
  const symbol = code === 'INR' ? '₹' : code === 'USD' ? '$' : code === 'GBP' ? '£' : code === 'EUR' ? '€' : `${code} `;
  return `${symbol}${Number.isInteger(major) ? major : major.toFixed(2)}`;
}

function pathOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname || '/';
  } catch {
    return rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  }
}

@Injectable()
export class UnifiedReportContextService {
  private readonly logger = new Logger(UnifiedReportContextService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds a unified, grounded business & hyper-local dossier for a project
   * from already-stored tables (zero extra LLM calls, safe optional reads).
   */
  async buildForProject(projectId: string): Promise<BusinessContextSummary | null> {
    try {
      const project = await this.prisma.project?.findUnique({
        where: { id: projectId },
        select: {
          name: true,
          businessProfile: true,
          websites: {
            where: { scope: 'own' },
            select: { id: true, domain: true },
            take: 1,
          },
        },
      });
      if (!project) return null;

      // Handle minimal mocks where `scope: 'own'` filter is omitted
      let website: { id: string; domain: string } | undefined = project.websites?.[0];
      if (!website && this.prisma.website?.findFirst) {
        website =
          (await this.prisma.website
            .findFirst({ where: { projectId }, select: { id: true, domain: true } })
            .catch(() => null)) ?? undefined;
      }

      const [
        latestJob,
        catalogRows,
        signalRows,
        localLocations,
        competitors,
        rivalCount,
        latestVisibility,
        visibilitySettings,
        openHighIssues,
      ] = await Promise.all([
        website && this.prisma.crawlJob?.findFirst
          ? this.prisma.crawlJob
              .findFirst({
                where: { websiteId: website.id, status: 'COMPLETED' },
                orderBy: { finishedAt: 'desc' },
                select: { id: true, healthScore: true, pagesCrawled: true },
              })
              .catch(() => null)
          : Promise.resolve(null),
        this.prisma.catalogProduct?.findMany
          ? this.prisma.catalogProduct
              .findMany({
                where: { projectId, competitorId: null },
                orderBy: { completenessScore: 'desc' },
                take: 12,
                select: { name: true, priceMinorUnits: true, currency: true, stockStatus: true, url: true },
              })
              .catch(() => [] as Array<{ name: string | null; priceMinorUnits: number | null; currency: string | null; stockStatus: string; url: string }>)
          : Promise.resolve([] as Array<{ name: string | null; priceMinorUnits: number | null; currency: string | null; stockStatus: string; url: string }>),
        this.prisma.marketingSignal?.findMany
          ? this.prisma.marketingSignal
              .findMany({
                where: { projectId, competitorId: null },
                take: 12,
                select: { kind: true, text: true },
              })
              .catch(() => [] as Array<{ kind: string; text: string }>)
          : Promise.resolve([] as Array<{ kind: string; text: string }>),
        this.prisma.localLocation?.findMany
          ? this.prisma.localLocation
              .findMany({
                where: { projectId },
                orderBy: { updatedAt: 'desc' },
                take: 10,
                select: { businessName: true, address: true, rating: true, reviewCount: true },
              })
              .catch(() => [] as Array<{ businessName: string; address: string; rating: number; reviewCount: number }>)
          : this.prisma.localLocation?.findFirst
            ? this.prisma.localLocation
                .findFirst({
                  where: { projectId },
                  orderBy: { updatedAt: 'desc' },
                  select: { businessName: true, address: true, rating: true, reviewCount: true },
                })
                .then((row) => (row ? [row] : []))
                .catch(() => [] as Array<{ businessName: string; address: string; rating: number; reviewCount: number }>)
            : Promise.resolve([] as Array<{ businessName: string; address: string; rating: number; reviewCount: number }>),
        this.prisma.competitorDomain?.findMany
          ? this.prisma.competitorDomain
              .findMany({
                where: { projectId },
                take: 5,
                select: {
                  website: {
                    select: {
                      crawlJobs: {
                        where: { status: 'COMPLETED' },
                        orderBy: { finishedAt: 'desc' },
                        take: 1,
                        select: { id: true },
                      },
                    },
                  },
                },
              })
              .catch(() => [] as Array<{ website?: { crawlJobs?: Array<{ id: string }> } | null }>)
          : Promise.resolve([] as Array<{ website?: { crawlJobs?: Array<{ id: string }> } | null }>),
        this.prisma.competitorDomain?.count
          ? this.prisma.competitorDomain.count({ where: { projectId } }).catch(() => 0)
          : Promise.resolve(0),
        this.prisma.aiVisibilityMetrics?.findFirst
          ? this.prisma.aiVisibilityMetrics
              .findFirst({
                where: { projectId },
                orderBy: { createdAt: 'desc' },
                select: { visibilityScore: true },
              })
              .catch(() => null)
          : Promise.resolve(null),
        this.prisma.aiVisibilitySettings?.findUnique
          ? this.prisma.aiVisibilitySettings
              .findUnique({
                where: { projectId },
                select: { targetCity: true, targetCountry: true },
              })
              .catch(() => null)
          : Promise.resolve(null),
        this.prisma.issue?.count
          ? this.prisma.issue
              .count({
                where: { projectId, status: 'OPEN', severity: { in: ['CRITICAL', 'HIGH'] } },
              })
              .catch(() => 0)
          : Promise.resolve(0),
      ]);

      const rivalJobIds = competitors
        .map((c) => c.website?.crawlJobs?.[0]?.id)
        .filter((id): id is string => Boolean(id));

      const [crawledPages, rivalPages] = await Promise.all([
        latestJob && this.prisma.page?.findMany
          ? this.prisma.page
              .findMany({
                where: { crawlJobId: latestJob.id, statusCode: { gte: 200, lt: 300 } },
                select: { url: true, title: true, h1: true, pageType: true },
                take: 120,
              })
              .catch(() => [] as Array<{ url: string; title: string | null; h1: string[]; pageType: unknown }>)
          : Promise.resolve([] as Array<{ url: string; title: string | null; h1: string[]; pageType: unknown }>),
        rivalJobIds.length > 0 && this.prisma.page?.findMany
          ? this.prisma.page
              .findMany({
                where: { crawlJobId: { in: rivalJobIds }, statusCode: { gte: 200, lt: 300 } },
                select: { url: true, title: true, h1: true, pageType: true },
                take: 150,
              })
              .catch(() => [] as Array<{ url: string; title: string | null; h1: string[]; pageType: unknown }>)
          : Promise.resolve([] as Array<{ url: string; title: string | null; h1: string[]; pageType: unknown }>),
      ]);

      const profile = project.businessProfile;
      const localLocation = localLocations[0] ?? null;

      const commercialPages = crawledPages
        .map((p) => ({
          path: pathOf(p.url),
          title: (p.title || p.h1?.[0] || '').trim(),
          pageType: String(p.pageType || 'OTHER'),
        }))
        .filter((p) => !UTILITY_PATH_RE.test(p.path));

      const rivalCommercialPages = rivalPages
        .map((p) => ({
          path: pathOf(p.url),
          title: (p.title || p.h1?.[0] || '').trim(),
          pageType: String(p.pageType || 'OTHER'),
        }))
        .filter((p) => !UTILITY_PATH_RE.test(p.path));

      // Resolve primary city & service areas strictly from stored project profile, settings, and crawled pages
      const serviceAreasSet = new Set<string>();
      const primaryCity = profile?.city?.trim() || visibilitySettings?.targetCity?.trim() || null;
      if (primaryCity) serviceAreasSet.add(primaryCity);
      if (visibilitySettings?.targetCity?.trim()) serviceAreasSet.add(visibilitySettings.targetCity.trim());

      const excludeFromSubAreas = [
        primaryCity ?? '',
        profile?.state?.trim() ?? '',
        profile?.country?.trim() ?? '',
      ].filter(Boolean);

      const ownDetectedAreas = extractLocationsFromPages(commercialPages, excludeFromSubAreas);
      const rivalDetectedAreas = extractLocationsFromPages(rivalCommercialPages, excludeFromSubAreas);

      for (const area of ownDetectedAreas) {
        if (!primaryCity) serviceAreasSet.add(area);
      }

      const coveredLower = new Set(ownDetectedAreas.map((a) => a.toLowerCase()));
      const missingAreas: string[] = [];
      const missingLower = new Set<string>();

      for (const area of rivalDetectedAreas) {
        const key = area.toLowerCase();
        if (!coveredLower.has(key) && !missingLower.has(key)) {
          missingLower.add(key);
          missingAreas.push(area);
        }
      }

      const serviceAreas = [...serviceAreasSet].slice(0, 8);
      const resolvedPrimaryCity = primaryCity || ownDetectedAreas[0] || null;

      // Build clean commercial offerings list
      const offeringSet = new Set<string>();
      for (const o of profile?.offerings ?? []) {
        const clean = o.trim();
        if (clean && !GENERIC_TITLE_RE.test(clean)) offeringSet.add(clean);
      }
      for (const c of catalogRows) {
        const clean = c.name?.trim();
        if (clean && !GENERIC_TITLE_RE.test(clean)) offeringSet.add(clean);
      }
      if (offeringSet.size < 4) {
        for (const p of commercialPages) {
          if (p.pageType === 'PRODUCT' || p.pageType === 'SERVICE') {
            const clean = p.title.split(/[|–—-]/)[0]?.trim();
            if (clean && clean.length >= 3 && clean.length <= 60 && !GENERIC_TITLE_RE.test(clean)) {
              offeringSet.add(clean);
            }
          }
        }
      }

      const catalogHighlights: CatalogHighlight[] = catalogRows
        .filter((c) => Boolean(c.name?.trim()))
        .slice(0, 8)
        .map((c) => ({
          name: c.name!.trim(),
          price: formatMinorPrice(c.priceMinorUnits, c.currency),
          stock: c.stockStatus && c.stockStatus !== 'NOT_YET_CRAWLED' ? String(c.stockStatus) : null,
          url: c.url,
        }));

      const trustSignals = [
        ...new Set(
          signalRows
            .map((s) => s.text?.trim())
            .filter((t): t is string => Boolean(t && t.length >= 4 && t.length <= 160)),
        ),
      ].slice(0, 8);

      const localPresence: LocalPresenceSummary | null = localLocation
        ? {
            rating: localLocation.rating > 0 ? Number(localLocation.rating.toFixed(1)) : null,
            reviewCount: localLocation.reviewCount > 0 ? localLocation.reviewCount : null,
            address: localLocation.address || null,
            businessName: localLocation.businessName || null,
          }
        : null;

      return {
        businessName: profile?.businessName?.trim() || project.name || website?.domain || 'Your Business',
        domain: website?.domain ?? profile?.domain ?? null,
        industry: profile?.industry?.trim() || null,
        businessModel: profile?.businessModel?.trim() || null,
        summary: profile?.summary?.trim() || null,
        targetAudience: profile?.targetAudience?.trim() || null,
        businessGoal: profile?.businessGoal?.trim() || null,
        offerings: [...offeringSet].slice(0, 10),
        primaryCity: resolvedPrimaryCity,
        state: profile?.state?.trim() || null,
        country: profile?.country?.trim() || visibilitySettings?.targetCountry?.trim() || null,
        serviceAreas,
        coveredAreas: ownDetectedAreas.slice(0, 12),
        missingAreas: missingAreas.slice(0, 10),
        keyPages: commercialPages.filter((p) => p.title).slice(0, 12),
        catalogHighlights,
        trustSignals,
        localPresence,
        crossModuleSnapshot: {
          auditHealthScore: latestJob?.healthScore ?? null,
          pagesAudited: latestJob?.pagesCrawled ?? crawledPages.length,
          openHighIssues,
          aiCitationSharePct: latestVisibility ? Math.round(latestVisibility.visibilityScore) : null,
          rivalCount: rivalCount || competitors.length,
        },
      };
    } catch (err) {
      this.logger.warn(`[${projectId}] Could not assemble unified report context: ${(err as Error).message}`);
      return null;
    }
  }
}
