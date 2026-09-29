import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { LIMITS, RepoSandbox, SandboxError } from './engineer-sandbox';

describe('RepoSandbox', () => {
  let root: string;
  let outside: string;
  let box: RepoSandbox;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'sbx-root-'));
    outside = await fs.mkdtemp(path.join(os.tmpdir(), 'sbx-out-'));
    await fs.writeFile(path.join(outside, 'notes.txt'), 'private');
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'src/page.tsx'), 'line one\nline two\nline three\n');
    await fs.writeFile(path.join(root, 'package.json'), '{}');
    await fs.writeFile(path.join(root, '.env'), 'KEY=1');
    await fs.mkdir(path.join(root, '.github/workflows'), { recursive: true });
    await fs.writeFile(path.join(root, '.github/workflows/ci.yml'), 'on: push');
    box = new RepoSandbox(root);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });

  it('lists and reads files with line numbers', async () => {
    expect(await box.list('')).toContain('src/');
    expect(await box.read('src/page.tsx', 2, 2)).toContain('2: line two');
  });

  it('never leaves the repository, however the path is written', async () => {
    for (const p of ['../x', 'src/../../x', `${outside}/notes.txt`.replace(/^\//, ''), '..\\x']) {
      await expect(box.read(p)).rejects.toThrow(SandboxError);
    }
  });

  it('does not follow a symlink out of the repository', async () => {
    await fs.symlink(outside, path.join(root, 'link'));
    await expect(box.read('link/notes.txt')).rejects.toThrow(/leave the repository/);
    await expect(box.create('link/new.txt', 'x')).rejects.toThrow(/leave the repository/);
    await expect(fs.readFile(path.join(outside, 'new.txt'))).rejects.toThrow();
  });

  it('cannot read or list secrets, or dependency and git folders', async () => {
    await expect(box.read('.env')).rejects.toThrow(/secrets/);
    expect(await box.list('')).not.toContain('.env');
    await expect(box.read('.git/config')).rejects.toThrow(/not available/);
    await expect(box.list('node_modules')).rejects.toThrow(/not available/);
  });

  it('reads package.json and CI files but cannot change them', async () => {
    expect(await box.read('package.json')).toContain('{}');
    await expect(box.edit('package.json', '{}', '{"scripts":{"postinstall":"x"}}')).rejects.toThrow(/cannot be changed/);
    await expect(box.create('.github/workflows/new.yml', 'x')).rejects.toThrow(/cannot be changed/);
    await expect(box.edit('.github/workflows/ci.yml', 'push', 'pull_request')).rejects.toThrow(/cannot be changed/);
    expect(await fs.readFile(path.join(root, 'package.json'), 'utf8')).toBe('{}');
  });

  it('edits exactly one occurrence, and tracks what changed', async () => {
    expect(await box.edit('src/page.tsx', 'line two', 'LINE 2')).toContain('Edited');
    expect(await fs.readFile(path.join(root, 'src/page.tsx'), 'utf8')).toContain('LINE 2');
    expect([...box.changed]).toEqual(['src/page.tsx']);
    await expect(box.edit('src/page.tsx', 'missing', 'x')).rejects.toThrow(/not found/);
    await fs.writeFile(path.join(root, 'src/dup.tsx'), 'a\na\n');
    await expect(box.edit('src/dup.tsx', 'a', 'b')).rejects.toThrow(/more than once/);
  });

  it('creates new files under the repository, but never overwrites', async () => {
    await box.create('content/blog/new.md', '# Hello');
    expect(await fs.readFile(path.join(root, 'content/blog/new.md'), 'utf8')).toBe('# Hello');
    await expect(box.create('src/page.tsx', 'x')).rejects.toThrow(/already exists/);
  });

  it('caps how many files one run may change', async () => {
    for (let i = 0; i < LIMITS.maxChangedFiles; i++) await box.create(`gen/f${i}.txt`, 'x');
    await expect(box.create('gen/extra.txt', 'x')).rejects.toThrow(/No more than/);
  });

  it('searches plain text (not a pattern), skipping secrets and hidden folders', async () => {
    await fs.writeFile(path.join(root, '.env'), 'line two secret');
    const out = await box.search('LINE TWO');
    expect(out).toContain('src/page.tsx:2');
    expect(out).not.toContain('.env');
    expect(await box.search('(a+)+$')).toBe('No matches.');
  });
});
