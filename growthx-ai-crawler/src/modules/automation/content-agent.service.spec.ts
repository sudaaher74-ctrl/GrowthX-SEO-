import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ContentPieceKind, ContentPieceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { AgentRunService } from '../agents/agent-run.service';
import { ContentAgentController } from './content-agent.controller';
import { computeContentRevisionHash, ContentAgentService } from './content-agent.service';
import { WordPressCmsService } from './wordpress-cms.service';

function completion(body: unknown, title = 'Draft') {
  return {
    provider: AiProvider.ANTHROPIC,
    model: 'claude-opus-5',
    text: JSON.stringify({ title, metaDescription: '', body }),
    usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: null },
    refused: false,
  };
}

describe('ContentAgentService', () => {
  let service: ContentAgentService;
  let prisma: any;
  let router: { generate: jest.Mock };
  let agentRuns: any;

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proj_1',
          name: 'Northwind Outdoors',
          websites: [{ id: 'w1', domain: 'northwindoutdoors.com' }],
        }),
      },
      page: {
        findMany: jest.fn().mockResolvedValue([{ url: 'https://northwindoutdoors.com/jackets', title: 'Jackets' }]),
        findFirst: jest.fn().mockResolvedValue({
          url: 'https://northwindoutdoors.com/jackets',
          title: 'Jackets',
          metaDescription: 'Winter jackets',
          h1: ['Jackets'],
          h2: ['Sizing'],
          wordCount: 900,
          crawledAt: new Date('2026-08-01'),
        }),
      },
      localLocation: { findFirst: jest.fn().mockResolvedValue(null) },
      contentPiece: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({ id: 'piece_1', ...data })),
        update: jest.fn(async ({ data }: any) => ({ id: 'piece_1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    router = { generate: jest.fn().mockResolvedValue(completion('Some drafted copy.')) };

    agentRuns = {
      withRun: jest.fn(async (_p: string, _a: unknown, work: any) => {
        const { result } = await work({ id: 'run_1', projectId: 'proj_1', agent: 'CONTENT' });
        return result;
      }),
      recordEvidence: jest.fn().mockResolvedValue({ id: 'ev_1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentAgentService,
        { provide: PrismaService, useValue: prisma },
        { provide: MultiAiRouterService, useValue: router },
        { provide: AgentRunService, useValue: agentRuns },
      ],
    }).compile();

    service = module.get(ContentAgentService);
  });

  // The whole point of the agent is that a human sees the copy first.
  it('leaves every draft in DRAFTED, never published', async () => {
    const piece = await service.generate('proj_1', 'org_1', { kind: ContentPieceKind.GBP_POST, topic: 'Winter sale' });

    expect(piece.status).toBe(ContentPieceStatus.DRAFTED);
    expect(piece.kind).toBe(ContentPieceKind.GBP_POST);
  });

  it('links the draft to the evidence it was written from', async () => {
    const piece = await service.generate('proj_1', 'org_1', { kind: ContentPieceKind.FAQ, topic: 'Sizing' });

    expect(agentRuns.recordEvidence).toHaveBeenCalled();
    expect(piece.sourceEvidenceId).toBe('ev_1');
  });

  it('refuses to draft for a project that has never been crawled', async () => {
    prisma.page.findMany.mockResolvedValue([]);

    await expect(
      service.generate('proj_1', 'org_1', { kind: ContentPieceKind.BRIEF, topic: 'Jackets' }),
    ).rejects.toThrow(BadRequestException);
    expect(router.generate).not.toHaveBeenCalled();
  });

  describe('review replies', () => {
    it('requires the review text it is answering', async () => {
      await expect(
        service.generate('proj_1', 'org_1', { kind: ContentPieceKind.REVIEW_REPLY }),
      ).rejects.toThrow(BadRequestException);
      expect(router.generate).not.toHaveBeenCalled();
    });

    it('records the review itself as the evidence', async () => {
      await service.generate('proj_1', 'org_1', {
        kind: ContentPieceKind.REVIEW_REPLY,
        reviewText: 'Delivery was late but the jacket is great.',
        reviewRating: 3,
        reviewAuthor: 'Sam',
      });

      const [, evidence] = agentRuns.recordEvidence.mock.calls[0];
      expect(evidence.source).toBe('GBP_REVIEW');
      expect(evidence.summary).toContain('Delivery was late');
    });
  });

  describe('schema markup', () => {
    it('refuses a URL that was never crawled, rather than describing a page nobody read', async () => {
      prisma.page.findFirst.mockResolvedValue(null);

      await expect(
        service.generate('proj_1', 'org_1', {
          kind: ContentPieceKind.SCHEMA_MARKUP,
          pageUrl: 'https://northwindoutdoors.com/ghost',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('stores valid JSON-LD, reformatted', async () => {
      router.generate.mockResolvedValue(
        completion('{"@context":"https://schema.org","@type":"Product","name":"Jackets"}'),
      );

      const piece = await service.generate('proj_1', 'org_1', {
        kind: ContentPieceKind.SCHEMA_MARKUP,
        pageUrl: 'https://northwindoutdoors.com/jackets',
      });

      expect(JSON.parse(piece.body ?? '{}')['@type']).toBe('Product');
    });

    // Invalid JSON-LD silently does nothing once pasted into a page, so it is
    // rejected here rather than discovered in production.
    it('rejects markup that is not valid JSON-LD', async () => {
      router.generate.mockResolvedValue(completion('Here is your schema: <script>...</script>'));

      await expect(
        service.generate('proj_1', 'org_1', {
          kind: ContentPieceKind.SCHEMA_MARKUP,
          pageUrl: 'https://northwindoutdoors.com/jackets',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(prisma.contentPiece.create).not.toHaveBeenCalled();
    });
  });

  describe('review gate', () => {
    it('moves an approved draft to COMMITTED', async () => {
      prisma.contentPiece.findFirst.mockResolvedValue({ id: 'piece_1', status: ContentPieceStatus.DRAFTED });

      const piece = await service.review('proj_1', 'piece_1', 'APPROVE');
      expect(piece.status).toBe(ContentPieceStatus.COMMITTED);
    });

    it('moves a rejected draft to REJECTED', async () => {
      prisma.contentPiece.findFirst.mockResolvedValue({ id: 'piece_1', status: ContentPieceStatus.DRAFTED });

      const piece = await service.review('proj_1', 'piece_1', 'REJECT');
      expect(piece.status).toBe(ContentPieceStatus.REJECTED);
    });

    it("never reviews another project's draft", async () => {
      prisma.contentPiece.findFirst.mockResolvedValue(null);
      await expect(service.review('proj_other', 'piece_1', 'APPROVE')).rejects.toThrow(NotFoundException);
      expect(prisma.contentPiece.findFirst.mock.calls[0][0].where).toEqual({ id: 'piece_1', projectId: 'proj_other' });
      expect(prisma.contentPiece.update).not.toHaveBeenCalled();
    });

    it('will not re-review something already published', async () => {
      prisma.contentPiece.findFirst.mockResolvedValue({ id: 'piece_1', status: ContentPieceStatus.PUBLISHED });

      await expect(service.review('proj_1', 'piece_1', 'REJECT')).rejects.toThrow(BadRequestException);
    });
  });

  describe('revision-bound approval and atomic live CMS publication (service + controller)', () => {
    let controller: ContentAgentController;
    let cms: { publishContentDraftToCms: jest.Mock };
    let pieceStore: Map<string, any>;

    beforeEach(async () => {
      pieceStore = new Map();
      cms = {
        publishContentDraftToCms: jest.fn().mockResolvedValue({
          published: true,
          platform: 'WORDPRESS',
          externalId: 'wp-99',
          externalUrl: 'https://northwindoutdoors.com/blog/winter-jackets',
          status: 'publish',
          message: 'Published post live on WordPress.',
        }),
      };

      prisma.contentPiece = {
        findFirst: jest.fn(async ({ where }: any) => {
          const row = pieceStore.get(where.id);
          if (!row || row.projectId !== where.projectId) return null;
          return { ...row };
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = pieceStore.get(where.id);
          const next = { ...row, ...data };
          pieceStore.set(where.id, next);
          return { ...next };
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const row = pieceStore.get(where.id);
          if (!row) return { count: 0 };
          const matches = Object.entries(where).every(([k, v]) => (row[k] ?? null) === v);
          if (!matches) return { count: 0 };
          pieceStore.set(where.id, { ...row, ...data });
          return { count: 1 };
        }),
      };
      prisma.fixImpactLedgerEvent = { create: jest.fn().mockResolvedValue({}) };

      const mod: TestingModule = await Test.createTestingModule({
        controllers: [ContentAgentController],
        providers: [
          ContentAgentService,
          { provide: PrismaService, useValue: prisma },
          { provide: MultiAiRouterService, useValue: router },
          { provide: AgentRunService, useValue: agentRuns },
          { provide: WordPressCmsService, useValue: cms },
        ],
      }).compile();

      service = mod.get(ContentAgentService);
      controller = mod.get(ContentAgentController);

      const basePiece = {
        id: 'piece_pub_1',
        projectId: 'proj_1',
        kind: ContentPieceKind.ARTICLE,
        status: ContentPieceStatus.DRAFTED,
        title: 'Winter Jackets Guide',
        slug: 'winter-jackets-guide',
        metaDescription: 'Choose the right winter jacket.',
        body: '## Insulated Jackets\nStay warm.',
        revisionHash: null as string | null,
        approvedRevisionHash: null as string | null,
        approvedAt: null as Date | null,
        approvedByUserId: null as string | null,
        publishClaimToken: null as string | null,
        publishClaimedAt: null as Date | null,
        publishedAt: null as Date | null,
      };
      basePiece.revisionHash = computeContentRevisionHash(basePiece);
      pieceStore.set(basePiece.id, basePiece);
    });

    it('rejects publishing unreviewed (DRAFTED/PLANNED) or REJECTED pieces through controller and never calls CMS', async () => {
      await expect(
        controller.publishDraftToCms('proj_1', 'piece_pub_1', { platform: 'WORDPRESS', publishMode: 'publish' }),
      ).rejects.toThrow(BadRequestException);

      await controller.review({ user: { userId: 'reviewer_1' } }, 'proj_1', 'piece_pub_1', { decision: 'REJECT' });
      await expect(
        controller.publishDraftToCms('proj_1', 'piece_pub_1', { platform: 'WORDPRESS', publishMode: 'publish' }),
      ).rejects.toThrow(/Rejected/i);

      expect(cms.publishContentDraftToCms).not.toHaveBeenCalled();
    });

    it('invalidates approval when a draft is edited after approval and blocks publishing until re-approved', async () => {
      await controller.review({ user: { userId: 'reviewer_1' } }, 'proj_1', 'piece_pub_1', { decision: 'APPROVE' });
      expect(pieceStore.get('piece_pub_1').approvedRevisionHash).toBeTruthy();

      // Edit after approval must invalidate approval and return to DRAFTED.
      const edited = await controller.updateDraft('proj_1', 'piece_pub_1', {
        body: '## Unreviewed injected claim\nBuy now!',
      });
      expect(edited.status).toBe(ContentPieceStatus.DRAFTED);
      expect(edited.approvedRevisionHash).toBeNull();
      expect(edited.approvedAt).toBeNull();

      await expect(
        controller.publishDraftToCms('proj_1', 'piece_pub_1', { platform: 'WORDPRESS', publishMode: 'publish' }),
      ).rejects.toThrow(/approved/i);
      expect(cms.publishContentDraftToCms).not.toHaveBeenCalled();

      // Even if a tampered row kept COMMITTED status with an old approvedRevisionHash, mismatch must block publish.
      const row = pieceStore.get('piece_pub_1');
      pieceStore.set('piece_pub_1', {
        ...row,
        status: ContentPieceStatus.COMMITTED,
        approvedAt: new Date(),
        approvedRevisionHash: 'stale_hash_from_previous_revision',
      });
      await expect(
        service.publishDraftToCms('proj_1', 'piece_pub_1', { platform: 'WORDPRESS', publishMode: 'publish' }),
      ).rejects.toThrow(/modified after approval/i);
      expect(cms.publishContentDraftToCms).not.toHaveBeenCalled();
    });

    it('claims publication atomically so two concurrent publish requests only publish to CMS once', async () => {
      await controller.review({ user: { userId: 'reviewer_1' } }, 'proj_1', 'piece_pub_1', { decision: 'APPROVE' });

      let releaseCms!: () => void;
      cms.publishContentDraftToCms.mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseCms = () =>
              resolve({
                published: true,
                platform: 'WORDPRESS',
                externalId: 'wp-99',
                externalUrl: 'https://northwindoutdoors.com/blog/winter-jackets',
                status: 'publish',
                message: 'Published live.',
              });
          }),
      );

      const first = controller.publishDraftToCms('proj_1', 'piece_pub_1', {
        platform: 'WORDPRESS',
        publishMode: 'publish',
      });
      const second = controller.publishDraftToCms('proj_1', 'piece_pub_1', {
        platform: 'WORDPRESS',
        publishMode: 'publish',
      });

      await expect(second).rejects.toThrow(ConflictException);
      releaseCms();
      const firstResult = await first;
      expect(firstResult.piece.status).toBe(ContentPieceStatus.PUBLISHED);
      expect(cms.publishContentDraftToCms).toHaveBeenCalledTimes(1);

      // A retry after publication must also be rejected cleanly.
      await expect(
        controller.publishDraftToCms('proj_1', 'piece_pub_1', { platform: 'WORDPRESS', publishMode: 'publish' }),
      ).rejects.toThrow(ConflictException);
      expect(cms.publishContentDraftToCms).toHaveBeenCalledTimes(1);
    });
  });
});
