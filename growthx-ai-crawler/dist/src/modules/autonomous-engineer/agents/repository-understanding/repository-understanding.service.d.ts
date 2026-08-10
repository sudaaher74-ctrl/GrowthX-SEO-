export interface RepositoryContext {
    framework: 'Next.js' | 'Vue' | 'Nuxt' | 'React' | 'Angular' | 'Astro' | 'Unknown';
    isMonorepo: boolean;
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
    dependencies: Record<string, string>;
}
export declare class RepositoryUnderstandingService {
    private readonly logger;
    analyzeRepository(repoDir: string): Promise<RepositoryContext>;
}
