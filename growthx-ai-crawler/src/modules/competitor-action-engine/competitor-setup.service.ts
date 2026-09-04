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

  async create(projectId: string, input: CompetitorInput) {
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

    return this.prisma.competitorDomain.create({
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
  }

  async update(projectId: string, competitorId: string, input: Partial<CompetitorInput>) {
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

    return this.prisma.competitorDomain.update({
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

/** `@handle`, `handle` and a profile URL all mean the same account. */
function normalizeHandle(value?: string | null): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;

  const fromUrl = /instagram\.com\/([^/?#]+)/i.exec(raw);
  const handle = (fromUrl ? fromUrl[1] : raw).replace(/^@/, '').trim();
  return handle ? `@${handle}` : null;
}
