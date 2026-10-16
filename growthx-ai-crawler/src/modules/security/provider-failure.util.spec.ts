import { providerFailureReason } from './provider-failure.util';
describe('safe provider failure reasons', () => {
  it('identifies retired models without exposing the request or API key', () => {
    const reason = providerFailureReason({ status: 404, message: 'private input secret-key model no longer available' });
    expect(reason).toContain('configured model is unavailable');
    expect(reason).not.toContain('private');
    expect(reason).not.toContain('secret');
  });
  it('distinguishes access, quota, budget and timeout failures', () => {
    expect(providerFailureReason({ status: 403 })).toContain('account access');
    expect(providerFailureReason({ status: 429 })).toContain('quota');
    expect(providerFailureReason(new Error('budget limit is reached'))).toContain('spending limit');
    expect(providerFailureReason(new Error('timeout'))).toContain('timed out');
  });
});
