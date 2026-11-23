import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

const FORBIDDEN_SEGMENTS = new Set([
  '.git',
  '.github',
  '.husky',
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  '.vercel',
  '.turbo',
  '.cache',
]);

const SAFE_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9-_]{0,160}$/;

/**
 * Validates and normalizes a repository-relative content directory path.
 * Rejects absolute paths, drive prefixes, traversal segments (`..`), NUL/control
 * bytes, and hidden/protected directories.
 */
export function validateContentDirectory(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') {
    throw new BadRequestException('Content directory must be a string.');
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/[\x00-\x1f\x7f]/.test(trimmed)) {
    throw new BadRequestException('Content directory contains invalid control characters.');
  }
  const normalizedSlashes = trimmed.replace(/\\/g, '/');
  if (
    normalizedSlashes.startsWith('/') ||
    normalizedSlashes.startsWith('//') ||
    /^[a-zA-Z]:/.test(normalizedSlashes) ||
    normalizedSlashes.startsWith('~')
  ) {
    throw new BadRequestException('Content directory must be a relative path inside the repository.');
  }

  const stripped = normalizedSlashes.replace(/^\.\//, '').replace(/\/+$/, '');
  if (!stripped) {
    throw new BadRequestException('Content directory cannot be empty.');
  }

  const rawSegments = stripped.split('/');
  const cleanSegments: string[] = [];
  for (const segment of rawSegments) {
    if (!segment || segment === '.' || segment === '..') {
      throw new BadRequestException('Content directory cannot contain parent traversal or empty path segments.');
    }
    if (segment.startsWith('.') || FORBIDDEN_SEGMENTS.has(segment.toLowerCase())) {
      throw new BadRequestException(`Content directory segment "${segment}" is not permitted.`);
    }
    if (!SAFE_SEGMENT_RE.test(segment)) {
      throw new BadRequestException(`Content directory segment "${segment}" contains disallowed characters.`);
    }
    cleanSegments.push(segment);
  }

  return cleanSegments.join('/');
}

/**
 * Validates a content piece slug and produces a safe Markdown filename confined
 * to a single directory entry (never allowing separators, traversal, or dotfiles).
 */
export function validateContentFilename(rawSlug: string): string {
  if (typeof rawSlug !== 'string') {
    throw new BadRequestException('Content slug is required.');
  }
  const slug = rawSlug.trim().toLowerCase();
  if (!slug || /[\x00-\x1f\x7f]/.test(slug)) {
    throw new BadRequestException('Content slug is invalid.');
  }
  if (slug.includes('/') || slug.includes('\\') || slug.includes('..') || slug.startsWith('.')) {
    throw new BadRequestException(`Content slug "${rawSlug}" cannot contain path separators or traversal.`);
  }
  if (!SAFE_SLUG_RE.test(slug)) {
    throw new BadRequestException(
      `Content slug "${rawSlug}" may only contain lowercase letters, numbers, hyphens, and underscores.`,
    );
  }
  return `${slug}.md`;
}

export interface SafeCheckoutTarget {
  contentDir: string;
  filename: string;
  relativePath: string;
  directoryPath: string;
  absolutePath: string;
}

/**
 * Validates `contentDir`, `slug`, every existing parent directory, and the target
 * destination against the checkout's canonical real root BEFORE creating any
 * directories or writing any file. Rejects symlinks anywhere along the path and
 * guarantees no path outside `checkoutRoot` is ever touched.
 */
export async function resolveSafeCheckoutWriteTarget(
  checkoutRoot: string,
  rawContentDir: string | null | undefined,
  rawSlug: string,
): Promise<SafeCheckoutTarget> {
  const contentDir = validateContentDirectory(rawContentDir);
  if (!contentDir) {
    throw new BadRequestException('A valid repository-relative content directory is required.');
  }
  const filename = validateContentFilename(rawSlug);
  const realRoot = await fs.realpath(checkoutRoot);

  const dirSegments = contentDir.split('/');
  let cursor = realRoot;

  for (const segment of dirSegments) {
    cursor = path.join(cursor, segment);
    if (!cursor.startsWith(realRoot + path.sep)) {
      throw new BadRequestException('Content directory resolves outside the repository checkout.');
    }
    try {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink()) {
        throw new BadRequestException(`Content directory "${contentDir}" traverses a symlink, which is not permitted.`);
      }
      if (!stat.isDirectory()) {
        throw new BadRequestException(`Content directory "${contentDir}" conflicts with an existing file.`);
      }
      const realCursor = await fs.realpath(cursor);
      if (realCursor !== realRoot && !realCursor.startsWith(realRoot + path.sep)) {
        throw new BadRequestException('Content directory resolves outside the repository checkout.');
      }
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      if (error?.code === 'ENOENT') {
        // Remaining subdirectories do not exist yet; their segment names were already validated.
        break;
      }
      throw error;
    }
  }

  const directoryPath = path.resolve(realRoot, ...dirSegments);
  const absolutePath = path.resolve(directoryPath, filename);
  if (
    !directoryPath.startsWith(realRoot + path.sep) ||
    !absolutePath.startsWith(directoryPath + path.sep) ||
    !absolutePath.startsWith(realRoot + path.sep)
  ) {
    throw new BadRequestException('Content destination resolves outside the repository checkout.');
  }

  // If the destination file already exists, refuse symlinks or directories.
  try {
    const targetStat = await fs.lstat(absolutePath);
    if (targetStat.isSymbolicLink()) {
      throw new BadRequestException(`Content destination "${contentDir}/${filename}" is a symlink and cannot be overwritten.`);
    }
    if (targetStat.isDirectory()) {
      throw new BadRequestException(`Content destination "${contentDir}/${filename}" is a directory.`);
    }
    const realTarget = await fs.realpath(absolutePath);
    if (!realTarget.startsWith(realRoot + path.sep)) {
      throw new BadRequestException('Content destination resolves outside the repository checkout.');
    }
  } catch (error: any) {
    if (error instanceof BadRequestException) throw error;
    if (error?.code !== 'ENOENT') throw error;
  }

  return {
    contentDir,
    filename,
    relativePath: `${contentDir}/${filename}`,
    directoryPath,
    absolutePath,
  };
}

/**
 * Re-verifies containment immediately after `mkdir` and before writing bytes.
 */
export async function writeConfinedCheckoutFile(
  checkoutRoot: string,
  target: SafeCheckoutTarget,
  content: string,
): Promise<void> {
  const realRoot = await fs.realpath(checkoutRoot);
  await fs.mkdir(target.directoryPath, { recursive: true });

  const realDir = await fs.realpath(target.directoryPath);
  if (realDir !== realRoot && !realDir.startsWith(realRoot + path.sep)) {
    throw new BadRequestException('Resolved content directory escaped the repository checkout.');
  }

  const finalPath = path.join(realDir, target.filename);
  if (!finalPath.startsWith(realRoot + path.sep)) {
    throw new BadRequestException('Resolved content file escaped the repository checkout.');
  }

  try {
    const stat = await fs.lstat(finalPath);
    if (stat.isSymbolicLink()) {
      throw new BadRequestException('Refusing to write content through a symlink.');
    }
  } catch (error: any) {
    if (error instanceof BadRequestException) throw error;
    if (error?.code !== 'ENOENT') throw error;
  }

  await fs.writeFile(finalPath, content, 'utf8');
}
