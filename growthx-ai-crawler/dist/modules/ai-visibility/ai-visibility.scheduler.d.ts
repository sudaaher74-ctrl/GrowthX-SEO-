import { PrismaService } from '../../database/prisma.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { AiVisibilityService } from './ai-visibility.service';
/**
 * Daily citation sweep. The dashboard's trend line is only meaningful if the
 * checks run on a schedule rather than when someone happens to open the page.
 */
export declare class AiVisibilityScheduler {
    private readonly prisma;
    private readonly visibility;
    private readonly entitlements;
    private readonly logger;
    constructor(prisma: PrismaService, visibility: AiVisibilityService, entitlements: EntitlementsService);
    /** 06:00 UTC, matching the rank-tracking cadence the dashboard advertises. */
    handleDailySweep(): Promise<void>;
    /** Exposed for the admin "run now" path and for tests. */
    sweepOne(projectId: string): Promise<import("./ai-visibility.service").SweepResult>;
}
