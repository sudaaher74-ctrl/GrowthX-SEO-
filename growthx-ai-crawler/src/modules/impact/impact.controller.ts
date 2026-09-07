import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AiAssistant, ChangeClass, InterventionArm } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImpactService, MEASUREMENT_WINDOWS, MeasurementWindow } from './impact.service';

@Controller('api/projects/:projectId/impact')
@UseGuards(JwtAuthGuard)
export class ImpactController {
  constructor(private readonly impact: ImpactService) {}

  /** Records a change that shipped, or one deliberately withheld as a control. */
  @Post('interventions')
  async record(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      url: string;
      changeClass: ChangeClass;
      arm?: InterventionArm;
      summary?: string;
      beforePageId?: string;
      automationRunId?: string;
      pullRequestUrl?: string;
    },
  ) {
    return this.impact.recordIntervention({ projectId, ...body });
  }

  @Post('interventions/:id/shipped')
  async markShipped(
    @Param('id') id: string,
    @Body() body: { mergedSha?: string; afterPageId?: string },
  ) {
    return this.impact.markShipped(id, body?.mergedSha, body?.afterPageId);
  }

  /** Measures one intervention over one window. */
  @Post('interventions/:id/measure')
  async measure(
    @Param('id') id: string,
    @Body() body: { windowDays?: number; assistant?: AiAssistant },
  ) {
    const windowDays = (MEASUREMENT_WINDOWS as readonly number[]).includes(body?.windowDays ?? 30)
      ? ((body?.windowDays ?? 30) as MeasurementWindow)
      : 30;
    return this.impact.measure(id, windowDays, body?.assistant ?? null);
  }

  /** Measured effect per change class, with how much evidence sits behind each. */
  @Get('change-classes')
  async changeClasses(
    @Param('projectId') projectId: string,
    @Query('windowDays') windowDays?: string,
  ) {
    const parsed = Number(windowDays);
    const window = (MEASUREMENT_WINDOWS as readonly number[]).includes(parsed)
      ? (parsed as MeasurementWindow)
      : 30;
    return this.impact.changeClassSummary(projectId, window);
  }
}
