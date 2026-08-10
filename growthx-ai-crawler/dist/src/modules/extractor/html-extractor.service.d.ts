export interface ExtractedHtmlData {
    title?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    robotsMeta?: string;
    h1: string[];
    h2: string[];
    h3: string[];
    openGraph: Record<string, string>;
    twitterCards: Record<string, string>;
    jsonLd: any[];
    microdataTypes: string[];
    language?: string;
    charset?: string;
    viewport?: string;
    metaKeywords?: string;
    rawStructuredDataCount: number;
}
export declare class HtmlExtractorService {
    private readonly logger;
    /**
     * Parses raw HTML string and extracts all technical SEO metadata, headers, structured data, and OpenGraph tags.
     */
    extract(html: string, pageUrl: string): ExtractedHtmlData;
}
