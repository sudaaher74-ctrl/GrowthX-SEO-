export interface ContentMetrics {
    wordCount: number;
    readingTimeMin: number;
    contentHash: string;
    simHash: string;
    headingStructureErrors: string[];
    imageCount: number;
    internalLinkDensity: number;
    externalLinkDensity: number;
}
export declare class ContentAnalyzerService {
    private readonly logger;
    /**
     * Evaluates textual content quality, word count, reading time, heading hierarchy, and computes hash fingerprints
     */
    analyzeContent(html: string, h1: string[], h2: string[], h3: string[], imageCount: number, internalLinkCount: number, externalLinkCount: number): ContentMetrics;
    /**
     * Computes a 64-bit SimHash representation of word tokens for near-duplicate identification.
     * Two documents with Hamming distance <= 3 are considered near-duplicates.
     */
    computeSimHash(words: string[]): string;
    /**
     * Calculates Hamming distance between two hex SimHashes (returns difference bit count 0-64)
     */
    calculateHammingDistance(hashA: string, hashB: string): number;
}
