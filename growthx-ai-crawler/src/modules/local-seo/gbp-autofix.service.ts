import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GbpService } from '../integrations/gbp.service';

@Injectable()
export class GbpAutofixService {
  private readonly logger = new Logger(GbpAutofixService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gbpService: GbpService,
  ) {}

  /**
   * Approves a fix proposal, applies it to the Google Business Profile, and marks it as PUSHED.
   */
  async approveAndPushFix(proposalId: string, projectId: string) {
    try {
      const proposal = await this.prisma.gbpFixProposal.findFirst({
        where: {
          id: proposalId,
          projectId,
          status: 'PENDING',
        },
      });

      if (!proposal) {
        throw new NotFoundException(`Pending GBP fix proposal ${proposalId} not found for project ${projectId}`);
      }

      // Mark as approved immediately so it doesn't get processed twice
      await this.prisma.gbpFixProposal.update({
        where: { id: proposalId },
        data: { status: 'APPROVED' },
      });

      // Fetch the location name from Google (needed for the patch request)
      const location = await this.gbpService.getLocation(projectId);

      // Build the update payload based on the field
      const updateMask = proposal.field;
      let data = {};
      
      // Simple mapping for common fields
      if (proposal.field.startsWith('profile.')) {
        data = {
          profile: {
            [proposal.field.split('.')[1]]: proposal.proposedValue,
          }
        };
      } else {
        data = {
          [proposal.field]: proposal.proposedValue,
        };
      }

      // Push to Google
      await this.gbpService.patchLocation(projectId, location.name, updateMask, data);

      // Mark as pushed
      await this.prisma.gbpFixProposal.update({
        where: { id: proposalId },
        data: { status: 'PUSHED' },
      });

      this.logger.log(`Successfully pushed GBP fix ${proposalId} to Google API`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error pushing GBP fix ${proposalId} for project ${projectId}`, error);
      
      // Revert to pending on failure
      await this.prisma.gbpFixProposal.update({
        where: { id: proposalId },
        data: { status: 'PENDING' },
      });
      
      throw error;
    }
  }

  /**
   * Rejects a fix proposal so it is no longer pending.
   */
  async rejectFix(proposalId: string, projectId: string) {
    const proposal = await this.prisma.gbpFixProposal.updateMany({
      where: {
        id: proposalId,
        projectId,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
      },
    });

    if (proposal.count === 0) {
      throw new NotFoundException(`Pending GBP fix proposal ${proposalId} not found`);
    }

    return { success: true };
  }
}
