import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateIntelligenceDto {
  @ApiProperty({ description: 'Business Name', example: 'Acme SaaS' })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({ description: 'Industry or vertical', example: 'B2B Analytics' })
  @IsString()
  @IsNotEmpty()
  industry: string;

  @ApiPropertyOptional({ description: 'Target Country / Geography', example: 'India' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Target Audience Profile', example: 'CTOs and Engineering Leaders at Scale-ups' })
  @IsString()
  @IsOptional()
  targetAudience?: string;

  @ApiPropertyOptional({ description: 'Competitors', example: 'Mixpanel, Amplitude' })
  @IsOptional()
  competitors?: string[] | string;

  @ApiPropertyOptional({ description: 'Business Goals', example: 'Grow organic signups by 40%' })
  @IsOptional()
  businessGoals?: string[] | string;

  @ApiPropertyOptional({ description: 'Current Website URL', example: 'https://acme.io' })
  @IsString()
  @IsOptional()
  currentWebsite?: string;

  @ApiPropertyOptional({ description: 'Current Social Media', example: { linkedin: 'https://linkedin.com/company/acme' } })
  @IsOptional()
  currentSocialMedia?: Record<string, string> | string;

  @ApiPropertyOptional({ description: 'Current SEO Data', example: { domainAuthority: 45, organicTraffic: 25000 } })
  @IsOptional()
  currentSeoData?: Record<string, any> | string;

  @ApiPropertyOptional({ description: 'Additional instructions or custom focus', example: 'Focus heavily on programmatic SEO' })
  @IsString()
  @IsOptional()
  additionalNotes?: string;
}
