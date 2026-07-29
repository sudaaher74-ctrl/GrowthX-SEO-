import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface RepositoryContext {
  framework: 'Next.js' | 'Vue' | 'Nuxt' | 'React' | 'Angular' | 'Astro' | 'Unknown';
  isMonorepo: boolean;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  dependencies: Record<string, string>;
}

@Injectable()
export class RepositoryUnderstandingService {
  private readonly logger = new Logger(RepositoryUnderstandingService.name);

  async analyzeRepository(repoDir: string): Promise<RepositoryContext> {
    this.logger.log(`Analyzing repository structure in ${repoDir}...`);
    
    const context: RepositoryContext = {
      framework: 'Unknown',
      isMonorepo: false,
      packageManager: 'npm',
      dependencies: {},
    };

    try {
      // Check package manager lock files
      const files = await fs.readdir(repoDir);
      if (files.includes('yarn.lock')) context.packageManager = 'yarn';
      else if (files.includes('pnpm-lock.yaml')) context.packageManager = 'pnpm';
      else if (files.includes('bun.lockb')) context.packageManager = 'bun';

      // Parse package.json
      if (files.includes('package.json')) {
        const pkgStr = await fs.readFile(path.join(repoDir, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgStr);
        
        context.dependencies = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
        };

        if (context.dependencies['next']) context.framework = 'Next.js';
        else if (context.dependencies['nuxt']) context.framework = 'Nuxt';
        else if (context.dependencies['astro']) context.framework = 'Astro';
        else if (context.dependencies['@angular/core']) context.framework = 'Angular';
        else if (context.dependencies['vue']) context.framework = 'Vue';
        else if (context.dependencies['react']) context.framework = 'React';
        
        if (pkg.workspaces) context.isMonorepo = true;
      }
    } catch (e) {
      this.logger.error(`Failed to analyze repository: ${e.message}`);
    }

    this.logger.log(`Detected framework: ${context.framework} (${context.packageManager})`);
    return context;
  }
}

