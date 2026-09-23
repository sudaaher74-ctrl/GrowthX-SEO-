import { Global, Module } from '@nestjs/common';
import { IssueEngineService } from './issue-engine.service';
import { IssueCountService } from './issue-count.service';
import { IssueGroupService } from './issue-group.service';
import { IssuesController } from './issues.controller';

@Global()
@Module({
  controllers: [IssuesController],
  providers: [IssueEngineService, IssueCountService, IssueGroupService],
  exports: [IssueEngineService, IssueCountService, IssueGroupService],
})
export class IssuesModule {}
