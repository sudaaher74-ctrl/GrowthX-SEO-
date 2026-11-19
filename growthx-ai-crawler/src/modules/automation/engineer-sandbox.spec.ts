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

  it('searches one file with line numbers and preserves search limits', async () => {
    expect(await box.search('LINE TWO', 'src/page.tsx')).toBe('src/page.tsx:2: line two');
    expect(await box.search('absent', 'src/page.tsx')).toBe('No matches.');
    await fs.writeFile(path.join(root, 'src/many.tsx'), 'match\r\n'.repeat(100));
    expect((await box.search('match', 'src/many.tsx')).split('\n')).toHaveLength(LIMITS.searchMatches);
    await fs.writeFile(path.join(root, 'src/binary.txt'), 'match\0');
    expect(await box.search('match', 'src/binary.txt')).toBe('No matches.');
    await fs.writeFile(path.join(root, 'src/large.txt'), 'match'.repeat(LIMITS.maxFileBytes));
    expect(await box.search('match', 'src/large.txt')).toBe('No matches.');
    await expect(box.search('KEY', '.env')).rejects.toThrow(SandboxError);
    await expect(box.search('private', '../notes.txt')).rejects.toThrow(SandboxError);
  });

  it('keeps a file passed to list recoverable', async () => {
    await expect(box.list('src/page.tsx')).rejects.toThrow(SandboxError);
    expect(await box.read('src/page.tsx', 1, 1)).toContain('line one');
  });

  it('replaces freshly read JSX lines without copying the old Unicode source', async () => {
    const file = path.join(root, 'src/content.jsx');
    await fs.writeFile(file, '<section>\r\n  <p>₹100 • You haven\'t ordered.</p>\r\n</section>\r\n');
    await box.read('src/content.jsx', 1, 3);
    await box.replaceLines('src/content.jsx', 2, 2, '  <p>Read our delivery information.</p>');
    expect(await fs.readFile(file, 'utf8')).toBe('<section>\r\n  <p>Read our delivery information.</p>\r\n</section>\r\n');
    expect(box.lastRangeEdits.get('src/content.jsx')?.before).toContain('₹100 •');
    expect(box.originals.get('src/content.jsx')).toContain("haven't");
    await expect(box.replaceLines('src/content.jsx', 2, 2, 'another')).rejects.toThrow(/Read the target lines/);
  });

  it('refuses line replacement outside the observed range or after an external change', async () => {
    await expect(box.replaceLines('src/page.tsx', 1, 1, 'new')).rejects.toThrow(SandboxError);
    await box.read('src/page.tsx', 2, 2);
    await expect(box.replaceLines('src/page.tsx', 1, 2, 'new')).rejects.toThrow(/within the last successful read/);
    await fs.writeFile(path.join(root, 'src/page.tsx'), 'changed externally');
    await expect(box.replaceLines('src/page.tsx', 2, 2, 'new')).rejects.toThrow(/changed after it was read/);
    expect(await fs.readFile(path.join(root, 'src/page.tsx'), 'utf8')).toBe('changed externally');
  });

  it('invalidates a line read after an exact edit and enforces file protections', async () => {
    await box.read('src/page.tsx', 1, 3);
    await box.edit('src/page.tsx', 'line one', 'LINE ONE');
    await expect(box.replaceLines('src/page.tsx', 2, 2, 'new')).rejects.toThrow(/Read the target lines/);
    await box.read('package.json', 1, 1);
    await expect(box.replaceLines('package.json', 1, 1, '{"scripts":{}}')).rejects.toThrow(/cannot be changed/);
    await expect(box.replaceLines('.env', 1, 1, 'secret')).rejects.toThrow(/secrets/);
    await expect(box.replaceLines('../outside', 1, 1, 'unsafe')).rejects.toThrow(/leave the repository/);
  });

  it('caps line replacements and rejects no-ops', async () => {
    await box.read('src/page.tsx', 1, 3);
    await expect(box.replaceLines('src/page.tsx', 1, 1, 'x'.repeat(LIMITS.maxWriteBytes + 1))).rejects.toThrow(/write-size limit/);
    await expect(box.replaceLines('src/page.tsx', 1, 1, 'line one')).rejects.toThrow(/must change/);
    await expect(box.replaceLines('src/page.tsx', 1.5, 2, 'new')).rejects.toThrow(/within the last successful read/);
  });

  it('never leaves the repository, however the path is written', async () => {
    for (const p of ['../x', 'src/../../x', `${outside}/notes.txt`.replace(/^\//, ''), '..\\x']) {
      await expect(box.read(p)).rejects.toThrow(SandboxError);
    }
  });

  it('does not follow a symlink out of the repository', async () => {
    await fs.symlink(outside, path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
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

  it('edits text copied with read-tool line number prefixes', async () => {
    await expect(box.edit('src/page.tsx', '2: line two\n3: line three', 'LINE TWO\nline three')).resolves.toContain('Edited');
    expect(await fs.readFile(path.join(root, 'src/page.tsx'), 'utf8')).toBe('line one\nLINE TWO\nline three\n');
  });

  it('reads and edits CRLF files using logical lines while preserving their line endings', async () => {
    const file = path.join(root, 'src/windows-page.tsx');
    await fs.writeFile(file, 'first line\r\nsecond line\r\nthird line\r\n');

    expect(await box.read('src/windows-page.tsx', 1, 3)).toContain('2: second line\n');
    expect(await box.read('src/windows-page.tsx', 1, 3)).not.toContain('\r');

    await box.edit('src/windows-page.tsx', 'second line\nthird line', 'updated line\nthird line');
    expect(await fs.readFile(file, 'utf8')).toBe('first line\r\nupdated line\r\nthird line\r\n');
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

  it('rejects invalid read range when start > end with recovery guidance', async () => {
    await expect(box.read('src/page.tsx', 300, 120)).rejects.toThrow(
      /Invalid line range: start line \(300\) cannot be greater than end line \(120\)/,
    );
  });

  it('rejects start line beyond file length with recovery guidance', async () => {
    await expect(box.read('src/page.tsx', 50)).rejects.toThrow(
      /Start line 50 is beyond the end of src\/page\.tsx \(\d+ lines total\)/,
    );
  });

  it('rejects non-positive start or end line numbers', async () => {
    await expect(box.read('src/page.tsx', 0)).rejects.toThrow(/positive integers/);
    await expect(box.read('src/page.tsx', 1, 0)).rejects.toThrow(/positive integers/);
    await expect(box.read('src/page.tsx', -5)).rejects.toThrow(/positive integers/);
  });

  it('rejects reading more than LIMITS.readLines at once with guidance', async () => {
    await expect(box.read('src/page.tsx', 1, 1 + LIMITS.readLines + 10)).rejects.toThrow(
      /Cannot read \d+ lines at once/,
    );
  });

  it('handles empty files gracefully', async () => {
    await fs.writeFile(path.join(root, 'src/empty.txt'), '');
    expect(await box.read('src/empty.txt')).toContain('empty file, 0 lines');
  });

  it('rejects read when output exceeds LIMITS.readChars instead of silent truncation', async () => {
    const longLine = 'a'.repeat(500) + '\n';
    await fs.writeFile(path.join(root, 'src/huge.txt'), longLine.repeat(50));
    await expect(box.read('src/huge.txt', 1, 50)).rejects.toThrow(
      /too large.*limit is \d+.*Read a smaller range/,
    );
  });
});
