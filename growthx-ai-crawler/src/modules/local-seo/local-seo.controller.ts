import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LocalSeoService } from './local-seo.service';

@Controller('projects/:projectId/local-seo')
@UseGuards(JwtAuthGuard)
export class LocalSeoController {
  constructor(private readonly localSeoService: LocalSeoService) {}

  @Get()
  async getLocalSeo(@Param('projectId') projectId: string) {
    return this.localSeoService.getLocalSeo(projectId);
  }
}
