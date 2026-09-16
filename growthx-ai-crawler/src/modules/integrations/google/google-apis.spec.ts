import * as fs from 'fs';
import * as path from 'path';
import { google } from './google-apis';

/**
 * The aggregate `googleapis` import costs 69MB of heap and 112MB of RSS at
 * require time, against 6.5MB and 26MB for the APIs this product calls. On a
 * 512MB instance that difference decides whether a browser can be launched
 * beside the app, so it is worth a test rather than a comment someone edits
 * away.
 */
describe('google-apis', () => {
  const SRC = path.join(__dirname, '..', '..', '..');

  function sourceFiles(dir: string, found: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) sourceFiles(full, found);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) found.push(full);
    }
    return found;
  }

  it('is the only module importing googleapis in aggregate', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => path.basename(file) !== 'google-apis.ts')
      .filter((file) => /from ['"]googleapis['"]|require\(['"]googleapis['"]\)/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC, file));

    expect(offenders).toEqual([]);
  });

  it('exposes every Google client the services call', () => {
    // Adding an API means adding it here; that is the point of the file.
    expect(Object.keys(google).sort()).toEqual(
      [
        'analyticsadmin',
        'analyticsdata',
        'auth',
        'businessprofileperformance',
        'mybusinessaccountmanagement',
        'mybusinessbusinessinformation',
        'searchconsole',
        'youtube',
      ].sort(),
    );
  });

  /**
   * googleapis-common carries a nested copy of google-auth-library, so an
   * OAuth2Client built from the top-level package is a distinct type that
   * every client here rejects. Taking `auth` from a googleapis API module is
   * what keeps the two identical.
   */
  it('builds an OAuth2 client the API clients accept', () => {
    const client = new google.auth.OAuth2('id', 'secret', 'https://example.test/callback');

    expect(() => google.searchconsole({ version: 'v1', auth: client })).not.toThrow();
    expect(() => google.analyticsdata({ version: 'v1beta', auth: client })).not.toThrow();
  });
});
