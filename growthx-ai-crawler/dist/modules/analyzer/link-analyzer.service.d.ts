export interface ExtractedLink {
    targetUrl: string;
    linkType: 'INTERNAL' | 'EXTERNAL';
    anchorText?: string;
    isNofollow: boolean;
    isBrokenAnchor: boolean;
    rawHref: string;
}
export interface LinkAnalysisResult {
    internalLinks: ExtractedLink[];
    externalLinks: ExtractedLink[];
    brokenAnchors: ExtractedLink[];
    nofollowLinks: ExtractedLink[];
    internalCount: number;
    externalCount: number;
    totalCount: number;
}
export declare class LinkAnalyzerService {
    private readonly logger;
    /**
     * Analyzes all hyperlinks in HTML for internal/external classification, nofollow attributes, and broken anchor (#) targets
     */
    analyzeLinks(html: string, pageUrl: string): LinkAnalysisResult;
}
