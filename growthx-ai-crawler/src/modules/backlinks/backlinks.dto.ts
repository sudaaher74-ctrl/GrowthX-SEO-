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
