import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../admin/platform-admin.guard';
import { OrgContextService } from '../organizations/org-context.service';
import { MAX_TOKENS_PER_OPERATION, TokenAction, TokenConfig } from './token-rates';
import { TokensService } from './tokens.service';

/**
 * What each thing costs, as this deployment is configured. Sent with the
 * balance so the dashboard never carries a price of its own — a hardcoded copy
 * would be wrong the moment an operator tuned the environment.
 */
function rateCard(config: TokenConfig) {
  return {
    ai: { inputWeight: config.aiInputWeight, outputWeight: config.aiOutputWeight },
    actions: [
      { action: TokenAction.GEO_GRID_POINT, tokensPerUnit: config.unitCosts[TokenAction.GEO_GRID_POINT], unit: 'grid point' },
    ],
  };
}

/** A tokens screen for the people who own the tokens. */
@ApiTags('Tokens')
@ApiBearerAuth()
@Controller('api/organizations/:orgId/tokens')
@UseGuards(JwtAuthGuard)
export class TokensController {
  constructor(
    private readonly tokens: TokensService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Token balance, this month’s usage by feature, and what things cost' })
  @ApiParam({ name: 'orgId' })
  async overview(@Req() req: any, @Param('orgId') orgId: string) {
    // orgId comes straight off the URL: without this, any account reads any
    // other organization's balance and what it spends it on.
    await this.orgContext.assertMembership(req.user?.userId, orgId);

    const config = this.tokens.config();
    if (config.mode === 'off') return { enabled: false, mode: config.mode };

    const balance = await this.tokens.getBalance(orgId);
    const lines = await this.tokens.usageByAction(orgId, balance.allowance.periodStart);

    return {
      enabled: true,
      ...balance,
      usage: {
        since: balance.allowance.periodStart,
        totalTokens: lines.reduce((sum, line) => sum + line.tokens, 0),
        lines,
      },
      rates: rateCard(config),
    };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'The token ledger, newest first' })
  @ApiParam({ name: 'orgId' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'cursor', required: false })
  async transactions(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    await this.orgContext.assertMembership(req.user?.userId, orgId);
    if (this.tokens.config().mode === 'off') return { items: [], nextCursor: null };

    const parsed = parseInt(limit ?? '', 10);
    return this.tokens.history(orgId, {
      limit: Number.isFinite(parsed) ? parsed : undefined,
      cursor: cursor || undefined,
    });
  }
}

export class AdjustTokensDto {
  /** Signed: positive grants bonus tokens, negative takes them back. */
  @IsInt()
  @Min(-MAX_TOKENS_PER_OPERATION)
  @Max(MAX_TOKENS_PER_OPERATION)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class SetAllowanceDto {
  /** Null returns the organization to the platform default. */
  @ValidateIf((_o, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(MAX_TOKENS_PER_OPERATION)
  monthlyAllowance!: number | null;
}

/** What only a platform operator may do: give tokens, and set an allowance. */
@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin/organizations/:orgId/tokens')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class TokensAdminController {
  constructor(private readonly tokens: TokensService) {}

  @Get()
  @ApiOperation({ summary: 'One organization’s tokens and its full ledger, including operator notes' })
  @ApiParam({ name: 'orgId' })
  async overview(@Param('orgId') orgId: string, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const parsed = parseInt(limit ?? '', 10);
    const [balance, history] = await Promise.all([
      this.tokens.getBalance(orgId),
      this.tokens.history(orgId, {
        limit: Number.isFinite(parsed) ? parsed : undefined,
        cursor: cursor || undefined,
        includeInternal: true,
      }),
    ]);
    return { ...balance, ...history };
  }

  @Post('adjust')
  @ApiOperation({ summary: 'Grant bonus tokens (positive) or take some back (negative)' })
  @ApiParam({ name: 'orgId' })
  adjust(@Req() req: any, @Param('orgId') orgId: string, @Body() body: AdjustTokensDto) {
    return this.tokens.adjust({
      organizationId: orgId,
      amount: body.amount,
      note: body.note,
      actorUserId: req.user?.userId,
    });
  }

  @Put('allowance')
  @ApiOperation({ summary: 'Set the monthly allowance for one organization, or null for the platform default' })
  @ApiParam({ name: 'orgId' })
  setAllowance(@Param('orgId') orgId: string, @Body() body: SetAllowanceDto) {
    return this.tokens.setMonthlyAllowance(orgId, body.monthlyAllowance);
  }
}
