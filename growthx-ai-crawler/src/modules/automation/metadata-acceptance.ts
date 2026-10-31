import * as path from 'path';
import * as fs from 'fs/promises';
import { RepoSandbox } from './engineer-sandbox';
import { resolveReactRoute } from './react-route';

/** A static integration guard, not a substitute for browser acceptance tests. */
export async function metadataAcceptance(box: RepoSandbox): Promise<string[]> {
  const ts = await import('typescript');
  const errors: string[] = [];
  const entries = (source: string) => {
    const result: Array<{ route: string; title: string; source: string }> = [];
    const ast = ts.createSourceFile('registry.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const walk = (node: import('typescript').Node) => {
      if (ts.isObjectLiteralExpression(node)) {
        const props = new Map(node.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(ast).replace(/['"]/g, ''), p.initializer]));
        const value = (key: string) => { const v = props.get(key); return v && ts.isStringLiteral(v) ? v.text : null; };
        const route = value('path'), title = value('title'), file = value('source');
        if (route?.startsWith('/') && title && file) result.push({ route, title, source: file });
      }
      ts.forEachChild(node, walk);
    };
    walk(ast); return result;
  };
  for (const file of box.changed) {
    if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
    const before = entries(box.originals.get(file) ?? '');
    const after = entries(await box.source(file));
    for (const entry of after) {
      if (before.some(old => old.route === entry.route && old.title === entry.title)) continue;
      if (Array.from(entry.title).length > 60) errors.push(`${entry.route}: proposed title exceeds 60 characters; shorten it without changing the page content.`);
      let app = path.posix.dirname(file);
      for (;;) {
        try { await box.source(app === '.' ? 'package.json' : `${app}/package.json`); break; } catch { /* Walk inside the repository only. */ }
        if (app === '.') break;
        app = path.posix.dirname(app);
      }
      const component = path.posix.join(app, entry.source);
      // The registry's source hint is not proof that React Router renders it.
      for (const name of ['router', 'routes', 'App']) for (const ext of ['jsx', 'tsx', 'js', 'ts']) {
        const rel = path.posix.join(app, 'src', `${name}.${ext}`);
        try { await fs.lstat(path.resolve(box.root, rel)); } catch (error: any) { if (error.code === 'ENOENT') continue; throw error; }
        await box.source(rel);
      }
      const routed = await resolveReactRoute(path.resolve(box.root, app), entry.route);
      const resolvedComponent = path.resolve(box.root, component);
      const realRouted = routed ? await fs.realpath(routed).catch(() => path.resolve(routed)) : null;
      const realComponent = await fs.realpath(resolvedComponent).catch(() => resolvedComponent);
      if (!realRouted || realRouted !== realComponent) {
        errors.push(`${entry.route}: could not trace the declared source page through explicit React Router routes. Do not claim runtime integration without a supported route.`);
        continue;
      }
      let source: string;
      try { source = await box.source(component); } catch { errors.push(`${entry.route}: cannot inspect the declared page ${component}.`); continue; }
      const ast = ts.createSourceFile(component, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      let connected = false;
      const walk = (node: import('typescript').Node) => {
        if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'title') {
          connected ||= node.children.some(child => ts.isJsxText(child) ? child.text.trim() === entry.title : ts.isJsxExpression(child) && child.expression && ts.isStringLiteral(child.expression) && child.expression.text === entry.title);
        }
        if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
          const tag = node.tagName.getText(ast);
          if (/SEOHead|SeoHead/.test(tag)) connected ||= node.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(ast) === 'path' && p.initializer && ts.isStringLiteral(p.initializer) && p.initializer.text === entry.route);
        }
        ts.forEachChild(node, walk);
      };
      walk(ast);
      if (!connected) errors.push(`${entry.route}: registry-only title update does not wire runtime metadata. Read ${component}, then use the metadata tool on that page with the same title, or mount the existing SEOHead with path=${JSON.stringify(entry.route)}. Preserve visible H1 and content.`);
    }
  }
  return errors;
}
