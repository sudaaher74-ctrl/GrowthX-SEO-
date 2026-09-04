import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DataFeedsService } from './data-feeds.service';

@ApiTags('Diagnostics')
@ApiBearerAuth()
@Controller('api/projects/:projectId/diagnostics')
@UseGuards(JwtAuthGuard)
export class DiagnosticsController {
  constructor(private readonly dataFeeds: DataFeedsService) {}

  @Get('data-feeds')
  @ApiOperation({
    summary: 'Whether the data behind each tab is actually arriving',
    description:
      'Counts and timestamps for the four inputs the product depends on. Answers "is this tab broken ' +
      'or do I have no data yet?", which the honest empty states cannot answer on their own. Reports ' +
      'whether keys are present, never their values.',
  })
  @ApiParam({ name: 'projectId' })
  async check(@Param('projectId') projectId: string) {
    return this.dataFeeds.check(projectId);
  }
}
