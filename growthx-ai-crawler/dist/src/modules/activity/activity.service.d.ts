import { PrismaService } from '../../database/prisma.service';
export type ActivityStatus = 'success' | 'warning' | 'pending' | 'error';
export interface ActivityItem {
    id: string;
    status: ActivityStatus;
    message: string;
    time: string;
}
/**
 * A project's activity feed, assembled from tables that already exist rather
 * than a dedicated event log — every one of these actions already writes a
 * timestamped row somewhere, so this just reads and merges them.
 */
export declare class ActivityService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(projectId: string, limit?: number): Promise<ActivityItem[]>;
}
