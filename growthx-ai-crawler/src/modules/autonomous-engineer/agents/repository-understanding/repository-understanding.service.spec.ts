import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { RepositoryUnderstandingService } from './repository-understanding.service';

describe('RepositoryUnderstandingService', () => {
  let service: RepositoryUnderstandingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RepositoryUnderstandingService],
    }).compile();

    service = module.get<RepositoryUnderstandingService>(RepositoryUnderstandingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('detects nested frontend frameworks in multi-folder repositories', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-understand-'));
    try {
      await fs.mkdir(path.join(dir, 'backend'));
      await fs.writeFile(path.join(dir, 'backend/package.json'), JSON.stringify({ dependencies: { express: '^4.0.0' } }));
      await fs.mkdir(path.join(dir, 'frontend-react'));
      await fs.writeFile(path.join(dir, 'frontend-react/package.json'), JSON.stringify({ dependencies: { react: '^19.0.0' } }));
      const ctx = await service.analyzeRepository(dir);
      expect(ctx.framework).toBe('React');
      expect(ctx.appRoot).toBe('frontend-react');
      expect(ctx.isMonorepo).toBe(true);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
