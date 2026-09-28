import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class InspectUrlsDto {
  /** Specific pages to check. Omitted, the next batch of crawled pages is checked. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  urls?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class DiagnoseKeywordDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  keyword!: string;

  /** The page that should rank. Omitted, the page Google already shows is used. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  pageUrl?: string;
}

export class TrackKeywordsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  keywords!: string[];

  @IsOptional()
  @IsIn(['USER', 'SEARCH_CONSOLE', 'COMPETITOR_GAP'])
  source?: string;
}

export class RefreshGapsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  competitorDomain?: string;

  /** Fetch again even when a fetch from the last week is stored. Each fetch is paid. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class SearchMarketDto {
  /** Country name as Google results use it, e.g. "India". Null resets to automatic. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(8)
  language?: string;
}

export class ChangeRiskDto {
  @IsString()
  @MaxLength(2000)
  url!: string;

  @IsIn(['DELETE', 'REDIRECT', 'CANONICAL', 'URL_CHANGE', 'NOINDEX'])
  change!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  target?: string;
}

export class ChangeImpactQueryDto {
  @IsString()
  @MaxLength(2000)
  url!: string;

  @IsISO8601()
  changedAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(90)
  days?: number;
}
