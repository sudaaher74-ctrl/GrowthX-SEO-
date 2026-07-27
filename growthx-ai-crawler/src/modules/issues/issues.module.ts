import { Global, Module } from '@nestjs/common';
import { IssueEngineService } from './issue-engine.service';

@Global()
@Module({
  providers: [IssueEngineService],
  exports: [IssueEngineService],
})
export class IssuesModule {}
