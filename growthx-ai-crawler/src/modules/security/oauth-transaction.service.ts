import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { SecurityService } from './security.service';

export const DEFAULT_OAUTH_TX_TTL_MS = 15 * 60 * 1000;

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function generatePkcePair(): {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
} {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier, 'ascii').digest('base64url');
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

export interface CreateOAuthTransactionInput {
  provider: string;
  purpose: string;
  userId?: string;
  organizationId?: string;
  projectId?: string;
  returnTo?: string;
  usePkce?: boolean;
  ttlMs?: number;
}

export interface CreatedOAuthTransaction {
  state: string;
  browserNonce: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256';
  expiresAt: Date;
}

export interface ConsumeOAuthTransactionInput {
  state: string | undefined;
  browserNonce: string | undefined;
  provider: string;
  expectedPurpose?: string;
  expectedUserId?: string;
  expectedProjectId?: string;
}

export interface ConsumedOAuthTransaction {
  id: string;
  provider: string;
  purpose: string;
  userId: string | null;
  organizationId: string | null;
  projectId: string | null;
  pkceVerifier: string | null;
  returnTo: string | null;
}

/**
 * Issues and atomically consumes expiring, single-use, browser-bound OAuth
 * transactions (with optional PKCE S256).
 */
@Injectable()
export class OAuthTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security?: SecurityService,
  ) {}

  async createTransaction(input: CreateOAuthTransactionInput): Promise<CreatedOAuthTransaction> {
    const state = randomBytes(32).toString('base64url');
    const browserNonce = randomBytes(32).toString('base64url');
    const pkce = input.usePkce !== false ? generatePkcePair() : null;
    const ttlMs = input.ttlMs ?? DEFAULT_OAUTH_TX_TTL_MS;
    const expiresAt = new Date(Date.now() + ttlMs);

    const storedVerifier =
      pkce && this.security
        ? this.security.encryptCredentials(pkce.codeVerifier)
        : (pkce?.codeVerifier ?? null);

    await this.prisma.oAuthTransaction.create({
      data: {
        id: sha256Hex(state),
        provider: input.provider,
        purpose: input.purpose,
        browserNonceHash: sha256Hex(browserNonce),
        userId: input.userId ?? null,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        pkceVerifier: storedVerifier,
        returnTo: input.returnTo ?? null,
        expiresAt,
      },
    });

    // Opportunistic expired row cleanup; failures never break sign-in.
    void this.prisma.oAuthTransaction
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 3_600_000) } } })
      .catch(() => undefined);

    return {
      state,
      browserNonce,
      ...(pkce
        ? { codeChallenge: pkce.codeChallenge, codeChallengeMethod: pkce.codeChallengeMethod }
        : {}),
      expiresAt,
    };
  }

  async consumeTransaction(input: ConsumeOAuthTransactionInput): Promise<ConsumedOAuthTransaction> {
    const state = typeof input.state === 'string' ? input.state.trim() : '';
    const browserNonce = typeof input.browserNonce === 'string' ? input.browserNonce.trim() : '';

    if (!state || !browserNonce) {
      throw new UnauthorizedException(
        'OAuth state or browser verification cookie is missing. Start connecting again from the same browser.',
      );
    }

    const id = sha256Hex(state);
    const browserNonceHash = sha256Hex(browserNonce);
    const now = new Date();

    const where: Record<string, any> = {
      id,
      provider: input.provider,
      browserNonceHash,
      consumedAt: null,
      expiresAt: { gt: now },
    };
    if (input.expectedPurpose) where.purpose = input.expectedPurpose;
    if (input.expectedUserId) where.userId = input.expectedUserId;
    if (input.expectedProjectId) where.projectId = input.expectedProjectId;

    const claimed = await this.prisma.oAuthTransaction.updateMany({
      where,
      data: { consumedAt: now },
    });

    if (claimed.count !== 1) {
      throw new UnauthorizedException(
        'OAuth authorization state is invalid, expired, already used, or does not match this browser session.',
      );
    }

    const row = await this.prisma.oAuthTransaction.findUnique({ where: { id } });
    if (!row) {
      throw new UnauthorizedException('OAuth authorization transaction could not be verified.');
    }

    const pkceVerifier =
      row.pkceVerifier && this.security
        ? this.security.decryptCredentials(row.pkceVerifier)
        : row.pkceVerifier;

    return {
      id: row.id,
      provider: row.provider,
      purpose: row.purpose,
      userId: row.userId,
      organizationId: row.organizationId,
      projectId: row.projectId,
      pkceVerifier: pkceVerifier ?? null,
      returnTo: row.returnTo,
    };
  }
}
