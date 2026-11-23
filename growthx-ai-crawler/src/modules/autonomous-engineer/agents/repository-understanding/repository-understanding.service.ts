import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface RepositoryContext {
  framework: 'Next.js' | 'Vue' | 'Nuxt' | 'React' | 'Angular' | 'Astro' | 'Unknown';
  isMonorepo: boolean;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  dependencies: Record<string, string>;
  appRoot?: string;
}

@Injectable()
export class RepositoryUnderstandingService {
  private readonly logger = new Logger(RepositoryUnderstandingService.name);

  private detectFramework(deps: Record<string, string>): RepositoryContext['framework'] {
    if (deps['next']) return 'Next.js';
    if (deps['nuxt']) return 'Nuxt';
    if (deps['astro']) return 'Astro';
    if (deps['@angular/core']) return 'Angular';
    if (deps['vue']) return 'Vue';
    if (deps['react']) return 'React';
    return 'Unknown';
  }

  private detectPackageManager(entries: string[]): RepositoryContext['packageManager'] {
    if (entries.includes('yarn.lock')) return 'yarn';
    if (entries.includes('pnpm-lock.yaml')) return 'pnpm';
    if (entries.includes('bun.lockb') || entries.includes('bun.lock')) return 'bun';
    return 'npm';
  }

  async analyzeRepository(repoDir: string): Promise<RepositoryContext> {
    this.logger.log(`Analyzing repository structure in ${repoDir}...`);

    const context: RepositoryContext = {
      framework: 'Unknown',
      isMonorepo: false,
      packageManager: 'npm',
      dependencies: {},
    };

    try {
      const entries = await fs.readdir(repoDir, { withFileTypes: true });
      const names = entries.map((e) => e.name);
      context.packageManager = this.detectPackageManager(names);

      if (names.includes('package.json')) {
        const pkgStr = await fs.readFile(path.join(repoDir, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgStr);
        context.dependencies = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
        };
        context.framework = this.detectFramework(context.dependencies);
        if (context.framework !== 'Unknown') context.appRoot = '.';
        if (pkg.workspaces) context.isMonorepo = true;
      }

      // Inspect nested frontend/web app directories when root has no detected web framework (e.g. frontend-react/, web/, apps/web/).
      if (context.framework === 'Unknown') {
        const skipDirs = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'out', 'coverage']);
        const candidates: string[] = [];
        for (const entry of entries) {
          if (!entry.isDirectory() || skipDirs.has(entry.name) || entry.name.startsWith('.')) continue;
          candidates.push(entry.name);
          if (['apps', 'packages', 'workspaces'].includes(entry.name)) {
            const sub = await fs.readdir(path.join(repoDir, entry.name), { withFileTypes: true }).catch(() => []);
            for (const s of sub) {
              if (s.isDirectory() && !skipDirs.has(s.name) && !s.name.startsWith('.')) {
                candidates.push(path.posix.join(entry.name, s.name));
              }
            }
          }
        }
        // Prefer frontend/web/site/client folders first over backend/api folders
        candidates.sort((a, b) => {
          const score = (n: string) =>
            /(frontend|web|site|client|ui|seo)/i.test(n) ? 0 : /(backend|server|api|crawler)/i.test(n) ? 2 : 1;
          return score(a) - score(b) || a.localeCompare(b);
        });
        for (const rel of candidates) {
          const pkgPath = path.join(repoDir, rel, 'package.json');
          try {
            const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            const fw = this.detectFramework(deps);
            if (fw !== 'Unknown') {
              context.framework = fw;
              context.dependencies = deps;
              context.appRoot = rel;
              context.isMonorepo = true;
              const subEntries = await fs.readdir(path.join(repoDir, rel)).catch(() => []);
              if (context.packageManager === 'npm') {
                context.packageManager = this.detectPackageManager(subEntries);
              }
              break;
            }
          } catch {
            // Directory does not contain a readable package.json
          }
        }
      }
    } catch (e: any) {
      this.logger.error(`Failed to analyze repository: ${e.message}`);
    }

    this.logger.log(`Detected framework: ${context.framework}${context.appRoot ? ` (${context.appRoot})` : ''} (${context.packageManager})`);
    return context;
  }
}

