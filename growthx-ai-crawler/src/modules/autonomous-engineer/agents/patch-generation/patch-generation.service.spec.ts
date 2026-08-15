import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { PatchGenerationService } from './patch-generation.service';

describe('PatchGenerationService', () => {
  let service: PatchGenerationService;
  let dir: string;

  beforeEach(async () => {
    service = new PatchGenerationService({} as any);
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'growthx-patch-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function write(name: string, content: string): Promise<string> {
    const filePath = path.join(dir, name);
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  const read = (filePath: string) => fs.readFile(filePath, 'utf8');

  const PAGE = `<!DOCTYPE html>
<html>
<head><title>Old title</title></head>
<body><h1>Hello</h1><img src="/a.png"><img src="/b.png" alt="Existing description"></body>
</html>`;

  describe('target detection', () => {
    it.each([
      ['page.html', 'html'],
      ['index.htm', 'html'],
      ['layout.tsx', 'nextjs-metadata'],
      ['page.ts', 'nextjs-metadata'],
    ])('routes %s to the %s patcher', (file, expected) => {
      expect(service.detectTarget(file)).toBe(expected);
    });
  });

  describe('HTML title', () => {
    it('replaces an existing title', async () => {
      const file = await write('a.html', PAGE);
      await service.setHtmlTitle(file, 'Insulated Jackets | acme.com');
      expect(await read(file)).toContain('<title>Insulated Jackets | acme.com</title>');
    });

    it('adds a title when the document has none', async () => {
      const file = await write('a.html', '<html><head></head><body></body></html>');
      await service.setHtmlTitle(file, 'New');
      expect(await read(file)).toContain('<title>New</title>');
    });

    it('creates a head when the document has none', async () => {
      const file = await write('a.html', '<html><body><p>x</p></body></html>');
      await service.setHtmlTitle(file, 'New');
      const html = await read(file);
      expect(html).toContain('<head>');
      expect(html).toContain('<title>New</title>');
    });

    it('collapses duplicate titles to one', async () => {
      const file = await write('a.html', '<html><head><title>A</title><title>B</title></head></html>');
      await service.setHtmlTitle(file, 'C');
      expect((await read(file)).match(/<title>/g)).toHaveLength(1);
    });
  });

  describe('meta description', () => {
    it('adds one when missing', async () => {
      const file = await write('a.html', PAGE);
      await service.setMetaTag(file, 'description', 'A short summary.');
      expect(await read(file)).toContain('<meta name="description" content="A short summary."');
    });

    it('updates an existing one rather than duplicating', async () => {
      const file = await write('a.html', '<html><head><meta name="description" content="Old"></head></html>');
      await service.setMetaTag(file, 'description', 'New');
      const html = await read(file);
      expect(html).toContain('content="New"');
      expect(html).not.toContain('content="Old"');
      expect(html.match(/name="description"/g)).toHaveLength(1);
    });

    it('escapes quotes so the attribute cannot be broken out of', async () => {
      const file = await write('a.html', PAGE);
      await service.setMetaTag(file, 'description', 'He said "hi"');
      const html = await read(file);
      expect(html).not.toContain('content="He said "hi""');
      expect(html).toContain('&quot;');
    });
  });

  describe('canonical', () => {
    it('adds a canonical link', async () => {
      const file = await write('a.html', PAGE);
      await service.setCanonical(file, 'https://acme.com/guides');
      expect(await read(file)).toContain('<link rel="canonical" href="https://acme.com/guides"');
    });

    it('replaces an existing canonical', async () => {
      const file = await write('a.html', '<html><head><link rel="canonical" href="http://old"></head></html>');
      await service.setCanonical(file, 'https://new');
      const html = await read(file);
      expect(html).toContain('https://new');
      expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    });
  });

  describe('image alt text', () => {
    it('fills only images that are missing alt', async () => {
      const file = await write('a.html', PAGE);
      const result = await service.setImageAlt(file, 'Winter jacket on a model');

      expect(result.applied).toBe(true);
      const html = await read(file);
      expect(html).toContain('src="/a.png" alt="Winter jacket on a model"');
      // A human-written description must never be overwritten.
      expect(html).toContain('alt="Existing description"');
    });

    it('targets a single image by src', async () => {
      const file = await write('a.html', '<html><body><img src="/a.png"><img src="/c.png"></body></html>');
      await service.setImageAlt(file, 'Only this one', '/a.png');
      const html = await read(file);
      expect(html).toContain('src="/a.png" alt="Only this one"');
      expect(html).toContain('<img src="/c.png">');
    });

    it('reports why nothing changed when every image already has alt', async () => {
      const file = await write('a.html', '<html><body><img src="/a.png" alt="Set"></body></html>');
      const result = await service.setImageAlt(file, 'New');
      expect(result).toEqual({ applied: false, reason: 'No images are missing alt text.' });
    });

    it('treats a whitespace-only alt as missing', async () => {
      const file = await write('a.html', '<html><body><img src="/a.png" alt="   "></body></html>');
      const result = await service.setImageAlt(file, 'Real description');
      expect(result.applied).toBe(true);
      expect(await read(file)).toContain('alt="Real description"');
    });
  });

  describe('JSON-LD injection', () => {
    const FAQ = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] };

    it('injects a JSON-LD block into head', async () => {
      const file = await write('a.html', PAGE);
      const result = await service.injectJsonLd(file, FAQ);

      expect(result.applied).toBe(true);
      const html = await read(file);
      expect(html).toContain('application/ld+json');
      expect(html).toContain('"@type": "FAQPage"');
    });

    it('accepts a JSON string as well as an object', async () => {
      const file = await write('a.html', PAGE);
      await service.injectJsonLd(file, JSON.stringify(FAQ));
      expect(await read(file)).toContain('"@type": "FAQPage"');
    });

    it('replaces an existing block of the same type instead of duplicating', async () => {
      const existing = '<script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"old":true}]}</script>';
      const file = await write('a.html', `<html><head>${existing}</head></html>`);

      await service.injectJsonLd(file, FAQ);
      const html = await read(file);

      expect(html.match(/application\/ld\+json/g)).toHaveLength(1);
      expect(html).not.toContain('"old"');
    });

    it('leaves a JSON-LD block of a different type alone', async () => {
      const existing = '<script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>';
      const file = await write('a.html', `<html><head>${existing}</head></html>`);

      await service.injectJsonLd(file, FAQ);
      const html = await read(file);

      expect(html).toContain('"Organization"');
      expect(html).toContain('"FAQPage"');
    });

    it('refuses malformed JSON rather than writing a broken script tag', async () => {
      const file = await write('a.html', PAGE);
      const result = await service.injectJsonLd(file, '{not json');

      expect(result).toEqual({ applied: false, reason: 'Refused to inject malformed JSON-LD.' });
      expect(await read(file)).not.toContain('ld+json');
    });

    it('refuses JSON-LD with no @type', async () => {
      const file = await write('a.html', PAGE);
      const result = await service.injectJsonLd(file, { name: 'no type' });
      expect(result.applied).toBe(false);
      expect(await read(file)).not.toContain('ld+json');
    });

    it('does not remove an unparseable existing block it cannot understand', async () => {
      const junk = '<script type="application/ld+json">// not json</script>';
      const file = await write('a.html', `<html><head>${junk}</head></html>`);
      await service.injectJsonLd(file, FAQ);
      expect(await read(file)).toContain('// not json');
    });
  });

  describe('Next.js metadata', () => {
    const LAYOUT = `export const metadata = {\n  title: "Old",\n};\n`;

    it('replaces a top-level property', async () => {
      const file = await write('layout.tsx', LAYOUT);
      expect(await service.updateNextJsMetadata(file, 'title', 'New title')).toBe(true);

      const source = await read(file);
      expect(source).toContain('"New title"');
      expect(source).not.toContain('"Old"');
    });

    it('adds a property that does not exist yet', async () => {
      const file = await write('layout.tsx', LAYOUT);
      await service.updateNextJsMetadata(file, 'description', 'A summary');
      expect(await read(file)).toContain('description: "A summary"');
    });

    it('creates a nested object for a dotted path', async () => {
      const file = await write('layout.tsx', LAYOUT);
      await service.updateNextJsMetadata(file, 'alternates.canonical', 'https://acme.com/x');

      const source = await read(file);
      expect(source).toContain('alternates:');
      expect(source).toContain('canonical: "https://acme.com/x"');
    });

    it('writes into an existing nested object without clobbering its siblings', async () => {
      const file = await write(
        'layout.tsx',
        `export const metadata = {\n  openGraph: { siteName: "Acme", title: "Old" },\n};\n`,
      );
      await service.updateNextJsMetadata(file, 'openGraph.title', 'New');

      const source = await read(file);
      expect(source).toContain('siteName: "Acme"');
      expect(source).toContain('"New"');
      expect(source).not.toContain('"Old"');
    });

    it('escapes quotes in the written value', async () => {
      const file = await write('layout.tsx', LAYOUT);
      await service.updateNextJsMetadata(file, 'title', 'The "best" jacket');
      // JSON.stringify handles the escaping; the file must still parse.
      expect(await read(file)).toContain('\\"best\\"');
    });

    it('returns false when the file has no metadata export', async () => {
      const file = await write('layout.tsx', `export default function Layout() { return null; }\n`);
      expect(await service.updateNextJsMetadata(file, 'title', 'x')).toBe(false);
    });
  });

  describe('applyFix dispatch', () => {
    it('routes an HTML title fix to the HTML patcher', async () => {
      const file = await write('a.html', PAGE);
      const result = await service.applyFix(file, 'META_TITLE', 'Dispatched');

      expect(result.applied).toBe(true);
      expect(await read(file)).toContain('<title>Dispatched</title>');
    });

    it('routes a canonical fix on a Next.js file to metadata.alternates.canonical', async () => {
      const file = await write('layout.tsx', `export const metadata = {};\n`);
      const result = await service.applyFix(file, 'CANONICAL_URL', 'https://acme.com');

      expect(result.applied).toBe(true);
      expect(await read(file)).toContain('canonical: "https://acme.com"');
    });

    it('explains why a fix type has no Next.js equivalent', async () => {
      const file = await write('layout.tsx', `export const metadata = {};\n`);
      const result = await service.applyFix(file, 'ALT_TEXT', 'x');

      expect(result.applied).toBe(false);
      expect(result.reason).toMatch(/cannot be expressed as Next.js metadata/);
    });

    it('explains why an unknown fix type was skipped', async () => {
      const file = await write('a.html', PAGE);
      const result = await service.applyFix(file, 'INTERNAL_LINKING', 'x');

      expect(result.applied).toBe(false);
      expect(result.reason).toMatch(/no automated HTML patcher/);
    });
  });
});
