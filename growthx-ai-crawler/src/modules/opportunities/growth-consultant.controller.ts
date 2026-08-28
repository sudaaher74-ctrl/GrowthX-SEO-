import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GrowthConsultantService } from './growth-consultant.service';
import { GrowthContextService } from './growth-context.service';

@ApiTags('Growth Consultant')
@ApiBearerAuth()
@Controller('api/projects/:projectId/consultant')
@UseGuards(JwtAuthGuard)
export class GrowthConsultantController {
  constructor(
    private readonly consultant: GrowthConsultantService,
    private readonly context: GrowthContextService,
  ) {}

  @Post('ask')
  @ApiOperation({ summary: 'Ask a question answered from this project\'s own data' })
  ask(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { question: string; days?: number },
  ) {
    return this.consultant.ask(req.organizationId, projectId, body.question, body.days ?? 28);
  }

  /**
   * The evidence brief on its own, without asking anything.
   *
   * Exposed so the exact text the model is given can be read directly. An
   * answer nobody can audit against its inputs is the failure this design is
   * built to avoid, and hiding the inputs would defeat it.
   */
  @Get('evidence')
  @ApiOperation({ summary: 'The evidence the consultant reasons over' })
  async evidence(@Req() req: any, @Param('projectId') projectId: string, @Query('days') days?: string) {
    return { evidence: await this.context.brief(req.organizationId, projectId, days ? parseInt(days, 10) : 28) };
  }
}
