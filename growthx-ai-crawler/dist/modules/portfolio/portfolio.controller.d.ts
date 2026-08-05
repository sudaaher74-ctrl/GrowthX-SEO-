import { OrgContextService } from '../billing/org-context.service';
import { PortfolioService } from './portfolio.service';
export declare class SetRetainerDto {
    tier?: string | null;
    retainerMonthlyMinor?: number | null;
    retainerCurrency?: string;
}
/** The agency-level view: all clients in one organization. */
export declare class PortfolioController {
    private readonly portfolio;
    private readonly orgContext;
    constructor(portfolio: PortfolioService, orgContext: OrgContextService);
    getPortfolio(req: any, orgId: string, days?: string): Promise<{
        clients: import("./portfolio.service").PortfolioClient[];
        summary: import("./portfolio.service").PortfolioSummary;
        alerts: import("./portfolio.service").PortfolioAlert[];
    }>;
    setRetainer(req: any, orgId: string, projectId: string, body: SetRetainerDto): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        organizationId: string;
        tier: string | null;
        retainerMonthlyMinor: number | null;
        retainerCurrency: string;
    }>;
}
