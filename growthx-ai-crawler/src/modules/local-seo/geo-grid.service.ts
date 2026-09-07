import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';

export interface GridCompetitor {
  name: string;
  rank: number;
  placeId?: string;
  rating?: number;
  reviewsCount?: number;
  isClient: boolean;
}

export interface GridNode {
  id: string;
  row: number;
  col: number;
  lat: number;
  lng: number;
  distanceKm: number;
  direction: string;
  /**
   * Where the business placed here, or null when it did not appear at all.
   *
   * Null rather than a sentinel like 21: "absent from the results" and "placed
   * last" are different facts, and a heat map that renders them identically
   * tells the operator something untrue.
   */
  rank: number | null;
  businessFound: boolean;
  /** How many results the source actually returned at this coordinate. */
  resultCount: number;
  topCompetitors: GridCompetitor[];
}

export interface GeoGridScanRequest {
  keyword: string;
  businessName?: string;
  lat?: number;
  lng?: number;
  gridSize?: 3 | 5 | 7 | 9;
  radiusKm?: number;
}

export interface GeoGridScanResult {
  runId: string;
  keyword: string;
  businessName: string;
  centerCoordinates: { lat: number; lng: number };
  gridSize: number;
  radiusKm: number;
  scannedAt: string;
  source: string;
  metrics: {
    /** Mean of the ranks actually observed. Null when found nowhere. */
    averageGridRank: number | null;
    top3DominancePercentage: number;
    top1Count: number;
    top3Count: number;
    top10Count: number;
    /** Coordinates where the business did not appear in the results at all. */
    unrankedCount: number;
    foundCount: number;
  };
  nodes: GridNode[];
  aiGeoActionPlan: {
    diagnosis: string;
    keyVulnerabilities: string[];
    actionItems: {
      action: string;
      impact: 'HIGH' | 'MEDIUM' | 'LOW';
      targetZone: string;
      description: string;
    }[];
  };
  model?: string;
}

const AI_GEO_SCHEMA = {
  type: 'object',
  properties: {
    diagnosis: { type: 'string', description: '2-3 sentence overview of the geographical ranking radius and strong/weak quadrants' },
    keyVulnerabilities: {
      type: 'array',
      items: { type: 'string' },
      description: 'Why the business is losing rank in peripheral or specific directional nodes',
    },
    actionItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          impact: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          targetZone: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['action', 'impact', 'targetZone', 'description'],
      },
    },
  },
  required: ['diagnosis', 'keyVulnerabilities', 'actionItems'],
  additionalProperties: false,
} as const;

const VALID_GRID_SIZES = [3, 5, 7, 9] as const;
/** Google Places returns at most 20 results per query. */
const MAX_RESULTS_PER_POINT = 20;
/** Concurrent Places calls. A 9x9 grid is 81 lookups; unbounded fan-out gets rate limited. */
const LOOKUP_CONCURRENCY = 5;

@Injectable()
export class GeoGridService {
  private readonly logger = new Logger(GeoGridService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  /**
   * Measures a keyword at every coordinate of an N x N grid and stores the run.
   *
   * Every rank here comes from a Google Places query issued at that coordinate.
   * The previous implementation computed ranks from a distance formula plus a
   * "quadrant bias", invented competitor names from a template, and hardcoded
   * their ratings and review counts — a heat map that looked plausible and
   * described nothing. That is the same failure already fixed in business
   * search, review sync and citation counts, and it is why this method refuses
   * rather than degrades when it has no source to measure with.
   */
  async runGeoGridScan(
    projectId: string,
    organizationId: string,
    params: GeoGridScanRequest,
  ): Promise<GeoGridScanResult> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Geo-grid scanning is unavailable: GOOGLE_PLACES_API_KEY is not configured. ' +
          'Set it to enable Google Places rank lookups; no grid can be measured without it.',
      );
    }

    const keyword = params.keyword?.trim();
    if (!keyword) {
      throw new ServiceUnavailableException('A keyword is required to run a geo-grid scan.');
    }

    const gridSize = (VALID_GRID_SIZES as readonly number[]).includes(params.gridSize ?? 0)
      ? (params.gridSize as number)
      : 3;
    const radiusKm = params.radiusKm && params.radiusKm > 0 ? params.radiusKm : 5;

    const [location, project] = await Promise.all([
      this.prisma.localLocation.findFirst({ where: { projectId } }),
      this.prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    ]);

    const businessName = params.businessName?.trim() || location?.businessName || project?.name;
    if (!businessName) {
      throw new ServiceUnavailableException(
        'Geo-grid scanning needs a business name to look for. Add a location profile to this project, ' +
          'or pass a business name with the request.',
      );
    }

    const centerLat = params.lat ?? location?.latitude;
    const centerLng = params.lng ?? location?.longitude;
    if (centerLat == null || centerLng == null) {
      // The previous code defaulted to central Mumbai whenever coordinates were
      // missing, which silently measured a grid around the wrong city.
      throw new ServiceUnavailableException(
        'Geo-grid scanning needs the coordinates of the business. Add latitude and longitude to the ' +
          "project's location profile, or pass lat and lng with the request.",
      );
    }

    this.logger.log(
      `Geo-grid ${gridSize}x${gridSize} for "${businessName}" keyword "${keyword}" radius ${radiusKm}km`,
    );

    const coordinates = this.gridCoordinates(centerLat, centerLng, gridSize, radiusKm);
    const nodes = await this.measureNodes(coordinates, keyword, businessName, radiusKm, gridSize, apiKey);

    const found = nodes.filter((n) => n.rank != null).map((n) => n.rank as number);
    const averageGridRank = found.length
      ? Number((found.reduce((a, b) => a + b, 0) / found.length).toFixed(1))
      : null;
    const top1Count = found.filter((r) => r === 1).length;
    const top3Count = found.filter((r) => r <= 3).length;
    const top10Count = found.filter((r) => r <= 10).length;
    const unrankedCount = nodes.length - found.length;
    const top3DominancePercentage = Math.round((top3Count / nodes.length) * 100);

    const run = await this.persistRun({
      projectId,
      locationId: location?.id ?? null,
      keyword,
      gridSize,
      centerLat,
      centerLng,
      radiusKm,
      averageRank: averageGridRank,
      foundCount: found.length,
      top3Count,
      top10Count,
      pointCount: nodes.length,
      nodes,
    });

    const aiGeoActionPlan = await this.generateAiActionPlan(
      businessName,
      keyword,
      radiusKm,
      gridSize,
      averageGridRank,
      top3DominancePercentage,
      nodes,
      organizationId,
    );

    return {
      runId: run.id,
      keyword,
      businessName,
      centerCoordinates: { lat: centerLat, lng: centerLng },
      gridSize,
      radiusKm,
      scannedAt: run.ranAt.toISOString(),
      source: run.source,
      metrics: {
        averageGridRank,
        top3DominancePercentage,
        top1Count,
        top3Count,
        top10Count,
        unrankedCount,
        foundCount: found.length,
      },
      nodes,
      aiGeoActionPlan: aiGeoActionPlan.plan as any,
      model: aiGeoActionPlan.model,
    };
  }

  /**
   * Previous runs for a project, newest first.
   *
   * The point of storing runs: a single grid is a snapshot, and "are we gaining
   * ground in the north-east" needs the ones before it.
   */
  async history(projectId: string, keyword?: string, limit = 20) {
    return this.prisma.geoGridRun.findMany({
      where: { projectId, ...(keyword ? { keyword } : {}) },
      orderBy: { ranAt: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        keyword: true,
        gridSize: true,
        radiusKm: true,
        averageRank: true,
        foundCount: true,
        top3Count: true,
        top10Count: true,
        pointCount: true,
        source: true,
        ranAt: true,
      },
    });
  }

  /** One stored run with every coordinate and the businesses seen there. */
  async run(runId: string) {
    return this.prisma.geoGridRun.findUnique({
      where: { id: runId },
      include: {
        points: {
          orderBy: [{ row: 'asc' }, { col: 'asc' }],
          include: { competitors: { orderBy: { rank: 'asc' } } },
        },
      },
    });
  }

  private async persistRun(input: {
    projectId: string;
    locationId: string | null;
    keyword: string;
    gridSize: number;
    centerLat: number;
    centerLng: number;
    radiusKm: number;
    averageRank: number | null;
    foundCount: number;
    top3Count: number;
    top10Count: number;
    pointCount: number;
    nodes: GridNode[];
  }) {
    return this.prisma.geoGridRun.create({
      data: {
        projectId: input.projectId,
        locationId: input.locationId,
        keyword: input.keyword,
        gridSize: input.gridSize,
        centerLat: input.centerLat,
        centerLng: input.centerLng,
        radiusKm: input.radiusKm,
        averageRank: input.averageRank,
        foundCount: input.foundCount,
        top3Count: input.top3Count,
        top10Count: input.top10Count,
        pointCount: input.pointCount,
        points: {
          create: input.nodes.map((node) => ({
            row: node.row,
            col: node.col,
            lat: node.lat,
            lng: node.lng,
            distanceKm: node.distanceKm,
            direction: node.direction,
            rank: node.rank,
            resultCount: node.resultCount,
            competitors: {
              create: node.topCompetitors.map((c) => ({
                rank: c.rank,
                name: c.name,
                placeId: c.placeId ?? null,
                rating: c.rating ?? null,
                reviewCount: c.reviewsCount ?? null,
                isClient: c.isClient,
              })),
            },
          })),
        },
      },
    });
  }

  /** Runs the per-coordinate lookups with a bounded number in flight. */
  private async measureNodes(
    coordinates: Omit<GridNode, 'rank' | 'businessFound' | 'topCompetitors' | 'resultCount'>[],
    keyword: string,
    businessName: string,
    radiusKm: number,
    gridSize: number,
    apiKey: string,
  ): Promise<GridNode[]> {
    // The radius each lookup is biased to: half a grid step, so neighbouring
    // coordinates probe distinguishable areas rather than all returning the
    // same city-wide result set.
    const stepKm = gridSize > 1 ? (2 * radiusKm) / (gridSize - 1) : radiusKm;
    const biasRadiusM = Math.max(500, Math.round((stepKm / 2) * 1000));

    const nodes: GridNode[] = new Array(coordinates.length);
    let cursor = 0;

    const worker = async () => {
      while (cursor < coordinates.length) {
        const index = cursor++;
        const coord = coordinates[index];
        const results = await this.placesRankAt(keyword, coord.lat, coord.lng, biasRadiusM, apiKey);
        const clientIndex = results.findIndex((r) => namesMatch(r.name, businessName));

        nodes[index] = {
          ...coord,
          rank: clientIndex >= 0 ? clientIndex + 1 : null,
          businessFound: clientIndex >= 0,
          resultCount: results.length,
          topCompetitors: results.slice(0, 5).map((r, i) => ({
            name: r.name,
            rank: i + 1,
            placeId: r.placeId,
            rating: r.rating,
            reviewsCount: r.reviewsCount,
            isClient: i === clientIndex,
          })),
        };
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(LOOKUP_CONCURRENCY, coordinates.length) }, () => worker()),
    );

    return nodes;
  }

  /** The ranked Places results for a keyword, as seen from one coordinate. */
  private async placesRankAt(
    keyword: string,
    lat: number,
    lng: number,
    biasRadiusM: number,
    apiKey: string,
  ): Promise<{ placeId: string; name: string; rating?: number; reviewsCount?: number }[]> {
    let response: Response;
    try {
      response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.rating,places.userRatingCount',
        },
        body: JSON.stringify({
          textQuery: keyword,
          maxResultCount: MAX_RESULTS_PER_POINT,
          locationBias: {
            circle: { center: { latitude: lat, longitude: lng }, radius: biasRadiusM },
          },
        }),
      });
    } catch (err) {
      throw new BadGatewayException(
        `Google Places lookup failed at ${lat},${lng}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      const body = await response.text();
      let message = `Google Places API returned HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(body);
        if (parsed?.error?.message) message = `Google Places API error (${response.status}): ${parsed.error.message}`;
      } catch {
        if (body) message += `: ${body}`;
      }
      this.logger.error(message);
      throw new BadGatewayException(message);
    }

    const data = await response.json();
    return (data.places || []).map((place: any) => ({
      placeId: place.id,
      name: place.displayName?.text || 'Unknown',
      rating: place.rating ?? undefined,
      reviewsCount: place.userRatingCount ?? undefined,
    }));
  }

  /** The coordinates of the grid. Geometry only — no ranks are implied here. */
  private gridCoordinates(
    centerLat: number,
    centerLng: number,
    gridSize: number,
    radiusKm: number,
  ): Omit<GridNode, 'rank' | 'businessFound' | 'topCompetitors' | 'resultCount'>[] {
    const kmPerLatDegree = 111.32;
    const kmPerLngDegree = 111.32 * Math.cos((centerLat * Math.PI) / 180);
    const halfGrid = Math.floor(gridSize / 2);
    const stepKm = gridSize > 1 ? (2 * radiusKm) / (gridSize - 1) : 0;

    const coords: Omit<GridNode, 'rank' | 'businessFound' | 'topCompetitors' | 'resultCount'>[] = [];

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const offsetRow = r - halfGrid;
        const offsetCol = c - halfGrid;
        const deltaYKm = -offsetRow * stepKm; // north is positive
        const deltaXKm = offsetCol * stepKm; // east is positive

        coords.push({
          id: `node-${r}-${c}`,
          row: r,
          col: c,
          lat: Number((centerLat + deltaYKm / kmPerLatDegree).toFixed(6)),
          lng: Number((centerLng + deltaXKm / kmPerLngDegree).toFixed(6)),
          distanceKm: Number(Math.sqrt(deltaXKm * deltaXKm + deltaYKm * deltaYKm).toFixed(2)),
          direction: cardinalDirection(offsetRow, offsetCol),
        });
      }
    }

    return coords;
  }

  private async generateAiActionPlan(
    businessName: string,
    keyword: string,
    radiusKm: number,
    gridSize: number,
    agr: number | null,
    top3Share: number,
    nodes: GridNode[],
    organizationId: string,
  ) {
    const absent = nodes.filter((n) => n.rank == null);
    const weakNodes = nodes.filter((n) => n.rank != null && (n.rank as number) > 3);
    const redNodes = nodes.filter((n) => n.rank != null && (n.rank as number) > 9);

    const systemPrompt = `You are a Local SEO & Google Business Profile (GBP) algorithm engineer.
Analyze the local Geo-Grid rank heatmap data for the client and write an aggressive, high-ROI geo-expansion plan.
Identify exactly why proximity decay is occurring in weaker quadrants and provide tactical recommendations (e.g. Geotagged review requests, Service Area Pages with schema, Localized citations, GPost updates).
Every rank below was measured. Where the business did not appear in the results at all, that is stated as "absent" — do not treat absent as a numeric rank.`;

    const prompt = `Client Business: "${businessName}"
Target Local Keyword: "${keyword}"
Grid Size: ${gridSize}x${gridSize} (${nodes.length} coordinate points)
Coverage Radius: ${radiusKm} km
Average Grid Rank (AGR), over the points where it appeared: ${agr == null ? 'not ranked anywhere' : `#${agr}`}
Top 3 Dominance: ${top3Share}%
Absent from results entirely: ${absent.length} of ${nodes.length} points

Grid Node Summary:
- Top 3 Rankings: ${nodes.length - weakNodes.length - absent.length} nodes
- Weak / Peripheral Dropoffs: ${weakNodes.length} nodes
- Critical Dropoff Directions: ${redNodes.map((n) => `${n.direction} (${n.distanceKm}km, Rank #${n.rank})`).slice(0, 8).join(', ') || 'None'}
- Absent Directions: ${absent.map((n) => `${n.direction} (${n.distanceKm}km)`).slice(0, 8).join(', ') || 'None'}

Generate a concise diagnosis, key vulnerabilities, and prioritized action items.`;

    try {
      const result = await this.router.generate({
        prompt,
        systemInstruction: systemPrompt,
        task: AiTask.LOCAL_SEO_ANALYSIS,
        organizationId,
        jsonSchema: AI_GEO_SCHEMA as unknown as Record<string, unknown>,
        maxTokens: 2500,
      });

      if (result.text?.trim()) {
        return { plan: this.parseJson(result.text), model: result.model };
      }
    } catch (err) {
      this.logger.warn(`AI geo plan generation unavailable: ${err}`);
    }

    // Fallback when no model answered. It describes only what the scan actually
    // measured — the previous fallback asserted a "strong rank within the
    // immediate 2km radius" regardless of what the grid showed.
    return {
      plan: {
        diagnosis:
          agr == null
            ? `"${businessName}" did not appear in the results for "${keyword}" at any of the ${nodes.length} coordinates scanned within ${radiusKm}km.`
            : `"${businessName}" ranks #${agr} on average across the ${nodes.length - absent.length} of ${nodes.length} coordinates where it appeared, and is absent from ${absent.length}.`,
        keyVulnerabilities: [
          absent.length
            ? `Absent from the result set entirely at ${absent.length} coordinate(s).`
            : 'Appears in the result set at every coordinate scanned.',
          redNodes.length
            ? `Ranks outside the top 10 at ${redNodes.length} coordinate(s).`
            : 'Ranks within the top 10 wherever it appears.',
        ],
        actionItems: [
          {
            action: 'Review the coordinates with the weakest placement',
            impact: 'HIGH' as const,
            targetZone: redNodes.length ? redNodes[0].direction : 'Outer perimeter',
            description:
              'An AI action plan could not be generated for this scan. The stored run holds the ranked ' +
              'result set at every coordinate; the weakest directions are the place to start.',
          },
        ],
      },
      model: 'unavailable',
    };
  }

  /** Reads the model's JSON answer, repairing truncation or naming the failure. */
  private parseJson(text: string): Record<string, any> {
    return parseModelJson(text, 'Geo grid');
  }
}

/**
 * Whether a Places result is the tracked business.
 *
 * Compared loosely because Google's display name carries suffixes the operator
 * did not type ("Bright Smile Dental" vs "Bright Smile Dental Clinic"), but
 * never so loosely that a different business matches: one name must contain the
 * whole of the other.
 */
function namesMatch(resultName: string, businessName: string): boolean {
  const a = normalizeName(resultName);
  const b = normalizeName(businessName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cardinalDirection(offsetRow: number, offsetCol: number): string {
  if (offsetRow === 0 && offsetCol === 0) return 'Center';
  if (offsetRow < 0 && offsetCol === 0) return 'North';
  if (offsetRow > 0 && offsetCol === 0) return 'South';
  if (offsetRow === 0 && offsetCol > 0) return 'East';
  if (offsetRow === 0 && offsetCol < 0) return 'West';
  if (offsetRow < 0 && offsetCol > 0) return 'North-East';
  if (offsetRow < 0 && offsetCol < 0) return 'North-West';
  if (offsetRow > 0 && offsetCol > 0) return 'South-East';
  return 'South-West';
}
