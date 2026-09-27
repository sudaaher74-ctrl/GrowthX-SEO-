import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StorageService } from './storage.service';

/**
 * Snapshot deletion takes a locator read from the database, so it must only
 * ever remove files inside the snapshot directory, whatever the locator says.
 */
describe('StorageService — deleting snapshots', () => {
  let dir: string;
  let outside: string;
  let storage: StorageService;
  const previous = process.env.LOCAL_STORAGE_PATH;

  beforeEach(() => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshots-'));
    dir = path.join(root, 'snapshots');
    fs.mkdirSync(dir);
    outside = path.join(root, 'outside.html');
    fs.writeFileSync(outside, 'not a snapshot');
    process.env.LOCAL_STORAGE_PATH = dir;
    storage = new StorageService();
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.LOCAL_STORAGE_PATH;
    else process.env.LOCAL_STORAGE_PATH = previous;
  });

  const write = (name: string) => {
    fs.writeFileSync(path.join(dir, name), '<html></html>');
    return `file://${path.join(dir, name)}`;
  };

  it('deletes a snapshot inside the snapshot directory', async () => {
    const locator = write('job1_page_1.html');

    await expect(storage.deleteSnapshot(locator)).resolves.toBe(true);
    expect(fs.existsSync(locator.slice('file://'.length))).toBe(false);
  });

  it('refuses a locator that points outside the snapshot directory', async () => {
    await expect(storage.deleteSnapshot(`file://${outside}`)).resolves.toBe(false);
    await expect(storage.deleteSnapshot(`file://${dir}/../outside.html`)).resolves.toBe(false);
    expect(fs.existsSync(outside)).toBe(true);
  });

  it('treats an already missing file as nothing to do', async () => {
    await expect(storage.deleteSnapshot(`file://${path.join(dir, 'gone.html')}`)).resolves.toBe(false);
  });

  it('removes every file of the given crawls, retries included, except those kept', async () => {
    write('job1_pageA_100.html');
    write('job1_pageA_200.html'); // a retry of the same page
    const kept = write('job1_pageB_100.html');
    write('job2_pageA_100.html');
    write('job10_pageA_100.html'); // prefix "job1" must not match "job10"

    const removed = await storage.deleteSnapshotsForJobs(['job1'], new Set([kept]));

    expect(removed).toBe(2);
    expect(fs.readdirSync(dir).sort()).toEqual(['job10_pageA_100.html', 'job1_pageB_100.html', 'job2_pageA_100.html']);
  });

  it('does nothing when there is no snapshot directory', async () => {
    fs.rmSync(dir, { recursive: true });

    await expect(storage.deleteSnapshotsForJobs(['job1'])).resolves.toBe(0);
  });
});
