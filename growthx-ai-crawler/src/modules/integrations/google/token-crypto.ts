import * as crypto from 'crypto';

/**
 * Encryption for OAuth tokens at rest.
 *
 * A Google refresh token is a long-lived key to a customer's Search Console,
 * Analytics and Business Profile. The existing integration stored them as
 * plain columns, so anyone with read access to the database — a backup, a
 * support query, a leaked connection string — held every customer's Google
 * data. Encrypting them means a database dump alone is not enough.
 *
 * AES-256-GCM rather than CBC: it authenticates the ciphertext, so a token
 * tampered with in the database fails to decrypt instead of decrypting to
 * something else. A fresh random IV per encryption means the same token
 * written twice does not produce the same ciphertext, which would otherwise
 * let someone reading the table see which customers share a token.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96 bits, the size GCM is specified for
const KEY_BYTES = 32;

/** Marks the format so a later scheme can be told apart from this one. */
const PREFIX = 'v1';

export class TokenCryptoError extends Error {}

/**
 * The key, from the environment.
 *
 * Read per call rather than cached at import so a process that starts without
 * it can still boot and serve everything that does not touch Google — an
 * unset key must break connecting an integration, not the whole API.
 */
function key(): Buffer {
  const configured = process.env.INTEGRATION_TOKEN_KEY;
  if (!configured) {
    throw new TokenCryptoError(
      'INTEGRATION_TOKEN_KEY is not set. Google integrations cannot be connected without it. ' +
        'Generate one with: openssl rand -base64 32',
    );
  }

  // Accept base64 or hex so whichever way an operator generates 32 bytes works.
  const decoded = /^[0-9a-f]{64}$/i.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');

  if (decoded.length !== KEY_BYTES) {
    throw new TokenCryptoError(
      `INTEGRATION_TOKEN_KEY must decode to ${KEY_BYTES} bytes, got ${decoded.length}. ` +
        'Generate one with: openssl rand -base64 32',
    );
  }
  return decoded;
}

/** True when a key is configured and usable, for reporting capability. */
export function tokenEncryptionAvailable(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
}

export function decryptToken(stored: string): string {
  const parts = stored.split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new TokenCryptoError('Stored token is not in the expected encrypted format.');
  }
  const [, iv, tag, ciphertext] = parts;

  const decipher = crypto.createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  try {
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    // Wrong key, or the row was altered. Both mean the same thing to a caller:
    // this token cannot be used and the customer has to reconnect. The
    // original error is not surfaced because it differs between the two cases
    // and that difference is a hint to anyone probing.
    throw new TokenCryptoError('Stored token could not be decrypted. The integration must be reconnected.');
  }
}
