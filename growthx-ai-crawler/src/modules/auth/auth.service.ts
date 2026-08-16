import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { OrganizationsService } from '../organizations/organizations.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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

  async register(data: any) {
    const existingUser = await this.usersService.findByEmail(data.email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }
    const saltOrRounds = 10;
    const passwordHash = await bcrypt.hash(data.password, saltOrRounds);
    
    const user = await this.usersService.createUser({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
    });
    
    // Auto-create a default workspace for the new user
    await this.organizationsService.createOrganization(user.id, {
      name: `${data.firstName || 'My'} Workspace`,
      slug: `workspace-${user.id.substring(0, 8)}`,
    });
    
    return this.issueTokens({ id: user.id, email: user.email });
  }
}

