import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { DatabaseModule } from '../../database/database.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { EntitlementsGuard } from './entitlements.guard';
import { EntitlementsService } from './entitlements.service';
import { OrgContextService } from './org-context.service';
import { RazorpayService } from './razorpay.service';
import { EntitlementsAuditService } from './entitlements-audit.service';

/**
 * Global so any module can gate a route with `EntitlementsGuard` or record
 * usage without re-importing billing everywhere.
 */
@Global()
@Module({
  imports: [DatabaseModule, DiscoveryModule],
  controllers: [BillingController],
  providers: [BillingService, EntitlementsService, OrgContextService, RazorpayService, EntitlementsGuard, EntitlementsAuditService],
  exports: [BillingService, EntitlementsService, OrgContextService, RazorpayService, EntitlementsGuard],
})
export class BillingModule {}
