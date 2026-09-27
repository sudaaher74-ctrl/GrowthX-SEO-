import { configuredValue, instagramCredentials, isConfiguredValue } from './optional-env';

/**
 * Every optional integration decides "is this configured?" with this rule,
 * so the feature, the router and /health can no longer disagree about it.
 */
describe('isConfiguredValue', () => {
  it('accepts a real credential', () => {
    expect(isConfiguredValue('sk-proj-abc123def456ghi789')).toBe(true);
    expect(isConfiguredValue('sk-or-v1-0123456789abcdef')).toBe(true);
    expect(isConfiguredValue('rzp_live_AbCdEf12345678')).toBe(true);
    expect(isConfiguredValue('17841400000000000')).toBe(true);
  });

  it('rejects nothing, whitespace, and the placeholders left in .env files', () => {
    for (const value of [
      undefined,
      null,
      '',
      '   \n',
      'your_openai_api_key_here',
      'your_openrouter_api_key_here',
      'add-your-key',
      'rzp_test_your_key_id',
      'changeme',
      '<your-key>',
      'sk-***abcd',
      'none',
      'false',
    ]) {
      expect(isConfiguredValue(value)).toBe(false);
    }
  });

  it('hands back the trimmed value, since SDKs send a pasted newline verbatim', () => {
    expect(configuredValue('  sk-proj-abc123def456\n')).toBe('sk-proj-abc123def456');
    expect(configuredValue('your_key_here')).toBeUndefined();
  });
});

describe('instagramCredentials', () => {
  const token = 'EAAG-a-long-lived-instagram-token-1234567890';

  it('needs both the token and the account id', () => {
    expect(instagramCredentials({ INSTAGRAM_ACCESS_TOKEN: token })).toBeUndefined();
    expect(instagramCredentials({ INSTAGRAM_BUSINESS_ACCOUNT_ID: '17841400000000000' })).toBeUndefined();
    expect(
      instagramCredentials({ INSTAGRAM_ACCESS_TOKEN: token, INSTAGRAM_BUSINESS_ACCOUNT_ID: ' 17841400000000000 ' }),
    ).toEqual({ accessToken: token, businessAccountId: '17841400000000000' });
  });

  it('treats a placeholder token as unset rather than failing every sync', () => {
    expect(
      instagramCredentials({ INSTAGRAM_ACCESS_TOKEN: 'your_token_here', INSTAGRAM_BUSINESS_ACCOUNT_ID: '17841400000000000' }),
    ).toBeUndefined();
  });

  it('treats a handle or URL in place of the numeric account id as unset', () => {
    expect(instagramCredentials({ INSTAGRAM_ACCESS_TOKEN: token, INSTAGRAM_BUSINESS_ACCOUNT_ID: '@growthx' })).toBeUndefined();
    expect(
      instagramCredentials({ INSTAGRAM_ACCESS_TOKEN: token, INSTAGRAM_BUSINESS_ACCOUNT_ID: 'https://instagram.com/growthx' }),
    ).toBeUndefined();
  });
});
