import { PrismaService } from '../../database/prisma.service';
import { AiVisibilityService } from '../ai-visibility/ai-visibility.service';
export interface PortfolioClient {
    projectId: string;
    name: string;
    domain: string | null;
    initials: string;
    tier: string | null;
    /** Minor units (paise/cents). Null when the agency has not recorded one. */
    retainerMonthlyMinor: number | null;
    retainerCurrency: string;
    /** Null when no prompts are tracked — distinct from 0%. */
    aiCitationSharePct: number | null;
    aiDeltaPt: number | null;
    /** 0-100, weighted by issue severity. Null when never crawled. */
    health: number | null;
    trackedPrompts: number;
    averagePosition: number | null;
    criticalIssues: number;
    /** Weekly citation share, oldest first, for the sparkline. */
    trend: number[];
    lastCrawledAt: string | null;
}
export interface PortfolioSummary {
    /** Blended across clients that have visibility data. */
    portfolioAiSharePct: number | null;
    portfolioAiDeltaPt: number | null;
    promptsTracked: number;
    clientsImproving: number;
    clientsDeclining: number;
    clientCount: number;
    openCriticals: number;
    /** Sum of recorded retainers only; clients without one are excluded. */
    mrrMinor: number;
    mrrCurrency: string;
    /** How many clients have no retainer recorded, so the UI can caveat MRR. */
    clientsWithoutRetainer: number;
}
export interface PortfolioAlert {
    projectId: string;
    title: string;
    detail: string;
    tag: 'AI' | 'CRAWL' | 'SETUP';
    severity: 'critical' | 'warning' | 'info';
}
/**
 * The agency portfolio view: every client in one organization, side by side.
 *
 * Anything we cannot measure is returned as `null`, never as a zero. A client
 * with no tracked prompts has unknown AI share, not 0% — showing 0 would tell
 * an agency they are losing when they simply have not started measuring.
 */
export declare class PortfolioService {
    private readonly prisma;
    private readonly visibility;
    constructor(prisma: PrismaService, visibility: AiVisibilityService);
    getPortfolio(organizationId: string, days?: number): Promise<{
        clients: PortfolioClient[];
        summary: PortfolioSummary;
        alerts: PortfolioAlert[];
    }>;
    private countIssues;
    /**
     * 100 minus a severity-weighted penalty per crawled page. Deliberately simple
     * and explainable — an agency has to defend this number to a client.
     */
    private healthScore;
    private initials;
    private summarise;
    /** The "needs your attention" feed: what an agency owner should act on. */
    private buildAlerts;
    /** Lets an agency record what a client pays, so MRR is real rather than mocked. */
    setRetainer(projectId: string, data: {
        tier?: string | null;
        retainerMonthlyMinor?: number | null;
        retainerCurrency?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        organizationId: string;
        tier: string | null;
        retainerMonthlyMinor: number | null;
        retainerCurrency: string;
    }>;
}
