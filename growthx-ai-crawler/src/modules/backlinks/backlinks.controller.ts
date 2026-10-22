import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BacklinkQueue } from "./backlink-queue.service";
import {
  BacklinkPageDto,
  ImportBacklinksDto,
  PlanBacklinkDto,
  VerifyBacklinksDto,
} from "./backlinks.dto";
import { BacklinksService } from "./backlinks.service";

@ApiTags("Backlink intelligence")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/projects/:projectId/backlinks")
export class BacklinksController {
  constructor(
    private readonly backlinks: BacklinksService,
    private readonly queue: BacklinkQueue,
  ) {}

  @Get()
  async report(
    @Param("projectId") projectId: string,
    @Query() query: BacklinkPageDto,
  ) {
    const [report, queue] = await Promise.all([
      this.backlinks.report(projectId, query.offset),
      this.queue.status(),
    ]);
    return { ...report, queue };
  }

  @Post("import")
  import(
    @Param("projectId") projectId: string,
    @Body() body: ImportBacklinksDto,
  ) {
    return this.backlinks.import(projectId, body.text, body.discovery);
  }

  @Post("discover")
  discover(@Param("projectId") projectId: string) {
    return this.backlinks.discover(projectId);
  }

  @Post("verify")
  verify(
    @Param("projectId") projectId: string,
    @Body() body: VerifyBacklinksDto,
  ) {
    return this.queue.enqueue(projectId, body.sourceId);
  }

  @Post("reconcile")
  reconcile(@Param("projectId") projectId: string) {
    return this.backlinks.reconcile(projectId);
  }

  @Post("plan")
  plan(@Param("projectId") projectId: string, @Body() body: PlanBacklinkDto) {
    return this.backlinks.plan(projectId, body.sourceId, body.targetUrl);
  }

  @Get("sources/:sourceId/history")
  history(
    @Param("projectId") projectId: string,
    @Param("sourceId") sourceId: string,
    @Query() query: BacklinkPageDto,
  ) {
    return this.backlinks.history(projectId, sourceId, query.offset);
  }

  @Delete("sources/:sourceId")
  remove(
    @Param("projectId") projectId: string,
    @Param("sourceId") sourceId: string,
  ) {
    return this.backlinks.remove(projectId, sourceId);
  }
}
