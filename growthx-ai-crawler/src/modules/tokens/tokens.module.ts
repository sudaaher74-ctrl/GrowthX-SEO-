import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PlatformAdminModule } from '../admin/platform-admin.module';
import { TokensAdminController, TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';

/**
 * Organizations' token balances: what they hold, what they spend it on, and the
 * ledger that explains both. Anything that costs the platform money imports
 * this and charges through `TokensService`.
 */
@Module({
  imports: [OrganizationsModule, PlatformAdminModule],
  controllers: [TokensController, TokensAdminController],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}
