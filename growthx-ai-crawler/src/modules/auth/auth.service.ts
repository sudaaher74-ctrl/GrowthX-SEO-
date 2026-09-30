import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { OrganizationsService } from '../organizations/organizations.service';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';

/** How long the Google sign-in redirect's one-time code may be exchanged. */
const LOGIN_CODE_TTL_MS = 60_000;

/**
 * A refresh token presented again this soon after it was rotated is taken for
 * two tabs racing, not theft: that request is refused, nothing else is revoked.
 */
const ROTATION_GRACE_MS = 10_000;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function refreshLifetimeDays(): number {
  const parsed = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '30', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

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
    if (user && await bcrypt.compare(pass, user.passwordHash)) {
      const { passwordHash: _passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Issues a short-lived access token plus a long-lived refresh token.
   *
   * The access token stays at 60 minutes so a stolen one expires quickly. The
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
  private async issueTokens(user: { id: string; email: string }) {
    const payload = { email: user.email, sub: user.id };
    const days = refreshLifetimeDays();
    const session = await this.prisma.refreshSession.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + days * 86_400_000) },
    });
    // Housekeeping only; a failure here must not fail a sign-in.
    void this.prisma.refreshSession
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } })
      .catch(() => undefined);

    return {
      access_token: this.jwtService.sign(payload),
      // `type` distinguishes the two: a refresh token must not be accepted as
      // an access token, or its long life would defeat the short access expiry.
      refresh_token: this.jwtService.sign(
        { ...payload, type: 'refresh' },
        // `expiresIn` is typed as a `ms` template-literal rather than a plain
        // string, so a computed value needs the assertion.
        { expiresIn: `${days}d` as `${number}d`, jwtid: session.id },
      ),
      expires_in: 3600,
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

    // Claimed atomically: of two requests carrying the same token, one wins.
    const claimed = await this.prisma.refreshSession.updateMany({
      where: { id: session.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) {
      const fresh = await this.prisma.refreshSession.findUnique({ where: { id: session.id } });
      const revokedAgo = fresh?.revokedAt ? Date.now() - fresh.revokedAt.getTime() : Infinity;
      if (revokedAgo > ROTATION_GRACE_MS) await this.revokeAllSessions(session.userId);
      throw new UnauthorizedException('That session has ended. Please sign in again.');
    }

    const user = payload.sub ? await this.usersService.findById(payload.sub) : null;
    if (!user) {
      throw new UnauthorizedException('That account no longer exists.');
    }

    return this.issueTokens({ id: user.id, email: user.email });
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

  async validateGoogleUser(profile: { email: string; firstName?: string; lastName?: string }): Promise<any> {
    let user = await this.usersService.findByEmail(profile.email);
    
    if (!user) {
      // Create user with a random dummy password since they authenticate via Google
      const saltOrRounds = 10;
      const randomPassword = randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, saltOrRounds);
      
      user = await this.usersService.createUser({
        email: profile.email,
        passwordHash,
        firstName: profile.firstName,
        lastName: profile.lastName,
      });

      // Auto-create a default workspace with collision resilience
      const slugSuffix = (user.id || '').replace(/-/g, '').substring(0, 10) || Math.random().toString(36).substring(2, 8);
      try {
        await this.organizationsService.createOrganization(user.id, {
          name: `${profile.firstName || 'My'} Workspace`,
          slug: `workspace-${slugSuffix}`,
        });
      } catch {
        await this.organizationsService.createOrganization(user.id, {
          name: `${profile.firstName || 'My'} Workspace`,
          slug: `workspace-${Date.now().toString(36)}`,
        });
      }
    } else {
      // Ensure existing user has at least one organization
      const orgs = await this.organizationsService.getOrganizationsForUser(user.id);
      if (orgs.length === 0) {
        const slugSuffix = (user.id || '').replace(/-/g, '').substring(0, 10) || Math.random().toString(36).substring(2, 8);
        try {
          await this.organizationsService.createOrganization(user.id, {
            name: `${user.firstName || profile.firstName || 'My'} Workspace`,
            slug: `workspace-${slugSuffix}`,
          });
        } catch {
          await this.organizationsService.createOrganization(user.id, {
            name: `${user.firstName || profile.firstName || 'My'} Workspace`,
            slug: `workspace-${Date.now().toString(36)}`,
          });
        }
      }
    }
    
    const { passwordHash: _passwordHash, ...result } = user;
    return result;
  }
}

/** Trimmed and lower-cased: the form every new account's email is stored in. */
export function normaliseEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}
