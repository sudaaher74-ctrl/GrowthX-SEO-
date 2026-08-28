import * as crypto from 'crypto';

/**
 * The `state` parameter carried through a Google OAuth round trip.
 *
 * The existing integration built this as plain base64 of `{projectId}` and
 * trusted whatever came back. Nothing in that is verifiable, and the callback
 * is a URL Google redirects a browser to, so it cannot require a bearer token:
 * anyone who could reach the callback could hand it a state naming any
 * project and attach their own Google account to a stranger's workspace, or
 * be tricked into attaching their account to an attacker's project. Signing
 * closes that — a state this server did not issue is refused.
 *
 * An expiry is included because a signature alone never stops replay: an
 * authorization URL captured from a browser's history would otherwise work
 * indefinitely.
 */

const TTL_MS = 15 * 60 * 1000;

export class OAuthStateError extends Error {}

export interface OAuthState {
  projectId: string;
  organizationId: string;
  /** Which Google service this round trip is connecting. */
  provider: string;
  /** Where to send the browser once the callback is done. */
  returnTo?: string;
  issuedAt: number;
  nonce: string;
}

/**
 * Signing key. Falls back to the JWT secret so an existing deployment does not
 * need a second variable set before OAuth works at all — the two protect
 * different things, but a signed state with a shared secret is strictly better
 * than the unsigned state this replaces.
 */
function signingKey(): string {
  const secret = process.env.INTEGRATION_STATE_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new OAuthStateError(
      'Neither INTEGRATION_STATE_SECRET nor JWT_SECRET is set; OAuth state cannot be signed.',
    );
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

export function encodeState(input: Omit<OAuthState, 'issuedAt' | 'nonce'>): string {
  const state: OAuthState = {
    ...input,
    issuedAt: Date.now(),
    // Makes each authorization URL distinct even for the same project and
    // provider, so one cannot be mistaken for another in a log.
    nonce: crypto.randomBytes(9).toString('base64url'),
  };
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function decodeState(raw: string): OAuthState {
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) throw new OAuthStateError('Malformed OAuth state.');

  const expected = sign(payload);
  // Constant time: a plain === leaks how much of a forged signature was right,
  // which is enough to reconstruct it one byte at a time.
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    throw new OAuthStateError('OAuth state signature does not match. The request did not originate here.');
  }

  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new OAuthStateError('OAuth state payload is not readable.');
  }

  if (typeof state.issuedAt !== 'number' || Date.now() - state.issuedAt > TTL_MS) {
    throw new OAuthStateError('This authorization link has expired. Start connecting again.');
  }
  if (!state.projectId || !state.organizationId || !state.provider) {
    throw new OAuthStateError('OAuth state is missing required fields.');
  }

  return state;
}
