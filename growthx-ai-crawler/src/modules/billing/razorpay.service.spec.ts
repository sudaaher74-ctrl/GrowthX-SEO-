import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RazorpayService } from './razorpay.service';

const SECRET = 'whsec_test_growthx';

function build(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    RAZORPAY_KEY_ID: 'rzp_test_abc',
    RAZORPAY_KEY_SECRET: 'secret',
    RAZORPAY_WEBHOOK_SECRET: SECRET,
    ...overrides,
  };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  return new RazorpayService(config);
}

function sign(body: string, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('RazorpayService', () => {
  describe('webhook signature verification', () => {
    const body = JSON.stringify({ event: 'subscription.charged', created_at: 1754308800 });

    it('accepts a correctly signed payload', () => {
      expect(build().verifyWebhookSignature(body, sign(body))).toBe(true);
    });

    it('accepts the raw Buffer form Nest hands us', () => {
      const raw = Buffer.from(body, 'utf8');
      expect(build().verifyWebhookSignature(raw, sign(body))).toBe(true);
    });

    it('rejects a payload signed with the wrong secret', () => {
      expect(build().verifyWebhookSignature(body, sign(body, 'attacker'))).toBe(false);
    });

    it('rejects a tampered payload', () => {
      const signature = sign(body);
      const tampered = JSON.stringify({ event: 'subscription.charged', created_at: 9999999999 });
      expect(build().verifyWebhookSignature(tampered, signature)).toBe(false);
    });

    it('rejects a missing signature header', () => {
      expect(build().verifyWebhookSignature(body, undefined)).toBe(false);
    });

    it('rejects a signature of the wrong length instead of throwing', () => {
      expect(() => build().verifyWebhookSignature(body, 'abc123')).not.toThrow();
      expect(build().verifyWebhookSignature(body, 'abc123')).toBe(false);
    });

    it('refuses to trust anything when no webhook secret is configured', () => {
      const service = build({ RAZORPAY_WEBHOOK_SECRET: '' });
      expect(service.verifyWebhookSignature(body, sign(body))).toBe(false);
    });
  });

  describe('configuration', () => {
    it('reports unconfigured when keys are missing', () => {
      expect(build({ RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' }).isConfigured).toBe(false);
      expect(build().isConfigured).toBe(true);
    });

    it('refuses to call the API when unconfigured', async () => {
      const service = build({ RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' });
      await expect(service.fetchSubscription('sub_1')).rejects.toThrow(/not configured/i);
    });

    it('uses a pinned plan id from the environment without calling the API', async () => {
      const service = build({ RAZORPAY_PLAN_ID_PRO: 'plan_pinned_pro' });
      await expect(service.ensurePlan('PRO' as any)).resolves.toBe('plan_pinned_pro');
    });
  });

  describe('toDate', () => {
    it('converts unix seconds to a Date', () => {
      expect(RazorpayService.toDate(1754308800)).toEqual(new Date('2025-08-04T12:00:00Z'));
    });

    it('returns null for an unstarted cycle', () => {
      expect(RazorpayService.toDate(null)).toBeNull();
      expect(RazorpayService.toDate(undefined)).toBeNull();
    });
  });
});
