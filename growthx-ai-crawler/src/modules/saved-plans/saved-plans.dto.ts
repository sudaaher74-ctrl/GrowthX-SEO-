import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export const PLAN_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export const PLAN_STATUSES = ['STAGED', 'APPROVED', 'EXECUTED'] as const;

/** One saved plan, as the browser holds it. Creating and updating are the same call. */
export class SavePlanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsString()
  @MaxLength(60)
  category!: string;

  @IsString()
  @MaxLength(60)
  source!: string;

  @IsIn(PLAN_PRIORITIES)
  priority!: (typeof PLAN_PRIORITIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  impact?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  effortHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  deliverable?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evidence?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  affectedUrl?: string;

  @IsIn(PLAN_STATUSES)
  status!: (typeof PLAN_STATUSES)[number];

  @IsISO8601()
  stagedAt!: string;
}

/** "I've done this" on one action-plan step, or undoing it. */
export class MarkStepDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  stepKey!: string;

  @IsBoolean()
  done!: boolean;

  /** When it was marked done; the server's clock when absent. Kept so a tick made offline keeps its time. */
  @IsOptional()
  @IsISO8601()
  doneAt?: string;
}
