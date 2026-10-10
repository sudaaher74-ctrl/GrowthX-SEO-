import * as fs from 'fs/promises';
import * as path from 'path';

/** Resolve explicit React Router declarations; never guess from a component filename. */
export async function resolveReactRoute(root: string, pathname: string): Promise<string | null> {
  const ts = await import('typescript');
  const matches = new Set<string>();
  for (const name of ['router', 'routes', 'App']) {
    for (const ext of ['jsx', 'tsx', 'js', 'ts']) {
      const file = path.join(root, 'src', `${name}.${ext}`);
      let source: string;
      try { source = await fs.readFile(file, 'utf8'); } catch { continue; }
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const imports = new Map<string, string>();
      const collect = (node: import('typescript').Node) => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause?.name) {
          imports.set(node.importClause.name.text, node.moduleSpecifier.text);
        }
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
          const importsInValue: string[] = [];
          const scan = (child: import('typescript').Node) => {
            if (ts.isCallExpression(child) && child.expression.kind === ts.SyntaxKind.ImportKeyword &&
                child.arguments.length === 1 && ts.isStringLiteral(child.arguments[0])) {
              importsInValue.push(child.arguments[0].text);
            }
            ts.forEachChild(child, scan);
          };
          scan(node.initializer);
          if (importsInValue.length === 1) imports.set(node.name.text, importsInValue[0]);
        }
        ts.forEachChild(node, collect);
      };
      collect(ast);
      const entries: string[] = [];
      const walk = (array: import('typescript').ArrayLiteralExpression, parent = '/') => {
        for (const item of array.elements) {
          if (!ts.isObjectLiteralExpression(item)) continue;
          const props = new Map(item.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(ast).replace(/['"]/g, ''), p.initializer]));
          const route = props.get('path');
          const declared = route && ts.isStringLiteral(route) ? route.text : '';
          if (route && !ts.isStringLiteral(route)) continue;
          const full = (declared.startsWith('/') ? declared : `${parent}/${declared}`).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
          const children = props.get('children');
          if (children && ts.isArrayLiteralExpression(children)) walk(children, full);
          // Dynamic routes share a component across URLs. A per-URL title must not overwrite every page.
          if (full !== pathname || /[:*]/.test(full) || (children && props.get('index')?.kind !== ts.SyntaxKind.TrueKeyword)) continue;
          const element = props.get('element');
          if (!element) continue;
          const components = new Set<string>();
          const jsx = (node: import('typescript').Node) => {
            if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
              const spec = imports.get(node.tagName.getText(ast));
              if (spec?.startsWith('./pages/') || spec?.startsWith('../pages/')) components.add(spec);
            }
            ts.forEachChild(node, jsx);
          };
          jsx(element);
          if (components.size === 1) entries.push([...components][0]);
        }
      };
      const routers = (node: import('typescript').Node) => {
        if (ts.isCallExpression(node) && /^(createBrowserRouter|createHashRouter)$/.test(node.expression.getText(ast))) {
          const routes = node.arguments[0];
          if (routes && ts.isArrayLiteralExpression(routes)) walk(routes);
        }
        ts.forEachChild(node, routers);
      };
      routers(ast);
      for (const spec of entries) {
        const base = path.resolve(path.dirname(file), spec);
        for (const suffix of ['', '.jsx', '.tsx', '.js', '.ts', '/index.jsx', '/index.tsx']) {
          try {
            const candidate = await fs.realpath(base + suffix);
            const relative = path.relative(await fs.realpath(root), candidate);
            if (!relative.startsWith('..') && !path.isAbsolute(relative) && (await fs.stat(candidate)).isFile()) {
              matches.add(candidate); break;
            }
          } catch { /* Try the next extension. */ }
        }
      }
    }
  }
  return matches.size === 1 ? [...matches][0] : null;
}
