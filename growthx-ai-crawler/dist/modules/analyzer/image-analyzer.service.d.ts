export interface ExtractedImage {
    imageUrl: string;
    altText?: string;
    width?: number;
    height?: number;
    isLazy: boolean;
    isMissingAlt: boolean;
    isBroken: boolean;
    isLarge: boolean;
}
export declare class ImageAnalyzerService {
    private readonly logger;
    /**
     * Analyzes all images in HTML, detecting alt text issues, lazy loading, and dimension properties
     */
    analyzeImages(html: string, pageUrl: string): ExtractedImage[];
}
