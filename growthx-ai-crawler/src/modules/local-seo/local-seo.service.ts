import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LocalSeoService {
  constructor(private prisma: PrismaService) {}

  /**
   * Returns the project's own local listing, or null when none is connected.
   *
   * This used to seed a placeholder business ("GrowthX Corp., 123 Market St,
   * San Francisco") with invented ratings and keyword rankings whenever a
   * project had no data. Every customer saw the same fictional storefront
   * presented as their own listing, and because the rows were persisted the
   * fiction outlived the request. The client renders an empty state instead.
   */
  async getLocalSeo(projectId: string) {
    return this.prisma.localLocation.findUnique({
      where: { projectId },
      include: { rankings: true },
    });
  }
}
