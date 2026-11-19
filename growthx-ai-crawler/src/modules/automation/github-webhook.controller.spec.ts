jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));

import * as crypto from 'crypto';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { GitHubWebhookController, verifyGitHubSignature } from './github-webhook.controller';

describe('GitHubWebhookController', () => {
  const originalSecret = process.env.GITHUB_WEBHOOK_SECRET;
  let mockProofOfImpact: any;
  let controller: GitHubWebhookController;

  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret-123';
    mockProofOfImpact = {
      handleGitHubWebhook: jest.fn().mockResolvedValue({ handled: true, verifiedRuns: ['run-1'] }),
    };
    controller = new GitHubWebhookController(mockProofOfImpact);
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
    else process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
  });

  it('rejects requests when GITHUB_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    await expect(
      controller.handleWebhook({ rawBody: Buffer.from('{}') }, 'pull_request', 'sha256=abc', {}),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('rejects requests with an invalid HMAC-SHA256 signature', async () => {
    const raw = Buffer.from(JSON.stringify({ action: 'closed' }));
    await expect(
      controller.handleWebhook({ rawBody: raw }, 'pull_request', 'sha256=deadbeef', { action: 'closed' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockProofOfImpact.handleGitHubWebhook).not.toHaveBeenCalled();
  });

  it('accepts valid HMAC-SHA256 signed pull_request and deployment_status webhooks', async () => {
    const payload = {
      action: 'closed',
      pull_request: { merged: true, html_url: 'https://github.com/acme/site/pull/7' },
      repository: { owner: { login: 'acme' }, name: 'site' },
    };
    const raw = Buffer.from(JSON.stringify(payload));
    const sig = `sha256=${crypto.createHmac('sha256', 'test-webhook-secret-123').update(raw).digest('hex')}`;

    expect(verifyGitHubSignature(raw, sig, 'test-webhook-secret-123')).toBe(true);

    const res = await controller.handleWebhook({ rawBody: raw }, 'pull_request', sig, payload);
    expect(res).toEqual({ handled: true, verifiedRuns: ['run-1'] });
    expect(mockProofOfImpact.handleGitHubWebhook).toHaveBeenCalledWith('pull_request', payload);
  });

  it('answers ping events cleanly once signature is verified', async () => {
    const raw = Buffer.from('{"zen":"Keep it logically awesome."}');
    const sig = `sha256=${crypto.createHmac('sha256', 'test-webhook-secret-123').update(raw).digest('hex')}`;

    const res = await controller.handleWebhook({ rawBody: raw }, 'ping', sig, {});
    expect(res).toEqual({ ok: true, pong: true });
    expect(mockProofOfImpact.handleGitHubWebhook).not.toHaveBeenCalled();
  });
});
