export declare class PatchGenerationService {
    private readonly logger;
    /**
     * AST-aware method to inject or update a Next.js metadata property (e.g. title)
     * in a specific file like layout.tsx or page.tsx.
     */
    updateNextJsMetadata(filePath: string, propertyName: string, newValue: string): Promise<boolean>;
}
