import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider = process.env.STORAGE_PROVIDER || 'local';
  private readonly localPath = process.env.LOCAL_STORAGE_PATH || './storage/snapshots';

  constructor() {
    if (this.provider === 'local') {
      try {
        if (!fs.existsSync(this.localPath)) {
          fs.mkdirSync(this.localPath, { recursive: true });
        }
      } catch (err) {
        this.logger.warn(`Could not create local storage dir ${this.localPath}`, err);
      }
    }
  }

  async saveSnapshot(jobId: string, pageId: string, content: string | Buffer, extension: string = 'html'): Promise<string> {
    const filename = `${jobId}_${pageId}_${Date.now()}.${extension}`;
    
    if (this.provider === 's3' && process.env.AWS_S3_BUCKET) {
      // In a real S3 deployment, we would use S3Client from @aws-sdk/client-s3
      this.logger.log(`Uploading ${filename} to AWS S3 bucket ${process.env.AWS_S3_BUCKET}`);
      return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/snapshots/${filename}`;
    }

    // Default local filesystem storage
    const targetPath = path.resolve(this.localPath, filename);
    try {
      await fs.promises.writeFile(targetPath, content);
      return `file://${targetPath}`;
    } catch (error) {
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
