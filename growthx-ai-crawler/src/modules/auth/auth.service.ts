import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { OrganizationsService } from '../organizations/organizations.service';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { refreshLifetimeDays } from './session-lifetime';

/** How long the Google sign-in redirect's one-time code may be exchanged. */
const LOGIN_CODE_TTL_MS = 60_000;

/** How long a Google account-linking / recovery challenge stays valid. */
const RECOVERY_CHALLENGE_TTL_MS = 10 * 60_000;

/**
 * A refresh token presented again this soon after it was rotated is taken for
 * two tabs racing, not theft: that request is refused, nothing else is revoked.
 */
const ROTATION_GRACE_MS = 120_000;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private organizationsService: OrganizationsService,
    private prisma: PrismaService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    if (typeof email !== 'string' || typeof pass !== 'string' || !email.trim() || !pass) return null;
    const user = await this.usersService.findByEmail(normaliseEmail(email));
    if (!user || user.passwordAuthEnabled === false) return null;
    if (await bcrypt.compare(pass, user.passwordHash)) {
      const { passwordHash: _passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Issues a short-lived access token plus a long-lived refresh token.
   *
   * The access token stays at 15 minutes so a stolen one expires quickly. The
   * refresh token lets the client get a new one silently, which is what stops a
   * working session ending in a hard bounce to the login page mid-task.
   */
  async login(user: any) {
    return this.issueTokens({ id: user.id, email: user.email });
  }

  /**
   * Each refresh token is backed by a RefreshSession row whose id is the token's
   * `jti`, so it can be rotated and revoked. Without that row a stolen token
   * worked for its whole 30 days with no way to end it.
   */
  private async issueTokens(user: { id: string; email: string }, db = this.prisma, id?: string) {
    const days = refreshLifetimeDays();
    const session = await db.refreshSession.create({
      data: { ...(id ? { id } : {}), userId: user.id, expiresAt: new Date(Date.now() + days * 86_400_000) },
    });
    // Housekeeping only; a failure here must not fail a sign-in.
    if (db === this.prisma) void db.refreshSession
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } })
      .catch(() => undefined);

    return this.tokensForSession(user, session);
  }

  private tokensForSession(user: { id: string; email: string }, session: { id: string; createdAt: Date; expiresAt: Date }) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      // `type` distinguishes the two: a refresh token must not be accepted as
      // an access token, or its long life would defeat the short access expiry.
      refresh_token: this.jwtService.sign(
        { ...payload, type: 'refresh', iat: Math.floor(session.createdAt.getTime() / 1000) },
        // `expiresIn` is typed as a `ms` template-literal rather than a plain
        // string, so a computed value needs the assertion.
        { expiresIn: Math.floor(session.expiresAt.getTime() / 1000) - Math.floor(session.createdAt.getTime() / 1000), jwtid: session.id },
      ),
      expires_in: 900,
    };
  }

  /**
   * Exchanges a valid refresh token for a fresh pair, and retires the one used.
   *
   * The user is re-read on every refresh so an account deleted or disabled
   * since sign-in cannot keep minting access tokens for a month. A token that
   * was already rotated and comes back after the grace period has been copied,
   * so every session of that user is revoked.
   */
  async refresh(refreshToken: string) {
    let payload: { sub?: string; email?: string; type?: string; jti?: string };
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('That refresh token is invalid or has expired. Please sign in again.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('An access token cannot be used to refresh a session.');
    }

    // A token with no `jti` predates session tracking and cannot be checked.
    const session = payload.jti
      ? await this.prisma.refreshSession.findUnique({ where: { id: payload.jti } })
      : null;
    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('That session has ended. Please sign in again.');
    }

    const user = payload.sub ? await this.usersService.findById(payload.sub) : null;
    if (!user) {
      throw new UnauthorizedException('That account no longer exists.');
    }

    const replacementId = sha256(`${session.id}:${refreshToken}`);
    // Rotation and replacement commit together. A dropped response can retry
    // the exact token within the bounded grace window and recover that pair.
    const result = await this.prisma.$transaction(async tx => {
      const claimed = await tx.refreshSession.updateMany({
        where: { id: session.id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (claimed.count === 1) return this.issueTokens(user, tx as PrismaService, replacementId);
      const original = await tx.refreshSession.findUnique({ where: { id: session.id } });
      const replacement = await tx.refreshSession.findUnique({ where: { id: replacementId } });
      const withinGrace = original?.revokedAt && Date.now() - original.revokedAt.getTime() <= ROTATION_GRACE_MS;
      if (withinGrace && replacement && replacement.userId === user.id && !replacement.revokedAt && replacement.expiresAt > new Date()) {
        return this.tokensForSession(user, replacement);
      }
      return null;
    });
    if (result) return result;
    const fresh = await this.prisma.refreshSession.findUnique({ where: { id: session.id } });
    // Expiry is not evidence of theft. Only an old, explicitly rotated token
    // causes replay protection to revoke other sessions.
    if (fresh?.revokedAt && Date.now() - fresh.revokedAt.getTime() > ROTATION_GRACE_MS) await this.revokeAllSessions(session.userId);
    throw new UnauthorizedException('That session has ended. Please sign in again.');
  }

  async refreshCookieCandidates(tokens: string[]) {
    for (const token of [...new Set(tokens)].slice(0, 5)) {
      try {
        const payload = this.jwtService.verify(token);
        if (payload.type !== 'refresh' || !payload.jti) continue;
        const session = await this.prisma.refreshSession.findUnique({ where: { id: payload.jti } });
        if (session && session.userId === payload.sub && !session.revokedAt && session.expiresAt > new Date()) return this.refresh(token);
      } catch (error) {
        if (!(error instanceof Error) || !['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) throw error;
      }
    }
    return this.refresh(tokens[0]);
  }

  /**
   * Revokes the session behind a refresh token (or all of the user's sessions).
   * Never throws for a bad token: logout must always succeed. Returns the user
   * id when the token was valid, for the security log.
   */
  async revokeSessionForToken(refreshToken: string | undefined, all: boolean): Promise<string | null> {
    if (!refreshToken) return null;
    let payload: { sub?: string; jti?: string; type?: string };
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      return null;
    }
    if (payload.type !== 'refresh' || !payload.sub) return null;
    if (all) {
      await this.revokeAllSessions(payload.sub);
    } else if (payload.jti) {
      await this.prisma.refreshSession.updateMany({
        where: { id: payload.jti, userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      // Also end a replacement if logout carried the predecessor after a lost response.
      await this.prisma.refreshSession.updateMany({
        where: { id: sha256(`${payload.jti}:${refreshToken}`), userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return payload.sub;
  }

  /** Ends every refresh session of a user. Access tokens lapse within the hour. */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * The Google redirect carries this code, never the tokens: a URL is kept in
   * browser history, proxy logs and Referer headers. It is single-use and
   * short-lived, and only its hash is stored.
   */
  async createLoginCode(userId: string): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    await this.prisma.loginCode.create({
      data: { id: sha256(code), userId, expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MS) },
    });
    void this.prisma.loginCode
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 3_600_000) } } })
      .catch(() => undefined);
    return code;
  }

  async exchangeLoginCode(code: string) {
    const id = sha256(typeof code === 'string' ? code : '');
    const claimed = await this.prisma.loginCode.updateMany({
      where: { id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new UnauthorizedException('That sign-in link has expired. Please sign in again.');
    }
    const row = await this.prisma.loginCode.findUnique({ where: { id } });
    const user = row ? await this.usersService.findById(row.userId) : null;
    if (!user) throw new UnauthorizedException('That account no longer exists.');
    return this.issueTokens({ id: user.id, email: user.email });
  }

  async register(data: { email: string; password: string; firstName?: string; lastName?: string }) {
    // One spelling per address: "Priya@Shop.in" and "priya@shop.in" are the
    // same inbox and must not become two accounts.
    const email = normaliseEmail(data.email);
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }
    const saltOrRounds = 10;
    const passwordHash = await bcrypt.hash(data.password, saltOrRounds);

    let user;
    try {
      user = await this.usersService.createUser({
        email,
        passwordHash,
        firstName: data.firstName?.trim() || undefined,
        lastName: data.lastName?.trim() || undefined,
        emailVerifiedAt: null,
        isPlatformAdmin: false,
      });
    } catch (error: any) {
      // Two sign-ups for the same address at the same moment: the second hits
      // the unique index. Same answer as the check above, not a 500.
      if (error?.code === 'P2002') throw new BadRequestException('User with this email already exists');
      throw error;
    }
    
    // Auto-create a default workspace for the new user
    await this.organizationsService.createOrganization(user.id, {
      name: `${data.firstName || 'My'} Workspace`,
      slug: `workspace-${user.id.substring(0, 8)}`,
    });
    
    return this.issueTokens({ id: user.id, email: user.email });
  }

  private async ensureDefaultWorkspace(userId: string, preferredFirstName?: string | null): Promise<void> {
    const orgs = await this.organizationsService.getOrganizationsForUser(userId);
    if (orgs.length > 0) return;

    const slugSuffix = (userId || '').replace(/-/g, '').substring(0, 10) || Math.random().toString(36).substring(2, 8);
    try {
      await this.organizationsService.createOrganization(userId, {
        name: `${preferredFirstName || 'My'} Workspace`,
        slug: `workspace-${slugSuffix}`,
      });
    } catch {
      await this.organizationsService.createOrganization(userId, {
        name: `${preferredFirstName || 'My'} Workspace`,
        slug: `workspace-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`,
      });
    }
  }

  async validateGoogleUser(profile: {
    email: string;
    googleSub: string;
    emailVerified: boolean;
    firstName?: string;
    lastName?: string;
  }): Promise<any> {
    const googleSub = String(profile?.googleSub ?? '').trim();
    const email = normaliseEmail(profile?.email ?? '');
    if (!googleSub) {
      throw new UnauthorizedException('Google account did not provide a stable subject identifier.');
    }
    if (!email) {
      throw new UnauthorizedException('No email address returned from Google account.');
    }
    if (profile?.emailVerified !== true) {
      throw new UnauthorizedException('Google account email must be verified before signing in.');
    }

    const now = new Date();

    // 1. Always look up by immutable provider subject first so pre-registration
    // or later email changes cannot hijack an already-linked identity.
    const linkedUser = await this.usersService.findByGoogleSub?.(googleSub);
    if (linkedUser) {
      await this.ensureDefaultWorkspace(linkedUser.id, linkedUser.firstName || profile.firstName);
      const { passwordHash: _passwordHash, ...result } = linkedUser;
      return result;
    }

    // 2. Check for an existing account with the same normalized email.
    const existingByEmail = await this.usersService.findByEmail(email);

    if (!existingByEmail) {
      const randomPassword = randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      const user = await this.usersService.createUser({
        email,
        passwordHash,
        passwordAuthEnabled: false,
        googleSub,
        emailVerifiedAt: now,
        googleEmailVerifiedAt: now,
        isPlatformAdmin: false,
        firstName: profile.firstName,
        lastName: profile.lastName,
      });

      await this.ensureDefaultWorkspace(user.id, profile.firstName);
      const { passwordHash: _passwordHash, ...result } = user;
      return result;
    }

    if (existingByEmail.googleSub && existingByEmail.googleSub !== googleSub) {
      throw new UnauthorizedException('This email address is already linked to a different Google account.');
    }

    // 3. Existing account with no bound googleSub:
    // If it was created as a verified passwordless account, bind the subject directly.
    if (existingByEmail.emailVerifiedAt && existingByEmail.passwordAuthEnabled === false) {
      const updated = await this.usersService.updateUser(existingByEmail.id, {
        googleSub,
        googleEmailVerifiedAt: now,
      });
      await this.ensureDefaultWorkspace(updated.id, updated.firstName || profile.firstName);
      const { passwordHash: _passwordHash, ...result } = updated;
      return result;
    }

    // 4. Existing unverified or password-enabled account without googleSub:
    // Never silently merge and leave the previously registered password active.
    // Issue a short-lived single-use recovery challenge requiring either proof of
    // password control (`link-with-password`) or explicit account reclaim
    // (`reclaim-account`) that disables the old password and revokes all sessions.
    const recoveryToken = randomBytes(32).toString('base64url');
    await this.prisma.identityRecoveryChallenge.create({
      data: {
        id: sha256(recoveryToken),
        userId: existingByEmail.id,
        provider: 'google',
        providerSub: googleSub,
        email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        expiresAt: new Date(Date.now() + RECOVERY_CHALLENGE_TTL_MS),
      },
    });
    void this.prisma.identityRecoveryChallenge
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 3_600_000) } } })
      .catch(() => undefined);

    return {
      recoveryRequired: true,
      recoveryToken,
      email,
    };
  }

  /**
   * Proof-of-control linking: a user who already owns an existing password
   * account proves knowledge of its password to link their verified Google subject.
   */
  async linkGoogleWithPassword(recoveryToken: string, password: string) {
    const id = sha256(typeof recoveryToken === 'string' ? recoveryToken : '');
    const challenge = await this.prisma.identityRecoveryChallenge.findUnique({ where: { id } });
    if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date() || challenge.provider !== 'google') {
      throw new UnauthorizedException('That account-linking request has expired. Please sign in with Google again.');
    }

    const user = await this.usersService.findById(challenge.userId);
    if (!user || user.passwordAuthEnabled === false) {
      throw new UnauthorizedException('Password verification is unavailable for this account.');
    }
    if (user.googleSub && user.googleSub !== challenge.providerSub) {
      throw new UnauthorizedException('This account is already linked to a different Google identity.');
    }

    const passwordValid = typeof password === 'string' && password.length > 0 && await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Incorrect password. Account linking requires proof of control.');
    }

    const claimed = await this.prisma.identityRecoveryChallenge.updateMany({
      where: { id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new UnauthorizedException('That account-linking request has already been used or expired.');
    }

    const now = new Date();
    const updated = await this.usersService.updateUser(user.id, {
      googleSub: challenge.providerSub,
      emailVerifiedAt: user.emailVerifiedAt ?? now,
      googleEmailVerifiedAt: now,
    });
    await this.ensureDefaultWorkspace(updated.id, updated.firstName || challenge.firstName);
    return this.issueTokens({ id: updated.id, email: updated.email });
  }

  /**
   * Explicit recovery/reclaim for an ambiguous or pre-registered unverified
   * password account. Permanently disables the old password, rotates the stored
   * password hash, invalidates all existing sessions, detaches any shared
   * unverified pre-registration workspaces, and binds the verified Google subject.
   */
  async reclaimAccountWithGoogle(recoveryToken: string) {
    const id = sha256(typeof recoveryToken === 'string' ? recoveryToken : '');
    const claimed = await this.prisma.identityRecoveryChallenge.updateMany({
      where: { id, usedAt: null, expiresAt: { gt: new Date() }, provider: 'google' },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new UnauthorizedException('That account recovery link has expired or was already used. Please sign in with Google again.');
    }

    const challenge = await this.prisma.identityRecoveryChallenge.findUnique({ where: { id } });
    const user = challenge ? await this.usersService.findById(challenge.userId) : null;
    if (!challenge || !user) {
      throw new UnauthorizedException('That account no longer exists.');
    }
    if (user.googleSub && user.googleSub !== challenge.providerSub) {
      throw new UnauthorizedException('This account is already linked to a different Google identity.');
    }

    const now = new Date();
    const randomPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

    // Revoke all refresh sessions and invalidate previously issued access tokens.
    await this.revokeAllSessions(user.id);

    // If the pre-registered account was never verified and shares a workspace
    // with other members (e.g. a pre-registrant invited themselves), detach the
    // reclaimed mailbox owner from those workspaces so the pre-registrant cannot
    // observe future activity.
    if (!user.emailVerifiedAt && this.prisma.organizationMember?.findMany) {
      const memberships = await this.prisma.organizationMember.findMany({
        where: { userId: user.id },
        select: { organizationId: true },
      });
      for (const m of memberships) {
        const otherMembers = await this.prisma.organizationMember.count({
          where: { organizationId: m.organizationId, userId: { not: user.id } },
        });
        if (otherMembers > 0) {
          await this.prisma.organizationMember.deleteMany({
            where: { userId: user.id, organizationId: m.organizationId },
          });
        }
      }
    }

    const updated = await this.usersService.updateUser(user.id, {
      googleSub: challenge.providerSub,
      emailVerifiedAt: now,
      googleEmailVerifiedAt: now,
      passwordAuthEnabled: false,
      passwordHash: randomPasswordHash,
      sessionsInvalidatedAt: now,
      ...(user.emailVerifiedAt ? {} : { isPlatformAdmin: false }),
    });

    await this.ensureDefaultWorkspace(updated.id, updated.firstName || challenge.firstName);
    return this.issueTokens({ id: updated.id, email: updated.email });
  }
}

/** Trimmed and lower-cased: the form every new account's email is stored in. */
export function normaliseEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}
