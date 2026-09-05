import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy, googleSignInConfigured } from './google.strategy';
import { jwtSecret } from '../../config/secrets';

@Module({
  imports: [
    UsersModule,
    OrganizationsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async () => ({
        secret: jwtSecret(),
        signOptions: { expiresIn: '60m' },
      }),
      inject: [ConfigService],
    }),
  ],
  // Registering GoogleStrategy unconditionally crashed the entire API at boot
  // whenever Google was not configured, because passport rejects an empty
  // clientID from its constructor. Google sign-in is optional, so it is only
  // wired up when the credentials for it exist.
  providers: [
    AuthService,
    JwtStrategy,
    ...(googleSignInConfigured() ? [GoogleStrategy] : []),
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}

