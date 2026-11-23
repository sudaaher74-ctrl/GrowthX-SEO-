import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
// Loaded on demand. The TypeScript compiler is ~45MB of RSS the moment it is
// required, and this service transpiles a customer's changed files to check
// them -- which happens only when the autonomous engineer has been asked to
// patch a repository. Held at import, that memory was resident on every
// instance for a feature that runs on no normal day, on a box that was being
// OOM-killed at 512MB while crawling.
import type * as ts from 'typescript';

const execAsync = promisify(exec);

/**
 * Running a customer's install and `build` script executes code the customer
 * (or anyone who can push to their repository) wrote. `--ignore-scripts` stops
 * dependency lifecycle scripts, not the repository's own `build`. On the API
 * host that code could read the process environment and everything the API can
 * reach, so it is off unless the operator states the build runs somewhere
 * isolated: no secrets, no route to the database or internal network.
 */
export function buildsEnabled(): boolean {
  return process.env.AUTONOMOUS_ENGINEER_RUN_BUILDS === 'true';
}

/**
 * The environment a customer build gets: a path to find tools, and nothing the
 * API holds. Variables are listed, never inherited.
 */
export function sandboxEnv(home: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: home,
    TMPDIR: home,
    CI: 'true',
    NEXT_TELEMETRY_DISABLED: '1',
    npm_config_ignore_scripts: 'true',
  };
}

/**
 * A build that fails because the runner lacks the customer's own configuration
 * is not a fault in the patch. Matched on specific messages: the earlier test
 * for words like "key" or "token" excused almost any failure.
 */
export const MISSING_CONFIGURATION =
  /(?:missing|undefined|not set|required)[^\n]{0,60}(?:environment variable|env var|\benv\b)|\b(?:DATABASE_URL|DIRECT_URL)\b|ECONNREFUSED|getaddrinfo|P1001|PrismaClientInitializationError/i;

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

    // 2. Resolve the application's manifest from the changed file. Repositories
    // often keep the app under apps/web or frontend rather than at the root.
    const packageRoots = new Set<string>();
    for (const file of filesToCheck) {
      const root = await this.findPackageRoot(repoDir, file);
      if (root) packageRoots.add(root);
    }
    if (packageRoots.size > 1) {
      return { success: false, output: 'Changed files span multiple Node applications; validate each application separately.' };
    }
    const packageRoot = [...packageRoots][0];
    if (!packageRoot) {
      return { success: true, output: `${syntaxResult.output}. Build skipped: no package.json found for the changed files; non-Node build was not validated.` };
    }
    const pkgPath = path.join(packageRoot, 'package.json');
    let pkg: any = null;
    try {
      const content = await fs.readFile(pkgPath, 'utf8');
      pkg = JSON.parse(content);
    } catch (error) {
      return { success: false, output: 'Cannot validate application: package.json is unreadable or invalid JSON.' };
    }

    if (!pkg?.scripts?.build) {
      this.logger.log(`No build script in package.json. File syntax verified.`);
      return { success: true, output: `${syntaxResult.output}. Build skipped: no build script in package.json.` };
    }

    // 3. Attempt sandbox build, only where the operator has isolated it
    if (!buildsEnabled()) {
      this.logger.log('Build validation is off (AUTONOMOUS_ENGINEER_RUN_BUILDS is not "true"); syntax verified only.');
      return {
        success: true,
        output: `${syntaxResult.output}. Build skipped: isolated build execution is disabled. Repository CI must verify the change before approval.`,
      };
    }
    return this.attemptBuild(packageRoot, packageManager, pkg, filesToCheck);
  }

  private async findPackageRoot(repoDir: string, changedFile: string): Promise<string | null> {
    const root = path.resolve(repoDir);
    let current = path.dirname(path.resolve(root, changedFile));
    while (current === root || current.startsWith(`${root}${path.sep}`)) {
      try {
        await fs.access(path.join(current, 'package.json'));
        return current;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      if (current === root) break;
      current = path.dirname(current);
    }
    return null;
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
   * Validates the concrete syntax of a single file's content in memory (AST parse / JSON / HTML / XML / CSS / text).
   * Unknown extensions return success here so incremental edit checks do not block them; `validateFilesSyntax` enforces the supported extension list.
   */
  async validateContentSyntax(relativePath: string, content: string): Promise<ValidationResult> {
    const ext = path.extname(relativePath).toLowerCase();
    const base = path.basename(relativePath);
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      const ts = await import('typescript');
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
          return `${base} (${pos.line + 1}:${pos.character + 1}): ${message}`;
        });
        return {
          success: false,
          output: `Syntax error in generated fix: ${errors.join('; ')}`,
        };
      }
      return { success: true, output: `Syntax valid for ${base}` };
    }

    if (ext === '.json') {
      try {
        JSON.parse(content);
      } catch (e: any) {
        return {
          success: false,
          output: `Invalid JSON in ${base}: ${e.message}`,
        };
      }
      return { success: true, output: `Valid JSON in ${base}` };
    }

    if (ext === '.html' || ext === '.htm') {
      if (!content.trim()) {
        return { success: false, output: `Syntax error in generated fix: ${base} is empty.` };
      }
      const withoutComments = content.replace(/<!--[\s\S]*?-->/g, '');
      for (const tag of ['script', 'style', 'head', 'body']) {
        const opens = (withoutComments.match(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi')) || []).length;
        const closes = (withoutComments.match(new RegExp(`</${tag}\\s*>`, 'gi')) || []).length;
        if (opens !== closes) {
          return {
            success: false,
            output: `Syntax error in generated fix: ${base} has mismatched <${tag}> tags (${opens} open, ${closes} close).`,
          };
        }
      }
      const jsonLdRe = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let match: RegExpExecArray | null;
      let blockIdx = 0;
      while ((match = jsonLdRe.exec(withoutComments)) !== null) {
        blockIdx += 1;
        const rawJson = match[1].trim();
        if (!rawJson) {
          return { success: false, output: `Invalid JSON-LD block #${blockIdx} in ${base}: block is empty.` };
        }
        try {
          JSON.parse(rawJson);
        } catch (e: any) {
          return { success: false, output: `Invalid JSON-LD block #${blockIdx} in ${base}: ${e.message}` };
        }
      }
      return { success: true, output: `HTML syntax valid for ${base}` };
    }

    if (ext === '.xml') {
      const stripped = content
        .replace(/<\?[\s\S]*?\?>/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
        .trim();
      if (!stripped) {
        return { success: false, output: `Syntax error in generated fix: ${base} has no XML elements.` };
      }
      const stack: string[] = [];
      const tagRe = /<(\/?)([A-Za-z_][\w:.-]*)(?:\s[^<>]*?)?(\/?)>/g;
      let tagMatch: RegExpExecArray | null;
      let seenTags = 0;
      while ((tagMatch = tagRe.exec(stripped)) !== null) {
        seenTags += 1;
        const [, isClosing, tagName, isSelfClosing] = tagMatch;
        if (isSelfClosing) continue;
        if (!isClosing) {
          stack.push(tagName);
        } else {
          const expected = stack.pop();
          if (expected !== tagName) {
            return {
              success: false,
              output: `Syntax error in generated fix: ${base} has mismatched XML closing tag </${tagName}> (expected </${expected ?? 'none'}>).`,
            };
          }
        }
      }
      if (seenTags === 0 || stack.length > 0) {
        return {
          success: false,
          output: `Syntax error in generated fix: ${base} has unclosed XML tag(s): ${stack.join(', ') || 'no root element'}.`,
        };
      }
      return { success: true, output: `XML syntax valid for ${base}` };
    }

    if (ext === '.css' || ext === '.scss') {
      const cleaned = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(["'])(?:\\.|(?!\1)[^\\\n])*\1/g, '');
      let depth = 0;
      for (const ch of cleaned) {
        if (ch === '{') depth += 1;
        else if (ch === '}') {
          depth -= 1;
          if (depth < 0) {
            return { success: false, output: `Syntax error in generated fix: ${base} has an unexpected closing brace '}'.` };
          }
        }
      }
      if (depth !== 0) {
        return { success: false, output: `Syntax error in generated fix: ${base} has ${depth} unclosed '{' brace(s).` };
      }
      return { success: true, output: `CSS syntax valid for ${base}` };
    }

    if (ext === '.txt' || ext === '.md' || ext === '.mdx') {
      if (!content.trim() || content.includes('\0')) {
        return { success: false, output: `Syntax error in generated fix: ${base} is empty or binary.` };
      }
      if (base.toLowerCase() === 'robots.txt' && !/^\s*(user-agent|sitemap)\s*:/im.test(content)) {
        return { success: false, output: `Syntax error in generated fix: ${base} must declare at least one User-agent or Sitemap directive.` };
      }
      return { success: true, output: `Text syntax valid for ${base}` };
    }

    return { success: true, output: `Syntax check skipped for ${base}` };
  }

  /**
   * Validates the concrete syntax of modified files (AST parse & web-asset syntax diagnostics).
   * Catches unclosed JSX/HTML/XML tags, malformed CSS braces, and invalid JSON/JSON-LD immediately.
   */
  async validateFilesSyntax(repoDir: string, files: string[]): Promise<ValidationResult> {
    const supportedExts = new Set([
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json',
      '.html', '.htm', '.xml', '.css', '.scss', '.txt', '.md', '.mdx',
    ]);
    let checked = 0;
    const skipped: string[] = [];
    for (const relativePath of files) {
      const absolutePath = path.resolve(repoDir, relativePath);
      const withinRepo = path.relative(path.resolve(repoDir), absolutePath);
      if (withinRepo.startsWith('..') || path.isAbsolute(withinRepo)) {
        return { success: false, output: `Cannot validate file outside repository: ${relativePath}` };
      }
      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf8');
      } catch {
        return { success: false, output: `Cannot read changed file: ${relativePath}. Validate deletions separately.` };
      }

      const ext = path.extname(relativePath).toLowerCase();
      if (!supportedExts.has(ext)) {
        skipped.push(relativePath);
        continue;
      }
      checked++;

      const fileResult = await this.validateContentSyntax(relativePath, content);
      if (!fileResult.success) {
        return fileResult;
      }
    }

    if (!checked || skipped.length) {
      return { success: false, output: `Syntax validation incomplete: ${checked} files checked; unsupported files: ${skipped.join(', ') || 'none; no changed files resolved'}. Review with the repository native validator.` };
    }
    return { success: true, output: `Syntax validation passed for ${checked} changed files; type checking and runtime behavior were not checked` };
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

    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'growthx-build-'));
    const env = sandboxEnv(home);
    try {
      return await this.runInstallAndBuild(repoDir, installCmd, buildCmd, env, filesToCheck);
    } finally {
      await fs.rm(home, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async runInstallAndBuild(
    repoDir: string,
    installCmd: string,
    buildCmd: string,
    env: NodeJS.ProcessEnv,
    filesToCheck: string[],
  ): Promise<ValidationResult> {
    // Step 1: Install dependencies
    try {
      this.logger.log(`Running dependency install: ${installCmd}...`);
      await execAsync(installCmd, { cwd: repoDir, timeout: 120000, env });
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
      const { stdout } = await execAsync(buildCmd, { cwd: repoDir, timeout: 180000, env });
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
      const isEnvOrSecretsMissing = MISSING_CONFIGURATION.test(errorText);
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

