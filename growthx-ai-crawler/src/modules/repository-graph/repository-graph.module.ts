import { Module } from '@nestjs/common';
import { AstParserService } from './ast-parser/ast-parser.service';

@Module({
  providers: [AstParserService],
  exports: [AstParserService]
})
export class RepositoryGraphModule {}
