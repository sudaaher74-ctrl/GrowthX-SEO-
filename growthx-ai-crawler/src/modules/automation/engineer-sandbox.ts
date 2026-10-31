import * as fs from 'fs/promises';
import * as path from 'path';
import { patchReactSeo } from '../autonomous-engineer/agents/patch-generation/react-seo-patch';
import { resolveReactRoute } from './react-route';

/**
 * The only way the engineer touches a customer's repository.
 *
 * It is a fixed set of file operations confined to one directory, not a shell:
 * there is no command execution and no network. Three things are never
 * reachable, whatever the model asks for:
 *  - anything outside the repository (including through `..` or a symlink),
 *  - secrets (.env files, keys, credentials),
 *  - files that can run code or change what a build runs on someone else's
 *    behalf (package.json, lockfiles, CI workflows, install hooks), because the
 *    build check installs and builds the repository on our server.
 * Repository content is data. Nothing in a file can widen these limits.
 */

export class SandboxError extends Error {}

const HIDDEN_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'out', '.vercel', '.turbo', 'coverage', '.cache']);

/** Cannot be read or written. */
const SECRET = [/(^|\/)\.env(\..*)?$/i, /\.(pem|key|p12|pfx|crt|cer)$/i, /(^|\/)id_(rsa|dsa|ecdsa|ed25519)/i, /(^|\/)\.npmrc$/i, /(^|\/)\.netrc$/i, /(^|\/)credentials(\..*)?$/i, /(^|\/)secrets?(\..*)?$/i];

/** Can be read, but not changed. */
const PROTECTED = [
  /(^|\/)package\.json$/,
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|npm-shrinkwrap\.json)$/,
  /^\.github\//,
  /^\.gitlab-ci\.yml$/,
  /(^|\/)\.gitmodules$/,
  /(^|\/)\.husky\//,
  /(^|\/)Dockerfile[^/]*$/i,
  /(^|\/)(vercel\.json|netlify\.toml|render\.yaml)$/,
];

export const LIMITS = {
  maxFileBytes: 200_000,
  maxWriteBytes: 100_000,
  maxChangedFiles: 15,
  readLines: 400,
  readChars: 20_000,
  listEntries: 200,
  searchMatches: 40,
  searchFiles: 800,
};

export class RepoSandbox {
  readonly changed = new Set<string>();
  readonly originals = new Map<string, string | null>();
  private realRoot = '';

  constructor(readonly root: string) {}

  async source(rel: string): Promise<string> {
    const abs = await this.inside(this.clean(rel), true);
    const stat = await fs.stat(abs);
    if (!stat.isFile() || stat.size > LIMITS.maxFileBytes) throw new SandboxError('File is not readable within sandbox limits.');
    const content = await fs.readFile(abs, 'utf8');
    if (content.includes('\0')) throw new SandboxError('Binary file is not readable.');
    return content;
  }

  async title(rel: string, value: string, pathname?: string): Promise<string> {
    const p = this.clean(rel);
    this.assertWritable(p);
    if (!value?.trim() || Array.from(value).length > 60) throw new SandboxError('Use a non-empty document title of at most 60 characters.');
    const before = await this.source(p);
    const abs = await this.inside(p, true);
    // Require an app manifest inside the sandbox before using the existing React patcher.
    let app = path.posix.dirname(p);
    let manifest = false;
    while (app !== '.') {
      try { await this.source(`${app}/package.json`); manifest = true; break; } catch { app = path.posix.dirname(app); }
    }
    if (!manifest) { try { await this.source('package.json'); manifest = true; } catch { /* No application manifest. */ } }
    if (!manifest) throw new SandboxError('No application manifest inside this repository.');
    if (pathname) {
      if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('?') || pathname.includes('#')) throw new SandboxError('Use the exact route pathname without query parameters.');
      for (const name of ['router', 'routes', 'App']) for (const ext of ['jsx', 'tsx', 'js', 'ts']) {
        const candidate = path.posix.join(app, 'src', `${name}.${ext}`);
        try { await fs.lstat(path.resolve(this.root, candidate)); } catch (error: any) { if (error.code === 'ENOENT') continue; throw error; }
        await this.source(candidate);
      }
      const routed = await resolveReactRoute(path.resolve(this.root, app), pathname);
      const realRouted = routed ? await fs.realpath(routed).catch(() => path.resolve(routed)) : null;
      const realAbs = await fs.realpath(abs).catch(() => path.resolve(abs));
      if (!realRouted || realRouted !== realAbs) throw new SandboxError('The declared route does not resolve to this page. Read the router and use its exact static page route.');
    }
    for (const entry of ['main.jsx', 'main.tsx', 'index.jsx', 'index.tsx']) {
      const rel = path.posix.join(app, 'src', entry);
      try { await fs.lstat(path.resolve(this.root, rel)); } catch (error: any) { if (error.code === 'ENOENT') continue; throw error; }
      await this.source(rel);
    }
    const result = await patchReactSeo(abs, 'title', value);
    if (!result.applied) throw new SandboxError(result.reason || 'This React page needs manual integration.');
    const after = await fs.readFile(abs, 'utf8');
    if (Buffer.byteLength(after) > LIMITS.maxWriteBytes * 2 || after === before) {
      await fs.writeFile(abs, before);
      throw new SandboxError('Metadata patch was empty or exceeded the file size limit.');
    }
    if (!this.originals.has(p)) this.originals.set(p, before);
    this.changed.add(p);
    return `Connected document title in ${p} using the existing Helmet provider. Preview navigation still requires verification.`;
  }

  private async init() {
    if (!this.realRoot) this.realRoot = await fs.realpath(this.root);
  }

  /** A repository-relative POSIX path, checked, or a SandboxError saying why not. */
  private clean(rel: string): string {
    if (typeof rel !== 'string') throw new SandboxError('A path is required.');
    const p = rel.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    if (p.includes('\0')) throw new SandboxError('Invalid path.');
    const parts = p.split('/').filter((s) => s !== '' && s !== '.');
    if (parts.includes('..')) throw new SandboxError('Paths cannot leave the repository.');
    const first = parts.find((s) => HIDDEN_DIRS.has(s));
    if (first) throw new SandboxError(`${first} is not available.`);
    const joined = parts.join('/');
    if (SECRET.some((r) => r.test(joined))) throw new SandboxError('That file holds secrets and cannot be used.');
    return joined;
  }

  /** Confirms the real location (after symlinks) is still inside the repository. */
  private async inside(rel: string, mustExist: boolean): Promise<string> {
    await this.init();
    const abs = path.resolve(this.root, rel);
    let probe = abs;
    if (!mustExist) {
      // A new file: the nearest existing parent decides.
      for (;;) {
        try {
          await fs.lstat(probe);
          break;
        } catch {
          const up = path.dirname(probe);
          if (up === probe) break;
          probe = up;
        }
      }
    }
    let real: string;
    try {
      real = await fs.realpath(probe);
    } catch {
      throw new SandboxError(`${rel || '.'} does not exist.`);
    }
    if (real !== this.realRoot && !real.startsWith(this.realRoot + path.sep)) {
      throw new SandboxError('Paths cannot leave the repository.');
    }
    return abs;
  }

  private assertWritable(rel: string) {
    if (rel === '') throw new SandboxError('A file path is required.');
    if (PROTECTED.some((r) => r.test(rel))) {
      throw new SandboxError(`${rel} cannot be changed by the engineer (it can run code or change what is installed). Ask a person to change it.`);
    }
    if (!this.changed.has(rel) && this.changed.size >= LIMITS.maxChangedFiles) {
      throw new SandboxError(`No more than ${LIMITS.maxChangedFiles} files can be changed in one run.`);
    }
  }

  async list(rel = ''): Promise<string> {
    const p = rel === '' || rel === '.' ? '' : this.clean(rel);
    const abs = await this.inside(p, true);
    const entries = await fs.readdir(abs, { withFileTypes: true });
    const lines = entries
      .filter((e) => !HIDDEN_DIRS.has(e.name) && !SECRET.some((r) => r.test(e.name)))
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
      .slice(0, LIMITS.listEntries)
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    return lines.length > 0 ? lines.join('\n') : '(empty)';
  }

  async read(rel: string, start = 1, end?: number): Promise<string> {
    const p = this.clean(rel);
    const abs = await this.inside(p, true);
    const stat = await fs.stat(abs);
    if (!stat.isFile()) throw new SandboxError(`${p} is not a file.`);
    if (stat.size > LIMITS.maxFileBytes) throw new SandboxError(`${p} is too large to read (${stat.size} bytes).`);
    const text = await fs.readFile(abs, 'utf8');
    if (text.includes('\0')) throw new SandboxError(`${p} is a binary file.`);

    const lines = text.split('\n');
    if (text.length === 0 || (lines.length === 1 && lines[0] === '')) {
      return `${p} (empty file, 0 lines)`;
    }

    const numStart = typeof start === 'number' ? start : typeof start === 'string' && String(start).trim() !== '' ? Number(start) : NaN;
    if (isNaN(numStart) || !Number.isFinite(numStart)) {
      throw new SandboxError(`Invalid start line "${start}". Line numbers must be positive integers starting from 1.`);
    }
    const from = Math.floor(numStart);
    if (from < 1) {
      throw new SandboxError(`Invalid start line ${start}. Line numbers must be positive integers starting from 1.`);
    }

    let to: number;
    if (end !== undefined && end !== null) {
      const numEnd = typeof end === 'number' ? end : typeof end === 'string' && String(end).trim() !== '' ? Number(end) : NaN;
      if (isNaN(numEnd) || !Number.isFinite(numEnd)) {
        throw new SandboxError(`Invalid end line "${end}". Line numbers must be positive integers.`);
      }
      const rawEnd = Math.floor(numEnd);
      if (rawEnd < 1) {
        throw new SandboxError(`Invalid end line ${rawEnd}. Line numbers must be positive integers starting from 1.`);
      }
      if (from > rawEnd) {
        throw new SandboxError(
          `Invalid line range: start line (${from}) cannot be greater than end line (${rawEnd}). Read with start <= end (for example, start: ${Math.min(from, rawEnd)}, end: ${Math.min(lines.length, Math.max(from, rawEnd, Math.min(from, rawEnd) + 100))}). File ${p} has ${lines.length} lines.`,
        );
      }
      const requestedLines = rawEnd - from + 1;
      if (requestedLines > LIMITS.readLines) {
        throw new SandboxError(
          `Cannot read ${requestedLines} lines at once (maximum is ${LIMITS.readLines} lines). Read a smaller range (for example, start: ${from}, end: ${from + LIMITS.readLines - 1}).`,
        );
      }
      to = Math.min(lines.length, rawEnd);
    } else {
      to = Math.min(lines.length, from + LIMITS.readLines - 1);
    }

    if (from > lines.length) {
      throw new SandboxError(
        `Start line ${from} is beyond the end of ${p} (${lines.length} lines total). Read a valid range within 1 to ${lines.length} (for example, start: ${Math.max(1, lines.length - 100)}, end: ${lines.length}).`,
      );
    }

    if (from > to) {
      throw new SandboxError(
        `Empty read range: lines ${from}-${to} in ${p} (${lines.length} lines total). Read a valid range within 1 to ${lines.length}.`,
      );
    }

    const selectedLines = lines.slice(from - 1, to);
    if (selectedLines.length === 0) {
      throw new SandboxError(
        `Empty read range: no lines found in range ${from}-${to} for ${p} (${lines.length} lines total). Read a valid range within 1 to ${lines.length}.`,
      );
    }

    const out = selectedLines.map((l, i) => `${from + i}: ${l}`).join('\n');
    if (out.length > LIMITS.readChars) {
      throw new SandboxError(
        `Read output for ${p} (lines ${from}-${to}) is too large (${out.length} characters, limit is ${LIMITS.readChars}). Read a smaller range of 60-100 lines (for example, start: ${from}, end: ${from + Math.min(80, to - from)}) so file content reaches you without truncation.`,
      );
    }

    return `${p} (lines ${from}-${to} of ${lines.length})\n${out}`;
  }

  /** Case-insensitive plain-text search. Not a regular expression, so it cannot be made to hang. */
  async search(needle: string, under = ''): Promise<string> {
    if (typeof needle !== 'string' || needle.length < 2) throw new SandboxError('Search text must be at least 2 characters.');
    const start = under === '' || under === '.' ? '' : this.clean(under);
    const base = await this.inside(start, true);
    const q = needle.toLowerCase();
    const hits: string[] = [];
    let scanned = 0;

    const walk = async (dir: string): Promise<void> => {
      if (hits.length >= LIMITS.searchMatches || scanned >= LIMITS.searchFiles) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (hits.length >= LIMITS.searchMatches || scanned >= LIMITS.searchFiles) return;
        if (HIDDEN_DIRS.has(e.name) || SECRET.some((r) => r.test(e.name)) || e.isSymbolicLink()) continue;
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) {
          await walk(abs);
        } else if (e.isFile()) {
          const stat = await fs.stat(abs);
          if (stat.size > LIMITS.maxFileBytes) continue;
          scanned += 1;
          const text = await fs.readFile(abs, 'utf8').catch(() => '');
          if (text.includes('\0')) continue;
          const rel = path.relative(this.root, abs).split(path.sep).join('/');
          text.split('\n').forEach((line, i) => {
            if (hits.length < LIMITS.searchMatches && line.toLowerCase().includes(q)) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 160)}`);
          });
        }
      }
    };
    await walk(base);
    return hits.length > 0 ? hits.join('\n') : 'No matches.';
  }

  /** Replaces one exact piece of text. It must occur exactly once, so the change is unambiguous. */
  async edit(rel: string, oldText: string, newText: string): Promise<string> {
    const p = this.clean(rel);
    this.assertWritable(p);
    if (typeof oldText !== 'string' || oldText === '') throw new SandboxError('The text to replace is required.');
    if (typeof newText !== 'string') throw new SandboxError('The new text is required.');
    if (oldText === newText) throw new SandboxError('The replacement must change the file.');
    const abs = await this.inside(p, true);
    const text = await fs.readFile(abs, 'utf8');
    const first = text.indexOf(oldText);
    if (first === -1) throw new SandboxError(`That text was not found in ${p}. Read the file again and copy it exactly.`);
    if (text.indexOf(oldText, first + 1) !== -1) throw new SandboxError(`That text appears more than once in ${p}. Include more surrounding text so it is unique.`);
    const next = text.slice(0, first) + newText + text.slice(first + oldText.length);
    if (Buffer.byteLength(next) > LIMITS.maxWriteBytes * 2) throw new SandboxError('The file would become too large.');
    if (!this.originals.has(p)) this.originals.set(p, text);
    await fs.writeFile(abs, next, 'utf8');
    this.changed.add(p);
    return `Edited ${p}.`;
  }

  async create(rel: string, content: string): Promise<string> {
    const p = this.clean(rel);
    this.assertWritable(p);
    if (typeof content !== 'string') throw new SandboxError('Content is required.');
    if (Buffer.byteLength(content) > LIMITS.maxWriteBytes) throw new SandboxError('That file is too large.');
    const abs = await this.inside(p, false);
    const exists = await fs.lstat(abs).then(() => true, () => false);
    if (exists) throw new SandboxError(`${p} already exists. Use edit to change it.`);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    // Re-check after creating parents: the final location must still be inside.
    await this.inside(p, false);
    this.originals.set(p, null);
    await fs.writeFile(abs, content, 'utf8');
    this.changed.add(p);
    return `Created ${p}.`;
  }
}
