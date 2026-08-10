export interface ValidationResult {
    success: boolean;
    output: string;
}
export declare class ValidationService {
    private readonly logger;
    /**
     * Runs the validation step (e.g. npm run build or tsc) in the target repo.
     */
    validateRepository(repoDir: string, packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun'): Promise<ValidationResult>;
}
