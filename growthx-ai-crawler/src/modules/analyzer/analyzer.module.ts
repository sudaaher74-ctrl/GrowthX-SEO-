import { Global, Module } from '@nestjs/common';
import { ImageAnalyzerService } from './image-analyzer.service';
import { LinkAnalyzerService } from './link-analyzer.service';
import { SchemaValidatorService } from './schema-validator.service';
import { ContentAnalyzerService } from './content-analyzer.service';

@Global()
@Module({
  providers: [ImageAnalyzerService, LinkAnalyzerService, SchemaValidatorService, ContentAnalyzerService],
  exports: [ImageAnalyzerService, LinkAnalyzerService, SchemaValidatorService, ContentAnalyzerService],
})
export class AnalyzerModule {}
