import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ValidationResult {
  success: boolean;
  output: string;
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  /**
   * Runs the validation step (e.g. npm run build or tsc) in the target repo.
   */
  async validateRepository(repoDir: string, packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun'): Promise<ValidationResult> {
    this.logger.log(`Starting validation for repository at ${repoDir}...`);
    
    try {
      // 1. Install dependencies (Requires a sandbox in production)
      this.logger.log(`Running ${packageManager} install...`);
      await execAsync(`${packageManager} install`, { cwd: repoDir, timeout: 120000 });

      // 2. Run build
      this.logger.log(`Running ${packageManager} run build...`);
      const { stdout, stderr } = await execAsync(`${packageManager} run build`, { cwd: repoDir, timeout: 180000 });
      
      this.logger.log(`Validation successful.`);
      return { success: true, output: stdout };
    } catch (error) {
      this.logger.error(`Validation failed: ${error.message}`);
      return { success: false, output: error.stdout || error.message };
    }
  }
}

