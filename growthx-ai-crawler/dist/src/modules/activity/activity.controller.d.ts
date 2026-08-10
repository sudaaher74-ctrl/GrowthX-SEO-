import { ActivityService } from './activity.service';
export declare class ActivityController {
    private readonly activity;
    constructor(activity: ActivityService);
    list(projectId: string, limit?: string): Promise<import("./activity.service").ActivityItem[]>;
}
