/**
 * Shapes the evidence a strategy is built from, and turns it into a prompt.
 *
 * Separated from the service so the prompt can be asserted in tests without a
 * database — the risk with a strategy feature is that it quietly becomes
 * generic advice, and the defence is proving the customer's own numbers are in
 * the prompt.
 */
export interface StrategyEvidence {
    business: {
        projectName: string;
        domains: string[];
    };
    site: {
        pagesCrawled: number;
        lastCrawledAt: string | null;
        criticalIssues: number;
        highIssues: number;
        /** Most frequent issue types, worst first. */
        topIssueTypes: {
            issueType: string;
            count: number;
        }[];
        /** A sample of real page titles, so advice can reference actual content. */
        samplePages: {
            url: string;
            title: string | null;
            wordCount: number;
        }[];
    };
    aiVisibility: {
        citationSharePct: number | null;
        averagePosition: number | null;
        byAssistant: {
            assistant: string;
            citationSharePct: number;
        }[];
        /** Prompts where a competitor is cited and the customer is not. */
        lostPrompts: {
            prompt: string;
            competitors: string[];
        }[];
        trackedPromptCount: number;
    };
    competitors: {
        domain: string;
        label: string | null;
    }[];
}
/** The plan we ask the model to produce. */
export declare const STRATEGY_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly businessSummary: {
            readonly type: "string";
            readonly description: "Two or three sentences on what this business sells and to whom, inferred from the site.";
        };
        readonly marketAnalysis: {
            readonly type: "object";
            readonly properties: {
                readonly positioning: {
                    readonly type: "string";
                };
                readonly targetAudience: {
                    readonly type: "string";
                };
                readonly demandSignals: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "string";
                    };
                };
                readonly competitiveThreats: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "string";
                    };
                };
            };
            readonly required: readonly ["positioning", "targetAudience", "demandSignals", "competitiveThreats"];
            readonly additionalProperties: false;
        };
        readonly seoRoadmap: {
            readonly type: "array";
            readonly description: "Sequenced actions. horizon is one of \"30-day\", \"60-day\", \"90-day\".";
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly horizon: {
                        readonly type: "string";
                    };
                    readonly action: {
                        readonly type: "string";
                    };
                    readonly why: {
                        readonly type: "string";
                    };
                    readonly effort: {
                        readonly type: "string";
                    };
                    readonly expectedImpact: {
                        readonly type: "string";
                    };
                };
                readonly required: readonly ["horizon", "action", "why", "effort", "expectedImpact"];
                readonly additionalProperties: false;
            };
        };
        readonly contentPlan: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly title: {
                        readonly type: "string";
                    };
                    readonly format: {
                        readonly type: "string";
                    };
                    readonly targetQuery: {
                        readonly type: "string";
                    };
                    readonly why: {
                        readonly type: "string";
                    };
                };
                readonly required: readonly ["title", "format", "targetQuery", "why"];
                readonly additionalProperties: false;
            };
        };
        readonly socialStrategy: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly platform: {
                        readonly type: "string";
                    };
                    readonly cadence: {
                        readonly type: "string";
                    };
                    readonly contentThemes: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "string";
                        };
                    };
                    readonly why: {
                        readonly type: "string";
                    };
                };
                readonly required: readonly ["platform", "cadence", "contentThemes", "why"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly required: readonly ["businessSummary", "marketAnalysis", "seoRoadmap", "contentPlan", "socialStrategy"];
    readonly additionalProperties: false;
};
export declare const STRATEGY_SYSTEM_PROMPT: string;
/** Renders the evidence as the user turn of the strategy request. */
export declare function buildStrategyPrompt(evidence: StrategyEvidence): string;
