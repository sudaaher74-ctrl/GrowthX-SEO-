import { BadRequestException } from '@nestjs/common';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

describe('WebhookDispatcherService', () => {
  let prisma: any;
  let service: WebhookDispatcherService;

  beforeEach(() => {
    prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proj_1',
          name: 'Acme',
          organizationId: 'org_1',
          websites: [{ domain: 'acme.example' }],
        }),
      },
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue({ role: 'OWNER' }),
      },
      projectWebhookConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      webhookDeliveryLog: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'log_1',
          ...data,
          createdAt: new Date('2026-11-19T12:00:00Z'),
        })),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    service = new WebhookDispatcherService(prisma as any);
  });

  it('rejects private/loopback webhook URLs to prevent SSRF', async () => {
    await expect(
      service.saveConfig('proj_1', 'user_1', {
        restUrl: 'http://127.0.0.1:8080/hook',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses test dispatch when channel URL is not configured', async () => {
    await expect(service.sendTestWebhook('proj_1', 'user_1', 'SLACK')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('skips dispatchProjectEvent cleanly when event is not subscribed', async () => {
    prisma.projectWebhookConfig.findUnique.mockResolvedValue({
      enabled: true,
      slackUrl: 'https://hooks.slack.com/services/T00/B00/XXX',
      events: { regressionDetected: false },
    });

    await service.dispatchProjectEvent('proj_1', 'regressionDetected', 'Regression found');
    expect(prisma.webhookDeliveryLog.create).not.toHaveBeenCalled();
  });
});
