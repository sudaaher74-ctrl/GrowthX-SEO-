import { decryptToken, encryptToken, TokenCryptoError, tokenEncryptionAvailable } from './token-crypto';

/**
 * A Google refresh token is a long-lived key to a customer's Search Console,
 * Analytics and Business Profile. These were stored as plain columns, so a
 * database backup or a leaked connection string handed over every customer's
 * Google data.
 */
describe('token encryption', () => {
  const KEY = 'C1PS0y3rGHb0mAtwGDbTeoiSMkR8CQrRD1z0jFYqQ7Y='; // 32 random bytes, test only
  const original = process.env.INTEGRATION_TOKEN_KEY;

  beforeEach(() => {
    process.env.INTEGRATION_TOKEN_KEY = KEY;
  });
  afterAll(() => {
    if (original === undefined) delete process.env.INTEGRATION_TOKEN_KEY;
    else process.env.INTEGRATION_TOKEN_KEY = original;
  });

  it('round-trips a token', () => {
    const token = '1//0eXaMpLe-refresh-token_value.with-punctuation';
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it('never stores the token in readable form', () => {
    const token = 'ya29.super-secret-access-token';
    const stored = encryptToken(token);

    expect(stored).not.toContain(token);
    expect(stored).not.toContain('super-secret');
    // Nor base64 of it, which would be readable to anyone who thought to try.
    expect(stored).not.toContain(Buffer.from(token).toString('base64'));
  });

  it('produces different ciphertext for the same token each time', () => {
    // A fixed IV would make identical tokens produce identical rows, which
    // tells anyone reading the table which customers share a token.
    const token = 'ya29.the-same-token';
    expect(encryptToken(token)).not.toBe(encryptToken(token));
  });

  it('refuses a token that was altered in the database', () => {
    // The point of GCM over CBC: tampering fails loudly instead of decrypting
    // to something else.
    const stored = encryptToken('ya29.original');
    const parts = stored.split('.');
    const bytes = Buffer.from(parts[3], 'base64');
    bytes[0] ^= 0xff;
    const tampered = [parts[0], parts[1], parts[2], bytes.toString('base64')].join('.');

    expect(() => decryptToken(tampered)).toThrow(TokenCryptoError);
  });

  it('refuses to decrypt with the wrong key', () => {
    const stored = encryptToken('ya29.original');
    process.env.INTEGRATION_TOKEN_KEY = 'k2s3ZDMxXfQOBOtaEmvbCiOKn3wUCoyhbETNqBiRUXM=';

    expect(() => decryptToken(stored)).toThrow(/must be reconnected/i);
  });

  it('accepts a key given as hex as well as base64', () => {
    process.env.INTEGRATION_TOKEN_KEY = 'a'.repeat(64);
    expect(decryptToken(encryptToken('token'))).toBe('token');
  });

  it('refuses a key of the wrong size rather than silently padding it', () => {
    process.env.INTEGRATION_TOKEN_KEY = Buffer.from('too short').toString('base64');
    expect(() => encryptToken('token')).toThrow(/32 bytes/);
  });

  it('says clearly when no key is configured', () => {
    delete process.env.INTEGRATION_TOKEN_KEY;

    expect(tokenEncryptionAvailable()).toBe(false);
    expect(() => encryptToken('token')).toThrow(/INTEGRATION_TOKEN_KEY is not set/);
  });

  it('reports availability when a key is configured', () => {
    expect(tokenEncryptionAvailable()).toBe(true);
  });
});
