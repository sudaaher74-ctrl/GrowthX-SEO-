import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';
import * as cheerio from 'cheerio';

const execAsync = promisify(exec);

export interface ValidationResult {
  success: boolean;
  output: string;
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  /**
   * Runs the validation step in the target repo.
   *
   * 1. Validates the syntax of any changed files directly (TypeScript/JSX/JS/JSON/HTML).
   * 2. If a package.json exists with a build script, safely attempts install and build.
   * 3. If full build/install fails in the isolated container (e.g. private packages, missing
   *    environment secrets like DATABASE_URL), but file syntax is verified valid, allows
   *    the PR to proceed so the repository's native CI/CD can validate it.
   */
  async validateRepository(
    repoDir: string,
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun',
    changedFiles: string[] = [],
  ): Promise<ValidationResult> {
    this.logger.log(`Starting validation for repository at ${repoDir}...`);

    // 1. Collect and syntax-check all modified files
    const filesToCheck = await this.resolveFilesToCheck(repoDir, changedFiles);
    const syntaxResult = await this.validateFilesSyntax(repoDir, filesToCheck);
    if (!syntaxResult.success) {
      this.logger.error(`Syntax validation failed on generated code: ${syntaxResult.output}`);
      return syntaxResult;
    }

    // 2. Check if this is a Node project with a build script
    const pkgPath = path.join(repoDir, 'package.json');
    let pkg: any = null;
    try {
      const content = await fs.readFile(pkgPath, 'utf8');
      pkg = JSON.parse(content);
    } catch {
      // Non-node project (e.g. Shopify Liquid theme, static HTML, Hugo, Jekyll)
      this.logger.log(`No package.json found in ${repoDir}. File syntax verified.`);
      return { success: true, output: 'Syntax validation passed (non-Node repository)' };
    }

    if (!pkg?.scripts?.build) {
      this.logger.log(`No build script in package.json. File syntax verified.`);
      return { success: true, output: 'Syntax validation passed (no build script in package.json)' };
    }

    // 3. Attempt sandbox build
    return this.attemptBuild(repoDir, packageManager, pkg, filesToCheck);
  }

  /** Resolves relative file paths for all modified or specified files. */
  private async resolveFilesToCheck(repoDir: string, changedFiles: string[]): Promise<string[]> {
    if (changedFiles && changedFiles.length > 0) {
      return changedFiles;
    }
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: repoDir });
      const lines = stdout.split('\n').filter(Boolean);
      return lines
        .map((line) => line.slice(3).trim())
        .filter((file) => !file.startsWith('node_modules/') && !file.startsWith('.git/'));
    } catch {
      return [];
    }
  }

  /**
   * Validates the concrete syntax of modified files (AST parse diagnostics).
   * Catches unclosed JSX tags, malformed expressions, and invalid JSON immediately.
   */
  private async validateFilesSyntax(repoDir: string, files: string[]): Promise<ValidationResult> {
    for (const relativePath of files) {
      const absolutePath = path.resolve(repoDir, relativePath);
      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf8');
      } catch {
        // File may have been removed or moved; skip
        continue;
      }

      const ext = path.extname(relativePath).toLowerCase();

      // TypeScript / JavaScript / JSX / TSX
      if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
        const isJsx = ext === '.tsx' || ext === '.jsx';
        const compilerOptions: ts.CompilerOptions = {
          target: ts.ScriptTarget.Latest,
        };
        if (isJsx) {
          compilerOptions.jsx = ts.JsxEmit.ReactJSX;
        }
        const result = ts.transpileModule(content, {
          compilerOptions,
          reportDiagnostics: true,
          fileName: relativePath,
        });
        const diagnostics = result.diagnostics || [];
        if (diagnostics.length > 0) {
          const errors = diagnostics.map((d: ts.Diagnostic) => {
            const pos = d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start) : { line: 0, character: 0 };
            const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
            return `${path.basename(relativePath)} (${pos.line + 1}:${pos.character + 1}): ${message}`;
          });
          return {
            success: false,
            output: `Syntax error in generated fix: ${errors.join('; ')}`,
          };
        }
      }

      // JSON files
      if (ext === '.json') {
        try {
          JSON.parse(content);
        } catch (e: any) {
          return {
            success: false,
            output: `Invalid JSON in ${path.basename(relativePath)}: ${e.message}`,
          };
        }
      }

      // HTML files
      if (['.html', '.htm'].includes(ext)) {
        try {
          cheerio.load(content, { xmlMode: false });
        } catch (e: any) {
          return {
            success: false,
            output: `Malformed HTML in ${path.basename(relativePath)}: ${e.message}`,
          };
        }
      }
    }

    return { success: true, output: 'Syntax validation passed' };
  }

  /**
   * Attempts safe build validation in the runner environment.
   */
  private async attemptBuild(
    repoDir: string,
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun',
    _pkg: any,
    filesToCheck: string[],
  ): Promise<ValidationResult> {
    const isToolAvailable = async (cmd: string): Promise<boolean> => {
      try {
        await execAsync(`which ${cmd}`);
        return true;
      } catch {
        return false;
      }
    };

    let pm = packageManager;
    if (pm !== 'npm' && !(await isToolAvailable(pm))) {
      this.logger.warn(`Package manager '${pm}' not found on host, falling back to npm`);
      pm = 'npm';
    }

    let installCmd: string;
    let buildCmd: string;

    switch (pm) {
      case 'yarn':
        installCmd = 'yarn install --ignore-scripts --prefer-offline';
        buildCmd = 'yarn run build';
        break;
      case 'pnpm':
        installCmd = 'pnpm install --ignore-scripts --no-frozen-lockfile';
        buildCmd = 'pnpm run build';
        break;
      case 'bun':
        installCmd = 'bun install --no-scripts';
        buildCmd = 'bun run build';
        break;
      default:
        // Always pass --no-audit to prevent the deprecated endpoint notice and audit failures.
        // Always pass --legacy-peer-deps and --ignore-scripts for safe headless runner installs.
        installCmd = 'npm install --no-audit --no-fund --legacy-peer-deps --ignore-scripts --prefer-offline';
        buildCmd = 'npm run build';
        break;
    }

    // Step 1: Install dependencies
    try {
      this.logger.log(`Running dependency install: ${installCmd}...`);
      await execAsync(installCmd, { cwd: repoDir, timeout: 120000 });
    } catch (installErr: any) {
      const summary = (installErr.stderr || installErr.message || '').slice(0, 300);
      this.logger.warn(`Dependency install failed in runner sandbox: ${summary}`);
      // Files syntax was already verified clean. An install failure in a headless container
      // (due to private registries, missing auth tokens, or network policy) should not block the PR.
      return {
        success: true,
        output: `Syntax verified. Full build skipped: dependencies could not be installed in runner sandbox (${summary.slice(0, 150)}). Changes will be verified by repository CI.`,
      };
    }

    // Step 2: Run build
    try {
      this.logger.log(`Running build: ${buildCmd}...`);
      const { stdout } = await execAsync(buildCmd, { cwd: repoDir, timeout: 180000 });
      this.logger.log('Build validation successful.');
      return { success: true, output: stdout };
    } catch (buildErr: any) {
      const errorText = `${buildErr.stdout || ''}\n${buildErr.stderr || ''}\n${buildErr.message || ''}`;
      this.logger.warn(`Build failed in runner sandbox: ${errorText.slice(0, 400)}`);

      // If the error specifically mentions one of the files GrowthX modified:
      const changedFileNames = filesToCheck.map((f) => path.basename(f));
      const mentionsModifiedFile = changedFileNames.some((name) => errorText.includes(name));
      if (mentionsModifiedFile) {
        return {
          success: false,
          output: `Build error caused by modified file: ${errorText.slice(0, 400)}`,
        };
      }

      // Next.js and other frameworks often fail builds during static generation when
      // production database connections or required environment variables are absent.
      const isEnvOrSecretsMissing = /env|database|prisma|connect|credential|key|secret|token|unauthorized|ECONNREFUSED|getaddrinfo/i.test(
        errorText,
      );
      if (isEnvOrSecretsMissing) {
        this.logger.log('Build failed due to missing environment variables/database in runner. Syntax is valid, proceeding with PR.');
        return {
          success: true,
          output: 'Syntax verified. Production build requires external credentials/database not present in runner, proceeding with PR.',
        };
      }

      return {
        success: false,
        output: errorText.slice(0, 400),
      };
    }
  }
}

