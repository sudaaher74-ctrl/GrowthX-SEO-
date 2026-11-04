import {
  Equals,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class SyncBacklinkIntelligenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @IsOptional()
  @IsIn(["OWN", "COMPETITOR"])
  targetKind?: "OWN" | "COMPETITOR";
}

export class SyncLinkGapDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  competitorDomain?: string;
}

export class ImportAndAnalyzeGapDto {
  @IsString()
  @MaxLength(2048)
  sourceUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  targetUrl?: string;
}

export class UpdateOutreachDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: any;

  @IsOptional()
  @IsBoolean()
  approvedByUser?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  pitchDraft?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactChannel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  outcome?: string;
}

export class ImportBacklinksDto {
  @IsString() @MaxLength(500000) text!: string;
  @IsOptional() @IsIn(["MANUAL", "GSC_CSV", "CSV"]) discovery?: string;
}

export class BacklinkPageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  offset?: number;
}

export class VerifyBacklinksDto {
  @IsOptional() @IsString() @MaxLength(100) sourceId?: string;
}

export class PlanBacklinkDto {
  @IsString() @MaxLength(100) sourceId!: string;
  @IsString() @MaxLength(2048) targetUrl!: string;
  @Equals(true, {
    message:
      "Review the source and confirm its relevance before planning this action.",
  })
  relevanceReviewed!: boolean;
}

export class BacklinkAnalyticsDto {
  @IsOptional() @Type(() => Number) @IsIn([7, 30, 90]) days?: number;
}

export class ExploreBacklinksDto extends BacklinkPageDto {
  @IsOptional() @IsIn(["OWN", "COMPETITOR", "ALL"]) targetKind?: string;
  @IsOptional()
  @IsIn([
    "ALL",
    "VERIFIED",
    "LOST",
    "MISSING",
    "UNKNOWN",
    "BLOCKED",
    "UNVERIFIED",
  ])
  status?: string;
  @IsOptional()
  @IsIn(["ALL", "FOLLOWED", "QUALIFIED", "MIXED", "UNKNOWN"])
  followState?: string;
  @IsOptional() @IsIn(["ALL", "TEXT", "IMAGE", "OTHER"]) linkType?: string;
  @IsOptional()
  @IsIn(["ALL", "CONTENT", "NAVIGATION", "FOOTER", "SIDEBAR", "UNKNOWN"])
  placement?: string;
  @IsOptional() @IsIn(["ALL", "FRESH", "STALE"]) freshness?: string;
  @IsOptional()
  @IsIn(["newest", "oldest", "changed", "verified"])
  sort?: string;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
