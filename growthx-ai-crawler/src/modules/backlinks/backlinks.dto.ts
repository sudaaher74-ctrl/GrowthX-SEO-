import {
  Equals,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

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
