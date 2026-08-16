import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ContentPieceKind, ContentPieceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { AgentRunService } from '../agents/agent-run.service';
import { ContentAgentService } from './content-agent.service';

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
      localLocation: { findUnique: jest.fn().mockResolvedValue(null) },
      contentPiece: {
        findUnique: jest.fn().mockResolvedValue(null),
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
      prisma.contentPiece.findUnique.mockResolvedValue({ id: 'piece_1', status: ContentPieceStatus.DRAFTED });

      const piece = await service.review('piece_1', 'APPROVE');
      expect(piece.status).toBe(ContentPieceStatus.COMMITTED);
    });

    it('moves a rejected draft to REJECTED', async () => {
      prisma.contentPiece.findUnique.mockResolvedValue({ id: 'piece_1', status: ContentPieceStatus.DRAFTED });

      const piece = await service.review('piece_1', 'REJECT');
      expect(piece.status).toBe(ContentPieceStatus.REJECTED);
    });

    it('will not re-review something already published', async () => {
      prisma.contentPiece.findUnique.mockResolvedValue({ id: 'piece_1', status: ContentPieceStatus.PUBLISHED });

      await expect(service.review('piece_1', 'REJECT')).rejects.toThrow(BadRequestException);
    });
  });
});
