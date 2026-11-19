import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MonthlyReportsService } from './monthly-reports.service';
import type { MonthlyReportPayload } from './monthly-report-pdf';

@ApiTags('Monthly Reports')
@ApiBearerAuth()
@Controller(['api/projects/:projectId/monthly-reports', 'projects/:projectId/monthly-reports'])
@UseGuards(JwtAuthGuard)
export class MonthlyReportsController {
  constructor(private readonly monthlyReports: MonthlyReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List frozen monthly report snapshots and active share links' })
  list(@Req() req: any, @Param('projectId') projectId: string) {
    return this.monthlyReports.listSnapshots(req.organizationId, projectId);
  }

  @Get(':month')
  @ApiOperation({ summary: 'Get frozen monthly snapshot, commentary notes, and share status for YYYY-MM' })
  getOne(@Req() req: any, @Param('projectId') projectId: string, @Param('month') month: string) {
    return this.monthlyReports.getSnapshot(req.organizationId, projectId, month);
  }

  @Post(':month/notes')
  @ApiOperation({ summary: 'Save editable Account Manager commentary for a month' })
  saveNotes(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('month') month: string,
    @Body() body: { agencyNotes: string },
  ) {
    return this.monthlyReports.saveNotes(req.organizationId, projectId, month, body?.agencyNotes ?? '');
  }

  @Post(':month/lock')
  @ApiOperation({ summary: 'Freeze a monthly report snapshot for permanent historical accuracy' })
  lock(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('month') month: string,
    @Body() body?: { payload?: Partial<MonthlyReportPayload>; agencyNotes?: string },
  ) {
    return this.monthlyReports.lockSnapshot(req.organizationId, projectId, month, body);
  }

  @Post(':month/share')
  @ApiOperation({ summary: 'Generate a zero-login white-labeled client portal share link' })
  share(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('month') month: string,
    @Body() body?: { expiresInDays?: number | null; payload?: Partial<MonthlyReportPayload>; agencyNotes?: string },
  ) {
    return this.monthlyReports.createShareLink(req.organizationId, projectId, month, body);
  }

  @Delete(':month/share')
  @ApiOperation({ summary: 'Revoke the public client share link for a monthly report' })
  revokeShare(@Req() req: any, @Param('projectId') projectId: string, @Param('month') month: string) {
    return this.monthlyReports.revokeShareLink(req.organizationId, projectId, month);
  }

  @Post(':month/pdf')
  @ApiOperation({ summary: 'Generate a server-rendered A4 white-labeled PDF via Playwright' })
  async exportPdf(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('month') month: string,
    @Body() body: { payload?: Partial<MonthlyReportPayload>; agencyNotes?: string } | undefined,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.monthlyReports.renderPdfBuffer(
      req.organizationId,
      projectId,
      month,
      body?.payload,
      body?.agencyNotes,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }
}
