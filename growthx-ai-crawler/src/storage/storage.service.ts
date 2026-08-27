import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null ? (error as NodeJS.ErrnoException).code : undefined;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider = process.env.STORAGE_PROVIDER || 'local';

  /**
   * Resolved once, at construction.
   *
   * The configured value is relative by default, so it was previously resolved
   * against the working directory at each call — meaning the directory that got
   * created and the directory that got written to could differ if anything
   * changed the cwd.
   */
  private readonly localPath = path.resolve(process.env.LOCAL_STORAGE_PATH || './storage/snapshots');

  /** Whether the snapshot directory is known to exist and be writable. */
  private directoryReady = false;

  async onModuleInit(): Promise<void> {
    if (this.provider === 'local') {
      // Surfaced once at boot so a misconfigured volume is visible in the
      // deploy log rather than only in the first crawl that tries to use it.
      await this.ensureDirectory();
    }
  }

  /**
   * Makes the snapshot directory exist, or explains why it cannot.
   *
   * The previous version did this once in the constructor and swallowed any
   * failure as a warning. On a container whose /app is root-owned while the
   * process runs as `node`, that mkdir fails with EACCES — and every write
   * afterwards fails with ENOENT against a directory that was never created,
   * which reads as a missing-directory bug rather than a permissions one.
   *
   * Retried on each failure rather than latched, so a directory that becomes
   * writable later — a volume mounted late, permissions corrected — recovers
   * without a restart. A success is remembered, so the common path is a single
   * boolean rather than a syscall per page.
   */
  private async ensureDirectory(): Promise<boolean> {
    if (this.directoryReady) return true;

    try {
      await fs.promises.mkdir(this.localPath, { recursive: true });
      this.directoryReady = true;
      return true;
    } catch (error) {
      const code = errorCode(error);
      this.directoryReady = false;
      this.logger.error(
        `Cannot create the snapshot directory ${this.localPath} (${code ?? 'unknown error'}). ` +
          (code === 'EACCES' || code === 'EPERM'
            ? 'The process does not own that path — create it in the image with the right owner, or point ' +
              'LOCAL_STORAGE_PATH somewhere writable. '
            : '') +
          'Snapshots will not be stored; the crawl itself continues.',
      );
      return false;
    }
  }

  /**
   * Stores one page snapshot and returns a locator for it.
   *
   * Never throws. A snapshot is a diagnostic artifact, not the crawl's output —
   * the page, its issues and its metrics are already persisted by the caller —
   * so a storage failure is reported and represented in the return value rather
   * than being allowed to abort a crawl mid-run.
   */
  async saveSnapshot(
    jobId: string,
    pageId: string,
    content: string | Buffer,
    extension: string = 'html',
  ): Promise<string> {
    const filename = `${jobId}_${pageId}_${Date.now()}.${extension}`;

    if (this.provider === 's3' && process.env.AWS_S3_BUCKET) {
      // In a real S3 deployment, we would use S3Client from @aws-sdk/client-s3
      this.logger.log(`Uploading ${filename} to AWS S3 bucket ${process.env.AWS_S3_BUCKET}`);
      return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/snapshots/${filename}`;
    }

    if (!(await this.ensureDirectory())) {
      return `error://storage-unavailable/${filename}`;
    }

    const targetPath = path.join(this.localPath, filename);

    try {
      await fs.promises.writeFile(targetPath, content);
      return `file://${targetPath}`;
    } catch (error) {
      // ENOENT after a successful mkdir means the directory went away between
      // the two — a cleaned tmpfs, an unmounted volume. Rebuild it and retry
      // once; anything still failing is reported rather than retried further.
      if (errorCode(error) === 'ENOENT') {
        this.directoryReady = false;
        if (await this.ensureDirectory()) {
          try {
            await fs.promises.writeFile(targetPath, content);
            this.logger.warn(`Recreated ${this.localPath}, which had gone missing, and stored ${filename}.`);
            return `file://${targetPath}`;
          } catch (retryError) {
            this.logger.error(`Failed to write snapshot at ${targetPath} after recreating the directory`, retryError);
            return `error://storage-failure/${filename}`;
          }
        }
      }

      this.logger.error(`Failed to write snapshot locally at ${targetPath}`, error);
      return `error://storage-failure/${filename}`;
    }
  }

  async readSnapshot(fileUrl: string): Promise<string | null> {
    if (fileUrl.startsWith('file://')) {
      const filePath = fileUrl.replace('file://', '');
      try {
        return await fs.promises.readFile(filePath, 'utf-8');
      } catch (err) {
        this.logger.error(`Failed to read local snapshot from ${filePath}`, err);
        return null;
      }
    }
    return null;
  }
}
