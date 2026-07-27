import { PrismaService } from '../../database/prisma.service';
export interface GeneratedFixPatch {
    fixType: 'META_TITLE' | 'META_DESCRIPTION' | 'ALT_TEXT' | 'FAQ_SCHEMA' | 'PRODUCT_SCHEMA' | 'CANONICAL_URL' | 'INTERNAL_LINKING';
    targetUrl: string;
    originalValue?: string;
    proposedValue: string;
    codeSnippet: string;
}
export declare class AutoFixService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    /**
     * Generates specific code/text patch for an issue.
     * Module 16 Requirement: Every change requires user approval before execution.
     */
    generateFixPatch(issueId: string): Promise<GeneratedFixPatch>;
    /**
     * User approves the AI recommendation.
     * Module 16: Every change requires user approval before execution.
     */
    approveAndExecuteFix(issueId: string, approvedByUserId: string): Promise<{
        success: boolean;
        message: string;
        patch: any;
    }>;
    rejectFix(issueId: string, rejectedByUserId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
