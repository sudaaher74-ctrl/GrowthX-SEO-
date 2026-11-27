import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AiProvider, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.types';

export const ADMIN_SUBSCRIPTION_TIERS = ['founder_free', 'starter', 'growth', 'agency'] as const;
export type AdminSubscriptionTier = (typeof ADMIN_SUBSCRIPTION_TIERS)[number];

export const ADMIN_CRAWL_FREQUENCIES = ['OFF', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type AdminCrawlFrequency = (typeof ADMIN_CRAWL_FREQUENCIES)[number];

export class UpdateAdminTenantDto {
  @IsOptional()
  @IsString()
  @IsIn(ADMIN_SUBSCRIPTION_TIERS)
  subscriptionTier?: AdminSubscriptionTier;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  aiMonthlyBudgetUsd?: number | null;

  @IsOptional()
  @IsBoolean()
  whiteLabelEnabled?: boolean;
}

export class QueueActionDto {
  @IsOptional()
  @IsString()
  queue?: string;
}

export class RetryQueueJobsDto {
  @IsOptional()
  @IsString()
  queue?: string;

  @IsOptional()
  @IsString()
  jobId?: string;
}

export class DrainQueueDto {
  @IsString()
  queue!: string;

  @IsOptional()
  @IsBoolean()
  delayed?: boolean;
}

export class UpdateAdminWebsiteDto {
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(ADMIN_CRAWL_FREQUENCIES)
  crawlFrequency?: AdminCrawlFrequency;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  maxConcurrency?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxDepth?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30_000)
  rateLimitDelayMs?: number;
}

export class TriggerWebsiteCrawlDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  maxConcurrency?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxDepth?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  pageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30_000)
  rateLimitDelayMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  renderBudget?: number;

  @IsOptional()
  @IsBoolean()
  useSitemap?: boolean;

  @IsOptional()
  @IsBoolean()
  forceVerify?: boolean;
}

export class ForceFailCrawlDto {
  @IsOptional()
  @IsString()
  @MaxLength(400)
  reason?: string;
}

export class UpdateAiRouterConfigDto {
  @IsOptional()
  @IsString()
  @IsIn(Object.values(AiProvider))
  provider?: AiProvider;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(160)
  modelOverride?: string | null;

  @IsOptional()
  @IsBoolean()
  serverSideFallbackEnabled?: boolean;
}

export class AiRouterProbeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  systemInstruction?: string;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(AiTask))
  task?: AiTask;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(AiProvider))
  provider?: AiProvider;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(16)
  @Max(4000)
  maxTokens?: number;

  @IsOptional()
  @IsBoolean()
  allowFallback?: boolean;
}
