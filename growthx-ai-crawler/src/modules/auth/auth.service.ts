import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import * as bcrypt from 'bcrypt';

/**
 * How long the one-time code handed back from the Google redirect stays valid.
 *
 * Long enough for a browser to load the callback page and post it, short enough
 * that a code sitting in someone's history or a proxy log is already dead.
 */
const OAUTH_EXCHANGE_TTL = '60s';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private organizationsService: OrganizationsService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
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
   * A short-lived, single-purpose code standing in for the token pair in the
   * Google redirect.
   *
   * The callback used to redirect to
   * `/auth/callback?access_token=…&refresh_token=…`. A URL is the worst place
   * to put either: it lands in the browser's history, in the `Referer` sent to
   * anything the callback page loads, and in the access log of every proxy and
   * CDN between the two — and the refresh token there is valid for thirty days.
   *
   * This code authenticates nothing on its own. `type` keeps it out of
   * `JwtStrategy` and out of `refresh`, and it expires in a minute, so what
   * ends up in those logs is spent long before anyone reads them.
   */
  issueOAuthExchangeCode(user: { id: string; email: string }): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'oauth_exchange' },
      { expiresIn: OAUTH_EXCHANGE_TTL },
    );
  }

  /** Trades that code for the real token pair, over POST. */
  async exchangeOAuthCode(code: string) {
    let payload: { sub?: string; email?: string; type?: string };
    try {
      payload = this.jwtService.verify(code);
    } catch {
      throw new UnauthorizedException('That sign-in link has expired. Please sign in again.');
    }

    if (payload.type !== 'oauth_exchange') {
      throw new UnauthorizedException('That token cannot be exchanged for a session.');
    }

    const user = payload.sub ? await this.usersService.findById(payload.sub) : null;
    if (!user) {
      throw new UnauthorizedException('That account no longer exists.');
    }

    return this.issueTokens({ id: user.id, email: user.email });
  }

  private issueTokens(user: { id: string; email: string }) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      // `type` distinguishes the two: a refresh token must not be accepted as
      // an access token, or its long life would defeat the short access expiry.
      refresh_token: this.jwtService.sign(
        { ...payload, type: 'refresh' },
        // `expiresIn` is typed as a `ms` template-literal rather than a plain
        // string, so a value read from the environment needs the assertion.
        { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as `${number}d` },
      ),
      expires_in: 3600,
    };
  }

  /**
   * Exchanges a valid refresh token for a fresh pair.
   *
   * The user is re-read on every refresh so an account deleted or disabled
   * since sign-in cannot keep minting access tokens for a month.
   */
  async refresh(refreshToken: string) {
    let payload: { sub?: string; email?: string; type?: string };
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('That refresh token is invalid or has expired. Please sign in again.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('An access token cannot be used to refresh a session.');
    }

    const user = payload.sub ? await this.usersService.findById(payload.sub) : null;
    if (!user) {
      throw new UnauthorizedException('That account no longer exists.');
    }

    return this.issueTokens({ id: user.id, email: user.email });
  }

  async register(data: { email: string; password: string; firstName?: string; lastName?: string }) {
    const email = data.email;
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }
    const saltOrRounds = 10;
    const passwordHash = await bcrypt.hash(data.password, saltOrRounds);

    // The account and its first workspace are created together or not at all.
    //
    // They used to be two separate writes. If the second failed — a slug
    // collision was enough — the user row survived with no membership, and that
    // account was then unusable forever: `JwtAuthGuard` refuses every
    // workspace-scoped route for an account that belongs to no organization,
    // and registering again is refused because the email is taken.
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
        },
      });

      await this.organizationsService.createOrganization(
        created.id,
        {
          name: `${data.firstName || 'My'} Workspace`,
          slug: this.workspaceSlug(),
        },
        tx,
      );

      return created;
    });

    return this.issueTokens({ id: user.id, email: user.email });
  }

  /**
   * A slug for an automatically created workspace.
   *
   * `Organization.slug` is unique and this used to be the first eight
   * characters of the user's uuid, which is 32 bits of entropy shared across
   * every account on the installation — a birthday collision, and with it a
   * failed sign-up, becomes likely long before the user table is interesting.
   * A full random segment removes the failure mode rather than retrying it.
   */
  private workspaceSlug(): string {
    return `workspace-${randomUUID().replace(/-/g, '')}`;
  }

  async validateGoogleUser(profile: { email: string; firstName?: string; lastName?: string }): Promise<any> {
    let user = await this.usersService.findByEmail(profile.email);
    
    if (!user) {
      // A password this account will never use. `randomUUID` rather than
      // `Math.random`, which is not a cryptographic source: the value is what
      // stands between the account and anyone who can reach /auth/login with
      // this email.
      const passwordHash = await bcrypt.hash(`${randomUUID()}${randomUUID()}`, 10);

      // Created together, for the same reason as `register` above.
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: profile.email,
            passwordHash,
            firstName: profile.firstName,
            lastName: profile.lastName,
          },
        });

        await this.organizationsService.createOrganization(
          created.id,
          {
            name: `${profile.firstName || 'My'} Workspace`,
            slug: this.workspaceSlug(),
          },
          tx,
        );

        return created;
      });
    }
    
    const { passwordHash: _passwordHash, ...result } = user;
    return result;
  }
}

