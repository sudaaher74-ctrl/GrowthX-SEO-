import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  resolveSafeCheckoutWriteTarget,
  validateContentDirectory,
  validateContentFilename,
  writeConfinedCheckoutFile,
} from './checkout-path';

describe('checkout-path content publishing confinement', () => {
  let checkoutRoot: string;
  let outsideRoot: string;

  beforeEach(async () => {
    checkoutRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-checkout-'));
    outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-outside-'));
  });

  afterEach(async () => {
    await fs.rm(checkoutRoot, { recursive: true, force: true });
    await fs.rm(outsideRoot, { recursive: true, force: true });
  });

  it('rejects parent traversal, absolute paths, hidden directories, and unsafe slugs', () => {
    for (const badDir of ['../outside', 'content/../../escape', '/etc/cron.d', 'C:\\Windows', '.git/hooks', '.github/workflows', 'content/\0bad']) {
      expect(() => validateContentDirectory(badDir)).toThrow(BadRequestException);
    }
    for (const badSlug of ['../escape', 'nested/file', 'a\\b', '.env', 'bad slug!', '']) {
      expect(() => validateContentFilename(badSlug)).toThrow(BadRequestException);
    }
    expect(validateContentDirectory('content/blog/')).toBe('content/blog');
    expect(validateContentFilename('seo-guide-2026')).toBe('seo-guide-2026.md');
  });

  it('allows creating missing nested directories safely inside the checkout', async () => {
    const target = await resolveSafeCheckoutWriteTarget(checkoutRoot, 'content/guides/new', 'seo-basics');
    await writeConfinedCheckoutFile(checkoutRoot, target, '# SEO Basics');
    const saved = await fs.readFile(path.join(checkoutRoot, 'content/guides/new/seo-basics.md'), 'utf8');
    expect(saved).toBe('# SEO Basics');
  });

  it('rejects symlinked parent directories and leaves the filesystem outside the checkout completely untouched', async () => {
    await fs.symlink(outsideRoot, path.join(checkoutRoot, 'blog-link'), process.platform === 'win32' ? 'junction' : 'dir');

    await expect(
      resolveSafeCheckoutWriteTarget(checkoutRoot, 'blog-link/nested', 'pwned-post'),
    ).rejects.toThrow(BadRequestException);

    // Nothing may have been created inside outsideRoot.
    expect(await fs.readdir(outsideRoot)).toEqual([]);
  });

  it('rejects a symlinked destination file pointing outside the checkout', async () => {
    const outsideTarget = path.join(outsideRoot, 'existing.md');
    await fs.writeFile(outsideTarget, 'ORIGINAL_OUTSIDE_CONTENT', 'utf8');
    await fs.mkdir(path.join(checkoutRoot, 'content'), { recursive: true });
    await fs.symlink(outsideTarget, path.join(checkoutRoot, 'content/victim.md'));

    await expect(
      resolveSafeCheckoutWriteTarget(checkoutRoot, 'content', 'victim'),
    ).rejects.toThrow(BadRequestException);

    expect(await fs.readFile(outsideTarget, 'utf8')).toBe('ORIGINAL_OUTSIDE_CONTENT');
  });
});
