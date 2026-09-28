import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MarkStepDto, SavePlanDto } from './saved-plans.dto';
import { SavedPlansService } from './saved-plans.service';

/**
 * `JwtAuthGuard` is every `/api/projects/:projectId/...` controller's
 * project scoping: it loads the project, checks the caller's membership, and
 * 404s a project the caller cannot see.
 */
@ApiTags('Saved plans')
@ApiBearerAuth()
@Controller('api/projects/:projectId')
@UseGuards(JwtAuthGuard)
export class SavedPlansController {
  constructor(private readonly plans: SavedPlansService) {}

  @Get('saved-plans')
  @ApiOperation({ summary: 'Every plan saved on this project, newest first' })
  @ApiParam({ name: 'projectId' })
  list(@Param('projectId') projectId: string) {
    return this.plans.list(projectId);
  }

  @Post('saved-plans')
  @ApiOperation({ summary: 'Save a plan, or update one already saved (same id)' })
  @ApiParam({ name: 'projectId' })
  save(@Param('projectId') projectId: string, @Body() body: SavePlanDto) {
    return this.plans.save(projectId, body);
  }

  @Delete('saved-plans/:planId')
  @ApiOperation({ summary: 'Remove a saved plan' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'planId' })
  remove(@Param('projectId') projectId: string, @Param('planId') planId: string) {
    return this.plans.remove(projectId, planId);
  }

  @Get('action-plan/done')
  @ApiOperation({ summary: 'When each action-plan step was marked done' })
  @ApiParam({ name: 'projectId' })
  done(@Param('projectId') projectId: string) {
    return this.plans.doneSteps(projectId);
  }

  @Post('action-plan/done')
  @ApiOperation({ summary: 'Mark an action-plan step done, or not done' })
  @ApiParam({ name: 'projectId' })
  markDone(@Param('projectId') projectId: string, @Body() body: MarkStepDto) {
    return this.plans.markStep(projectId, body);
  }
}
