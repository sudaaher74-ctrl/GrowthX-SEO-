/**
 * Required-secret accessors.
 *
 * These deliberately have no fallback values. A missing secret must stop the
 * process at boot rather than silently falling back to a value that is public
 * in the repository — a baked-in default is the same as no authentication at
 * all once the source is shared.
 *
 * Tests set the variables in `jest.setup.ts`.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `${name} is not set. Configure it in the environment (Render dashboard / .env) before starting the API.`,
    );
  }
  return value;
}

/** Secret used to sign and verify user JWTs. */
export function jwtSecret(): string {
  return required('JWT_SECRET');
}

/**
 * AES-256-GCM key for customer credentials at rest.
 *
 * Must be 64 hex characters (32 bytes). Anything else is rejected rather than
 * hashed into a key, so a truncated or malformed value cannot silently produce
 * a different key than the one that encrypted the existing rows.
 */
export function encryptionKey(): Buffer {
  const value = required('ENCRYPTION_KEY');
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(
      'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate one with: openssl rand -hex 32',
    );
  }
  return Buffer.from(value, 'hex');
}
