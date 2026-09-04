import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { normalizeDomain } from '../ai-visibility/citation/citation-detector';

export interface CompetitorInput {
  businessName?: string;
  websiteUrl: string;
  mapsName?: string;
  youtubeUrl?: string;
  instagramHandle?: string;
  industry?: string;
  city?: string;
}

/**
 * The five competitors a project tracks, and how to reach each one.
 *
 * Five is a product decision, not a technical one: past that the comparison
 * stops being a decision aid and becomes a spreadsheet, and every extra
 * competitor costs a crawl and an API quota on every sweep.
 */
export const MAX_COMPETITORS = 5;

@Injectable()
export class CompetitorSetupService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string) {
    const rows = await this.prisma.competitorDomain.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        domain: true,
        name: true,
        label: true,
        industry: true,
        city: true,
        mapsName: true,
        youtubeUrl: true,
        instagramHandle: true,
        status: true,
        lastAnalyzedAt: true,
        socialAccounts: { select: { platform: true, handle: true, lastSyncedAt: true } },
      },
    });

    return {
      competitors: rows,
      slotsUsed: rows.length,
      slotsTotal: MAX_COMPETITORS,
    };
  }

  async create(organizationId: string, projectId: string, input: CompetitorInput) {
    const domain = normalizeDomain(input.websiteUrl || '');
    if (!domain || !domain.includes('.')) {
      throw new BadRequestException('A valid competitor website URL is required.');
    }

    const existing = await this.prisma.competitorDomain.count({ where: { projectId } });
    if (existing >= MAX_COMPETITORS) {
      throw new BadRequestException(
        `This project already tracks ${MAX_COMPETITORS} competitors. Remove one before adding another.`,
      );
    }

    const duplicate = await this.prisma.competitorDomain.findUnique({
      where: { projectId_domain: { projectId, domain } },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException(`${domain} is already tracked for this project.`);
    }

    const competitor = await this.prisma.competitorDomain.create({
      data: {
        projectId,
        domain,
        name: input.businessName?.trim() || null,
        label: input.businessName?.trim() || null,
        industry: input.industry?.trim() || null,
        city: input.city?.trim() || null,
        mapsName: input.mapsName?.trim() || null,
        youtubeUrl: input.youtubeUrl?.trim() || null,
        instagramHandle: normalizeHandle(input.instagramHandle),
        // Left at the schema default of PENDING with no lastAnalyzedAt: nothing
        // has been crawled yet and the row must not claim otherwise.
      },
    });

    await this.syncSocialAccounts(organizationId, projectId, competitor.id, {
      youtubeUrl: competitor.youtubeUrl,
      instagramHandle: competitor.instagramHandle,
      displayName: competitor.name ?? competitor.domain,
    });

    return competitor;
  }

  async update(
    organizationId: string,
    projectId: string,
    competitorId: string,
    input: Partial<CompetitorInput>,
  ) {
    const existing = await this.prisma.competitorDomain.findFirst({
      where: { id: competitorId, projectId },
      select: { id: true, domain: true },
    });
    if (!existing) throw new NotFoundException('Competitor not found for this project.');

    // The domain identifies the competitor and is what every crawl and finding
    // hangs off, so changing it is adding a different company. Rejected rather
    // than silently re-pointing the history of the old one.
    if (input.websiteUrl) {
      const domain = normalizeDomain(input.websiteUrl);
      if (domain && domain !== existing.domain) {
        throw new BadRequestException(
          'A competitor\'s website cannot be changed. Delete this competitor and add the new one, so its crawl ' +
            'history is not attributed to a different company.',
        );
      }
    }

    const updated = await this.prisma.competitorDomain.update({
      where: { id: existing.id },
      data: {
        ...(input.businessName !== undefined
          ? { name: input.businessName?.trim() || null, label: input.businessName?.trim() || null }
          : {}),
        ...(input.industry !== undefined ? { industry: input.industry?.trim() || null } : {}),
        ...(input.city !== undefined ? { city: input.city?.trim() || null } : {}),
        ...(input.mapsName !== undefined ? { mapsName: input.mapsName?.trim() || null } : {}),
        ...(input.youtubeUrl !== undefined ? { youtubeUrl: input.youtubeUrl?.trim() || null } : {}),
        ...(input.instagramHandle !== undefined
          ? { instagramHandle: normalizeHandle(input.instagramHandle) }
          : {}),
      },
    });

    await this.syncSocialAccounts(organizationId, projectId, updated.id, {
      youtubeUrl: updated.youtubeUrl,
      instagramHandle: updated.instagramHandle,
      displayName: updated.name ?? updated.domain,
    });

    return updated;
  }

  /**
   * Turns the handles typed into the form into accounts the sweep can read.
   *
   * Without this the fields were decorative. Content ingestion iterates
   * `CompetitorAccount`, and those rows were only ever created by social
   * discovery crawling a competitor's site for links — so a handle entered by
   * hand reached the database and stopped there, and the operator had no way
   * to tell that the channel they had just supplied was never being synced.
   *
   * A handle that is cleared or replaced deactivates its old account rather
   * than deleting it: the content already collected under it stays attached to
   * something, and reinstating the handle picks the history back up.
   */
  private async syncSocialAccounts(
    organizationId: string,
    projectId: string,
    competitorId: string,
    identities: { youtubeUrl: string | null; instagramHandle: string | null; displayName: string },
  ): Promise<void> {
    const wanted: Array<{ platform: 'YOUTUBE' | 'INSTAGRAM'; handle: string }> = [];

    const youtube = youtubeHandle(identities.youtubeUrl);
    if (youtube) wanted.push({ platform: 'YOUTUBE', handle: youtube });
    if (identities.instagramHandle) {
      wanted.push({ platform: 'INSTAGRAM', handle: identities.instagramHandle });
    }

    for (const entry of wanted) {
      await this.prisma.competitorAccount.upsert({
        where: {
          projectId_platform_handle: {
            projectId,
            platform: entry.platform,
            handle: entry.handle,
          },
        },
        update: { competitorId, isActive: true, displayName: identities.displayName },
        create: {
          organizationId,
          projectId,
          competitorId,
          platform: entry.platform,
          handle: entry.handle,
          displayName: identities.displayName,
          discoverySource: 'MANUAL',
          isActive: true,
        },
      });
    }

    // Anything previously entered for this competitor that is no longer wanted.
    const keep = wanted.map((entry) => entry.handle);
    await this.prisma.competitorAccount.updateMany({
      where: {
        projectId,
        competitorId,
        discoverySource: 'MANUAL',
        platform: { in: ['YOUTUBE', 'INSTAGRAM'] },
        ...(keep.length ? { handle: { notIn: keep } } : {}),
      },
      data: { isActive: false },
    });
  }

  async remove(projectId: string, competitorId: string) {
    const existing = await this.prisma.competitorDomain.findFirst({
      where: { id: competitorId, projectId },
      select: { id: true, domain: true },
    });
    if (!existing) throw new NotFoundException('Competitor not found for this project.');

    // Findings point at the competitor with SetNull, so removing one leaves the
    // observations that mentioned it rather than rewriting history. The next
    // run replaces them anyway.
    await this.prisma.competitorDomain.delete({ where: { id: existing.id } });
    return { removed: existing.domain };
  }
}

/**
 * The channel identifier out of whatever form it was pasted in.
 *
 * `@handle`, a `/channel/UC…` id and a bare handle are all accepted; the
 * scraper resolves whichever it is to a channel id at sync time.
 */
export function youtubeHandle(value?: string | null): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;

  const channelId = /youtube\.com\/channel\/([^/?#]+)/i.exec(raw);
  if (channelId) return channelId[1];

  const atHandle = /youtube\.com\/@([^/?#]+)/i.exec(raw);
  if (atHandle) return `@${atHandle[1]}`;

  const legacy = /youtube\.com\/(?:c|user)\/([^/?#]+)/i.exec(raw);
  if (legacy) return legacy[1];

  if (raw.startsWith('@')) return raw;
  // A bare word is a handle; anything with a slash we could not read.
  return raw.includes('/') ? null : `@${raw}`;
}

/** `@handle`, `handle` and a profile URL all mean the same account. */
function normalizeHandle(value?: string | null): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;

  const fromUrl = /instagram\.com\/([^/?#]+)/i.exec(raw);
  const handle = (fromUrl ? fromUrl[1] : raw).replace(/^@/, '').trim();
  return handle ? `@${handle}` : null;
}
