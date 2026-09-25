import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutopilotService } from './autopilot.service';

@ApiTags('Autopilot')
@Controller('api/autopilot')
@UseGuards(JwtAuthGuard)
export class AutopilotController {
  constructor(private readonly autopilot: AutopilotService) {}

  @Post()
  @ApiOperation({ summary: 'Start the autopilot for a website: set up, find competitors, then wait for confirmation' })
  start(@Req() req: any, @Body() body: { domain: string; projectId?: string }) {
    return this.autopilot.start({
      userId: req.user.userId,
      organizationId: req.organizationId,
      domain: body.domain,
      projectId: body.projectId,
    });
  }

  @Get('latest')
  @ApiOperation({ summary: "The project's most recent autopilot run, or null" })
  latest(@Req() req: any, @Query('projectId') projectId: string) {
    return this.autopilot.latest(projectId, req.user.userId);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.autopilot.get(id, req.user.userId);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm which competitors are real; the rest runs automatically' })
  confirm(@Req() req: any, @Param('id') id: string, @Body() body: { domains: string[] }) {
    return this.autopilot.confirm(id, req.user.userId, body.domains ?? []);
  }

  @Post(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.autopilot.cancel(id, req.user.userId);
  }
}
