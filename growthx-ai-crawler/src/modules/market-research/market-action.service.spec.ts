import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MarketActionStatus, MarketActionType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MarketActionService, extractDomain } from './market-action.service';
import { OutcomeMeasurementService } from './outcome-measurement.service';

const ORG = 'org_1';
const PROJ = 'proj_1';

function action(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'act_1',
    organizationId: ORG,
    projectId: PROJ,
    type: MarketActionType.CONTENT_BRIEF,
    title: 'Write a comparison page',
    description: 'Competitors win this prompt',
    status: MarketActionStatus.PROPOSED,
    ...overrides,
  };
}

describe('MarketActionService', () => {
  let service: MarketActionService;
  let prisma: any;
  let outcomes: any;

  beforeEach(async () => {
    prisma = {
      marketAction: {
        findFirst: jest.fn().mockResolvedValue(action()),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(async ({ data }: any) => ({ id: 'act_1', ...data })),
      },
      marketOpportunity: { findMany: jest.fn().mockResolvedValue([]) },
      contentPiece: {
        create: jest.fn().mockResolvedValue({ id: 'piece_1' }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      trackedPrompt: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'prompt_1' }) },
      competitorDomain: { upsert: jest.fn().mockResolvedValue({ id: 'comp_1' }) },
      marketWatch: { upsert: jest.fn().mockResolvedValue({ id: 'watch_1' }) },
      outreachCampaign: { create: jest.fn().mockResolvedValue({ id: 'camp_1' }) },
    };

    outcomes = { captureBaseline: jest.fn().mockResolvedValue({ id: 'outcome_1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketActionService,
        { provide: PrismaService, useValue: prisma },
        { provide: OutcomeMeasurementService, useValue: outcomes },
      ],
    }).compile();

    service = module.get(MarketActionService);
  });

  it('refuses an action belonging to another tenant', async () => {
    prisma.marketAction.findFirst.mockResolvedValue(null);

    await expect(service.approve(ORG, PROJ, 'act_from_org_b', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('scopes every action lookup by organization and project', async () => {
    await service.approve(ORG, PROJ, 'act_1', 'u1');

    expect(prisma.marketAction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'act_1', organizationId: ORG, projectId: PROJ } }),
    );
  });

  it('records who approved and when', async () => {
    const result = await service.approve(ORG, PROJ, 'act_1', 'user_9');

    expect(result.status).toBe(MarketActionStatus.APPROVED);
    expect(result.approvedByUserId).toBe('user_9');
    expect(result.approvedAt).toBeInstanceOf(Date);
  });

  // The gate the whole product rests on: research output must not reach a
  // customer's site because a model was confident about it.
  it('refuses to convert an action nobody approved', async () => {
    prisma.marketAction.findFirst.mockResolvedValue(action({ status: MarketActionStatus.PROPOSED }));

    await expect(service.convert(ORG, PROJ, 'act_1')).rejects.toThrow(BadRequestException);
    expect(prisma.contentPiece.create).not.toHaveBeenCalled();
  });

  it('refuses to convert a rejected action', async () => {
    prisma.marketAction.findFirst.mockResolvedValue(action({ status: MarketActionStatus.REJECTED }));

    await expect(service.convert(ORG, PROJ, 'act_1')).rejects.toThrow(BadRequestException);
  });

  it('will not convert the same action twice', async () => {
    prisma.marketAction.findFirst.mockResolvedValue(action({ status: MarketActionStatus.CONVERTED }));

    await expect(service.convert(ORG, PROJ, 'act_1')).rejects.toThrow(BadRequestException);
  });

  describe('conversion targets', () => {
    const approved = (type: MarketActionType, extra: Record<string, unknown> = {}) =>
      prisma.marketAction.findFirst.mockResolvedValue(
        action({ status: MarketActionStatus.APPROVED, type, ...extra }),
      );

    it('creates a PLANNED content piece for a content brief', async () => {
      approved(MarketActionType.CONTENT_BRIEF);

      const result = await service.convert(ORG, PROJ, 'act_1');

      // PLANNED, not DRAFTED: the content agent still writes it, and that draft
      // goes through its own review before anything ships.
      expect(prisma.contentPiece.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PLANNED' }) }),
      );
      expect(result.convertedToId).toBe('piece_1');
    });

    // Without a baseline written at conversion there is nothing honest to
    // compare against when the outcome is measured later.
    it('captures a measurement baseline when work is created', async () => {
      approved(MarketActionType.CONTENT_BRIEF);

      await service.convert(ORG, PROJ, 'act_1');

      expect(outcomes.captureBaseline).toHaveBeenCalledWith(ORG, PROJ, 'act_1');
    });

    it('does not capture a baseline when conversion is refused', async () => {
      prisma.marketAction.findFirst.mockResolvedValue(action({ status: MarketActionStatus.PROPOSED }));

      await expect(service.convert(ORG, PROJ, 'act_1')).rejects.toThrow(BadRequestException);
      expect(outcomes.captureBaseline).not.toHaveBeenCalled();
    });

    it('creates a tracked prompt', async () => {
      approved(MarketActionType.TRACK_PROMPT);

      await service.convert(ORG, PROJ, 'act_1');

      expect(prisma.trackedPrompt.create).toHaveBeenCalled();
    });

    it('reuses an existing tracked prompt rather than duplicating it', async () => {
      approved(MarketActionType.TRACK_PROMPT);
      prisma.trackedPrompt.findFirst.mockResolvedValue({ id: 'existing_1' });

      const result = await service.convert(ORG, PROJ, 'act_1');

      expect(prisma.trackedPrompt.create).not.toHaveBeenCalled();
      expect(result.convertedToId).toBe('existing_1');
    });

    it('adds a competitor and a watch when a domain is present', async () => {
      approved(MarketActionType.COMPETITOR_WATCH, { title: 'Watch rival.com closely' });

      await service.convert(ORG, PROJ, 'act_1');

      expect(prisma.competitorDomain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId_domain: { projectId: PROJ, domain: 'rival.com' } } }),
      );
      expect(prisma.marketWatch.upsert).toHaveBeenCalled();
    });

    it('asks for a domain rather than guessing one', async () => {
      approved(MarketActionType.COMPETITOR_WATCH, { title: 'Watch the market leader', description: 'no domain here' });

      await expect(service.convert(ORG, PROJ, 'act_1')).rejects.toThrow(BadRequestException);
      expect(prisma.competitorDomain.upsert).not.toHaveBeenCalled();
    });

    it('creates an outreach campaign', async () => {
      approved(MarketActionType.OUTREACH_OPPORTUNITY);

      const result = await service.convert(ORG, PROJ, 'act_1');

      expect(prisma.outreachCampaign.create).toHaveBeenCalled();
      expect(result.convertedToId).toBe('camp_1');
    });
  });
});

describe('extractDomain', () => {
  it('finds a bare domain in free text', () => {
    expect(extractDomain('Watch rival.com closely')).toBe('rival.com');
  });

  it('strips www and lowercases', () => {
    expect(extractDomain('See WWW.Example.CO.UK/pricing')).toBe('example.co.uk');
  });

  it('returns null when there is no domain', () => {
    expect(extractDomain('the market leader')).toBeNull();
    expect(extractDomain(null)).toBeNull();
  });
});
