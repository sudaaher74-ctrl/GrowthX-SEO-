import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, Organization, Role } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async createOrganization(userId: string, data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data });
      
      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: org.id,
          role: Role.OWNER,
        },
      });

      return org;
    });
  }

  async getOrganizationsForUser(userId: string): Promise<Organization[]> {
    return this.prisma.organization.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
    });
  }
}

