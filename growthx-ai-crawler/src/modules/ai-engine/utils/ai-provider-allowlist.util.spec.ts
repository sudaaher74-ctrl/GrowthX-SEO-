import { ConfigService } from '@nestjs/config';
import { isProviderAllowed, readProviderAllowlist } from './ai-provider-allowlist.util';

const configWith = (value?: string) => ({ get: () => value }) as unknown as ConfigService;

describe('AI_PROVIDERS allowlist', () => {
  it('is unrestricted when unset or blank', () => {
    expect(readProviderAllowlist(configWith(undefined))).toBeNull();
    expect(readProviderAllowlist(configWith('  '))).toBeNull();
    expect(isProviderAllowed(null, 'openai')).toBe(true);
  });

  it('matches vendor names case-insensitively and ignores spacing', () => {
    const allowlist = readProviderAllowlist(configWith(' sarvam , Groq '));
    expect(isProviderAllowed(allowlist, 'SARVAM')).toBe(true);
    expect(isProviderAllowed(allowlist, 'groq')).toBe(true);
    expect(isProviderAllowed(allowlist, 'openai')).toBe(false);
  });
});
