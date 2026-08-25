import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../database/prisma.service';
import { jwtSecret } from '../../config/secrets';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
    });
  }

  async validate(payload: any) {
    // A refresh token is long-lived by design. Accepting one here would give it
    // the same power as an access token for a month.
    if (payload?.type === 'refresh') {
      throw new UnauthorizedException('A refresh token cannot be used to authenticate a request.');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      userId: payload.sub,
      email: payload.email,
      organizationId: await this.organizationFor(payload.sub, payload.organizationId),
    };
  }

  /**
   * Resolves the organization this request acts on, from membership rows rather
   * than from the token alone.
   *
   * Reading it straight off the payload would trust a claim the holder controls
   * once a token outlives a membership, and would leave every token issued
   * before the claim existed with no organization at all — which is what made
   * `organizationId` undefined across the API, dropping tenant filters on reads
   * and failing writes that require it.
   */
  private async organizationFor(userId: string, claimed?: string): Promise<string | undefined> {
    if (claimed) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId, organizationId: claimed } },
        select: { organizationId: true },
      });
      if (membership) return membership.organizationId;
    }

    // No usable claim: fall back to the membership the user actually has.
    // Ordered so the same organization is chosen on every request rather than
    // varying with row order.
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },
      take: 1,
    });

    return memberships[0]?.organizationId;
  }
}
