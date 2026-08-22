import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiExcludeEndpoint, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PlanType } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';
import { EntitlementsService } from './entitlements.service';
import { OrgContextService } from './org-context.service';
import { RazorpayService } from './razorpay.service';
import { IsEnum, IsEmail, IsOptional, IsString } from 'class-validator';

export class StartCheckoutDto {
  @IsEnum(PlanType)
  plan: PlanType;
  @IsEmail()
  email: string;
  @IsOptional()
  @IsString()
  name?: string;
}

@ApiTags('Billing & Plans')
@Controller('api/billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly entitlements: EntitlementsService,
    private readonly orgContext: OrgContextService,
    private readonly razorpay: RazorpayService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'Public pricing table: what ₹2,000 and ₹5,000 include' })
  listPlans() {
    return { plans: this.billing.listPlans(), gateway: 'razorpay', configured: this.razorpay.isConfigured };
  }

  @Get('organizations/:orgId/entitlements')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resolved plan, feature flags, and usage for an organization' })
  @ApiParam({ name: 'orgId', description: 'Organization ID' })
  async getEntitlements(@Req() req: any, @Param('orgId') orgId: string) {
    await this.orgContext.assertMembership(req.user.userId, orgId);
    return this.entitlements.getEntitlements(orgId);
  }

  @Get('organizations/:orgId/subscription')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Current subscription record for an organization' })
  @ApiParam({ name: 'orgId', description: 'Organization ID' })
  async getSubscription(@Req() req: any, @Param('orgId') orgId: string) {
    await this.orgContext.assertMembership(req.user.userId, orgId);
    return this.billing.getSubscription(orgId);
  }

  @Post('organizations/:orgId/checkout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a Razorpay subscription and return checkout parameters' })
  @ApiParam({ name: 'orgId', description: 'Organization ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        plan: { type: 'string', enum: ['STARTER', 'PRO'], example: 'PRO' },
        email: { type: 'string', example: 'owner@business.in' },
        name: { type: 'string', example: 'Acme Traders' },
      },
    },
  })
  async startCheckout(@Req() req: any, @Param('orgId') orgId: string, @Body() body: StartCheckoutDto) {
    await this.orgContext.assertMembership(req.user.userId, orgId);
    if (!body?.plan) throw new BadRequestException('plan is required');
    if (!body?.email) throw new BadRequestException('email is required');

    return this.billing.startCheckout({
      organizationId: orgId,
      plan: body.plan,
      email: body.email,
      name: body.name,
    });
  }

  @Post('organizations/:orgId/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel the subscription at the end of the paid cycle' })
  @ApiParam({ name: 'orgId', description: 'Organization ID' })
  async cancel(@Req() req: any, @Param('orgId') orgId: string, @Body() body: { immediate?: boolean }) {
    await this.orgContext.assertMembership(req.user.userId, orgId);
    return this.billing.cancel(orgId, !body?.immediate);
  }

  /**
   * Razorpay webhook. Unauthenticated by design — trust comes from the HMAC
   * signature over the raw body, which is why `rawBody` is enabled in main.ts.
   */
  @Post('webhooks/razorpay')
  @ApiExcludeEndpoint()
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature: string) {
    const raw = req.rawBody;
    if (!raw) {
      throw new BadRequestException('Raw body unavailable; enable rawBody on the Nest application.');
    }

    if (!this.razorpay.verifyWebhookSignature(raw, signature)) {
      throw new ForbiddenException('Invalid Razorpay webhook signature.');
    }

    const payload = JSON.parse(raw.toString('utf8'));
    // Razorpay sends a unique delivery id per webhook attempt-group.
    const eventId = (req.headers['x-razorpay-event-id'] as string) ?? `${payload.event}:${payload.created_at}`;

    return this.billing.handleWebhook({ eventId, eventType: payload.event, payload });
  }
}
