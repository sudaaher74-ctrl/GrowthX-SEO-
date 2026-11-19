import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { ProofOfImpactService } from './proof-of-impact.service';

export function verifyGitHubSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const providedHex = signatureHeader.slice('sha256='.length).trim();
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const providedBuf = Buffer.from(providedHex, 'hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Receives signed GitHub webhooks (`pull_request` merges and `deployment_status`
 * successes) so Fix Engine verifies live changes immediately after production
 * deployment instead of waiting for the 60-second fallback poller.
 */
@ApiTags('Webhooks')
@Controller(['api/webhooks/github', 'webhooks/github'])
export class GitHubWebhookController {
  private readonly logger = new Logger(GitHubWebhookController.name);

  constructor(private readonly proofOfImpact: ProofOfImpactService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive signed GitHub pull_request and deployment_status webhooks' })
  async handleWebhook(
    @Req() req: { rawBody?: Buffer },
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: Record<string, any>,
  ) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        'GitHub webhooks are not configured (GITHUB_WEBHOOK_SECRET is unset).',
      );
    }

    const payloadBytes = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}), 'utf8');
    if (!verifyGitHubSignature(payloadBytes, signature, secret)) {
      this.logger.warn(`Rejected GitHub webhook with invalid signature (event=${event ?? 'unknown'})`);
      throw new UnauthorizedException('Invalid GitHub webhook signature.');
    }

    const eventName = (event || '').trim().toLowerCase();
    if (eventName === 'ping') {
      return { ok: true, pong: true };
    }

    return this.proofOfImpact.handleGitHubWebhook(eventName, body ?? {});
  }
}
