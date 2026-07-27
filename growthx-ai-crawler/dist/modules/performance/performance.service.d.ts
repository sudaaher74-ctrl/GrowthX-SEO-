import { PrismaService } from '../../database/prisma.service';
export interface PerformanceMetrics {
    performanceScore?: number;
    accessibilityScore?: number;
    bestPracticesScore?: number;
    seoScore?: number;
    lcpMs?: number;
    inpMs?: number;
    clsScore?: number;
    isSimulated?: boolean;
}
export declare class PerformanceService {
    private readonly prisma;
    private readonly logger;
    private readonly apiKey;
    constructor(prisma: PrismaService);
    /**
     * Fetches Google PageSpeed Insights Core Web Vitals and Lighthouse scores for a URL
     */
    fetchPageSpeedMetrics(pageId: string, targetUrl: string, strategy?: 'MOBILE' | 'DESKTOP'): Promise<PerformanceMetrics>;
    /**
     * Generates realistic mock PageSpeed scores when testing offline
     */
    private generateSimulatedMetrics;
}
