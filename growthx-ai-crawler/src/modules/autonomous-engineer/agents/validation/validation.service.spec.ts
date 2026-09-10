import { Test, TestingModule } from '@nestjs/testing';
import { ValidationService } from './validation.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ValidationService', () => {
  let service: ValidationService;
  let tempDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationService],
    }).compile();

    service = module.get<ValidationService>(ValidationService);
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'growthx-val-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('passes syntax validation on clean JSX/TSX files and skips build when no package.json exists', async () => {
    const pageFile = path.join(tempDir, 'page.tsx');
    await fs.writeFile(
      pageFile,
      'export default function Page() { return <div><h1>Valid Title</h1></div>; }',
      'utf8',
    );

    const result = await service.validateRepository(tempDir, 'npm', ['page.tsx']);
    expect(result.success).toBe(true);
    expect(result.output).toContain('non-Node repository');
  });

  it('fails syntax validation on malformed JSX with unclosed tags before attempting any build', async () => {
    const pageFile = path.join(tempDir, 'page.tsx');
    await fs.writeFile(
      pageFile,
      'export default function Page() { return <div><h1>Unclosed Header</div>; }',
      'utf8',
    );

    const result = await service.validateRepository(tempDir, 'npm', ['page.tsx']);
    expect(result.success).toBe(false);
    expect(result.output).toContain('Syntax error in generated fix');
    expect(result.output).toContain('h1');
  });

  it('fails syntax validation on invalid JSON files', async () => {
    const jsonFile = path.join(tempDir, 'schema.json');
    await fs.writeFile(jsonFile, '{ "invalid": [unclosed }', 'utf8');

    const result = await service.validateRepository(tempDir, 'npm', ['schema.json']);
    expect(result.success).toBe(false);
    expect(result.output).toContain('Invalid JSON');
  });

  it('passes when package.json has no build script', async () => {
    const pkgPath = path.join(tempDir, 'package.json');
    await fs.writeFile(pkgPath, JSON.stringify({ name: 'test-site', scripts: { test: 'jest' } }), 'utf8');

    const pageFile = path.join(tempDir, 'index.js');
    await fs.writeFile(pageFile, 'console.log("hello");', 'utf8');

    const result = await service.validateRepository(tempDir, 'npm', ['index.js']);
    expect(result.success).toBe(true);
    expect(result.output).toContain('no build script in package.json');
  });

  it('allows PR to proceed when dependency install fails in runner sandbox but file syntax is verified valid', async () => {
    const pkgPath = path.join(tempDir, 'package.json');
    await fs.writeFile(pkgPath, JSON.stringify({ name: 'test-site', scripts: { build: 'next build' } }), 'utf8');

    const pageFile = path.join(tempDir, 'page.tsx');
    await fs.writeFile(pageFile, 'export default function Page() { return <div>Ok</div>; }', 'utf8');

    // Spy on attemptBuild to simulate dependency install failure
    jest.spyOn(service as any, 'attemptBuild').mockResolvedValueOnce({
      success: true,
      output: 'Syntax verified. Full build skipped: dependencies could not be installed in runner sandbox (npm notice This endpoint is being retired). Changes will be verified by repository CI.',
    });

    const result = await service.validateRepository(tempDir, 'npm', ['page.tsx']);
    expect(result.success).toBe(true);
    expect(result.output).toContain('Syntax verified');
    expect(result.output).toContain('Full build skipped');
  });

  it('blocks PR when build fails specifically due to the modified file', async () => {
    const pkgPath = path.join(tempDir, 'package.json');
    await fs.writeFile(pkgPath, JSON.stringify({ name: 'test-site', scripts: { build: 'next build' } }), 'utf8');

    const pageFile = path.join(tempDir, 'page.tsx');
    await fs.writeFile(pageFile, 'export default function Page() { return <div>Ok</div>; }', 'utf8');

    jest.spyOn(service as any, 'attemptBuild').mockResolvedValueOnce({
      success: false,
      output: 'Build error caused by modified file: Type error in page.tsx: Cannot find name foo',
    });

    const result = await service.validateRepository(tempDir, 'npm', ['page.tsx']);
    expect(result.success).toBe(false);
    expect(result.output).toContain('Build error caused by modified file');
  });
});
