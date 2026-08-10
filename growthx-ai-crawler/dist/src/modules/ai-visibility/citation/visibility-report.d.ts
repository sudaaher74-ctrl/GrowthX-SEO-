import { AiAssistant } from '@prisma/client';
/** The subset of a PromptCheck the report needs. */
export interface ReportableCheck {
    assistant: AiAssistant;
    checkedAt: Date;
    cited: boolean;
    position: number | null;
    competitorsCited: string[];
    /** Set when the check could not run — excluded from every rate. */
    error: string | null;
}
export interface AssistantBreakdown {
    assistant: AiAssistant;
    checked: number;
    cited: number;
    citationSharePct: number;
}
export interface ShareOfVoiceRow {
    /** `null` identifies the customer; otherwise a competitor domain. */
    domain: string | null;
    label: string;
    mentions: number;
    sharePct: number;
}
export interface TrendPoint {
    weekStart: string;
    checked: number;
    citationSharePct: number;
}
export interface VisibilityReport {
    periodStart: string;
    periodEnd: string;
    summary: {
        /** Checks that actually ran. Failed checks are reported separately. */
        checked: number;
        cited: number;
        citationSharePct: number;
        /** Mean position among named brands, over cited answers only. */
        averagePosition: number | null;
        /** Same metric over the preceding window of equal length. */
        previousCitationSharePct: number | null;
        /** Percentage-point change vs the previous window. */
        deltaPt: number | null;
        failedChecks: number;
    };
    byAssistant: AssistantBreakdown[];
    shareOfVoice: ShareOfVoiceRow[];
    trend: TrendPoint[];
}
/**
 * Turns raw prompt checks into the AI Visibility dashboard's numbers.
 *
 * `checks` must span both the reporting window and the preceding window of
 * equal length, so the period-over-period delta can be computed without a
 * second query. Checks that errored are counted but never fold into a rate —
 * an assistant we could not reach must not read as "did not cite you".
 */
export declare function buildVisibilityReport(checks: ReportableCheck[], options: {
    periodStart: Date;
    periodEnd: Date;
    competitorLabels?: Record<string, string>;
}): VisibilityReport;
