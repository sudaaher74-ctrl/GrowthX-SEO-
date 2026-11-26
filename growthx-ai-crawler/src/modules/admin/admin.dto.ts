import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export const ADMIN_SUBSCRIPTION_TIERS = ['founder_free', 'starter', 'growth', 'agency'] as const;
export type AdminSubscriptionTier = (typeof ADMIN_SUBSCRIPTION_TIERS)[number];

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
