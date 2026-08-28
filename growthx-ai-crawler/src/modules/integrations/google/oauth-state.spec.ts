import { decodeState, encodeState, OAuthStateError } from './oauth-state';

/**
 * The callback is a URL Google redirects a browser to, so it cannot require a
 * bearer token — the state is the only thing tying the returning request to
 * the one that started it. The version this replaces was plain base64 and was
 * trusted as-is, so a forged state naming any project would have been
 * accepted.
 */
describe('OAuth state', () => {
  const original = process.env.INTEGRATION_STATE_SECRET;

  beforeEach(() => {
    process.env.INTEGRATION_STATE_SECRET = 'test-signing-secret';
  });
  afterAll(() => {
    if (original === undefined) delete process.env.INTEGRATION_STATE_SECRET;
    else process.env.INTEGRATION_STATE_SECRET = original;
  });

  const base = { projectId: 'p1', organizationId: 'o1', provider: 'search_console' };

  it('round-trips what it was given', () => {
    const decoded = decodeState(encodeState({ ...base, returnTo: '/integrations' }));

    expect(decoded.projectId).toBe('p1');
    expect(decoded.organizationId).toBe('o1');
    expect(decoded.provider).toBe('search_console');
    expect(decoded.returnTo).toBe('/integrations');
  });

  it('rejects a state this server did not issue', () => {
    // The actual attack: hand the callback a project id that is not yours and
    // have someone's Google account attached to it.
    const forged = Buffer.from(
      JSON.stringify({ projectId: 'victim', organizationId: 'victim-org', provider: 'search_console', issuedAt: Date.now(), nonce: 'x' }),
    ).toString('base64url');

    expect(() => decodeState(`${forged}.notarealsignature`)).toThrow(OAuthStateError);
    expect(() => decodeState(forged)).toThrow(/Malformed/);
  });

  it('rejects a state whose payload was edited after signing', () => {
    const valid = encodeState(base);
    const [, signature] = valid.split('.');
    const swapped = Buffer.from(
      JSON.stringify({ projectId: 'someone-else', organizationId: 'o1', provider: 'search_console', issuedAt: Date.now(), nonce: 'x' }),
    ).toString('base64url');

    expect(() => decodeState(`${swapped}.${signature}`)).toThrow(/did not originate here/);
  });

  it('rejects a state signed with a different secret', () => {
    const valid = encodeState(base);
    process.env.INTEGRATION_STATE_SECRET = 'a-different-secret';

    expect(() => decodeState(valid)).toThrow(/did not originate here/);
  });

  it('expires, so a captured authorization URL cannot be replayed forever', () => {
    const valid = encodeState(base);
    const sixteenMinutes = 16 * 60 * 1000;
    const realNow = Date.now;
    Date.now = () => realNow() + sixteenMinutes;
    try {
      expect(() => decodeState(valid)).toThrow(/expired/i);
    } finally {
      Date.now = realNow;
    }
  });

  it('gives each authorization URL its own state', () => {
    expect(encodeState(base)).not.toBe(encodeState(base));
  });

  it('rejects a signed state that is missing the fields the callback needs', () => {
    // Signed by us, so the signature passes; the callback still must not act
    // on a state with no project.
    const secret = process.env.INTEGRATION_STATE_SECRET!;
    const crypto = require('crypto');
    const payload = Buffer.from(JSON.stringify({ issuedAt: Date.now(), nonce: 'x' })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

    expect(() => decodeState(`${payload}.${signature}`)).toThrow(/missing required fields/);
  });
});
