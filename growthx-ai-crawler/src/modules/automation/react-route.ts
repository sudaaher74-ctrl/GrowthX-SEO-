import * as fs from 'fs/promises';
import * as path from 'path';

const PAGE_IMPORT_PREFIX = /^(\.\.?\/(pages|screens|views)\/|@\/(pages|screens|views)\/)/;

async function collectStaticReactRoutes(
  root: string,
): Promise<Array<{ route: string; file: string }>> {
  const ts = await import('typescript');
  const resolvedPairs: Array<{ route: string; file: string }> = [];
  const realRoot = await fs.realpath(root).catch(() => path.resolve(root));

  for (const name of ['router', 'routes', 'App']) {
    for (const ext of ['jsx', 'tsx', 'js', 'ts']) {
      const file = path.join(root, 'src', `${name}.${ext}`);
      let source: string;
      try {
        source = await fs.readFile(file, 'utf8');
      } catch {
        continue;
      }
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const imports = new Map<string, string>();
      const arrayVars = new Map<string, import('typescript').ArrayLiteralExpression>();

      const collect = (node: import('typescript').Node) => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const spec = node.moduleSpecifier.text;
          if (node.importClause?.name) {
            imports.set(node.importClause.name.text, spec);
          }
          const bindings = node.importClause?.namedBindings;
          if (bindings && ts.isNamedImports(bindings)) {
            for (const el of bindings.elements) {
              imports.set(el.name.text, spec);
            }
          }
        }
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
          if (ts.isArrayLiteralExpression(node.initializer)) {
            arrayVars.set(node.name.text, node.initializer);
          }
          const importsInValue: string[] = [];
          const scan = (child: import('typescript').Node) => {
            if (
              ts.isCallExpression(child) &&
              child.expression.kind === ts.SyntaxKind.ImportKeyword &&
              child.arguments.length === 1 &&
              ts.isStringLiteral(child.arguments[0])
            ) {
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

      const rawEntries: Array<{ route: string; spec: string }> = [];

      const extractComponentSpec = (element: import('typescript').Node): string | null => {
        const components = new Set<string>();
        const jsx = (node: import('typescript').Node) => {
          if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const spec = imports.get(node.tagName.getText(ast));
            if (spec && PAGE_IMPORT_PREFIX.test(spec)) components.add(spec);
          }
          ts.forEachChild(node, jsx);
        };
        jsx(element);
        return components.size === 1 ? [...components][0] : null;
      };

      const walk = (array: import('typescript').ArrayLiteralExpression, parent = '/') => {
        for (const item of array.elements) {
          if (!ts.isObjectLiteralExpression(item)) continue;
          const props = new Map(
            item.properties
              .filter(ts.isPropertyAssignment)
              .map((p) => [p.name.getText(ast).replace(/['"]/g, ''), p.initializer]),
          );
          const route = props.get('path');
          const declared = route && ts.isStringLiteral(route) ? route.text : '';
          if (route && !ts.isStringLiteral(route)) continue;
          const full =
            (declared.startsWith('/') ? declared : `${parent}/${declared}`)
              .replace(/\/+/g, '/')
              .replace(/\/$/, '') || '/';
          const children = props.get('children');
          if (children && ts.isArrayLiteralExpression(children)) walk(children, full);
          // Dynamic routes share a component across URLs. A per-URL title must not overwrite every page.
          if (/[:*]/.test(full) || (children && props.get('index')?.kind !== ts.SyntaxKind.TrueKeyword)) continue;
          const element = props.get('element') ?? props.get('Component');
          if (!element) continue;
          let spec = extractComponentSpec(element);
          if (!spec && ts.isIdentifier(element)) {
            const candidate = imports.get(element.text);
            if (candidate && PAGE_IMPORT_PREFIX.test(candidate)) spec = candidate;
          }
          if (spec) rawEntries.push({ route: full, spec });
        }
      };

      const walkJsxRoutes = (node: import('typescript').Node, parent = '/') => {
        if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
          const open = ts.isJsxElement(node) ? node.openingElement : node;
          if (open.tagName.getText(ast) === 'Route') {
            let declared = '';
            let isIndex = false;
            let elementAttr: import('typescript').Expression | undefined;
            for (const prop of open.attributes.properties) {
              if (!ts.isJsxAttribute(prop)) continue;
              const propName = prop.name.getText(ast);
              if (propName === 'path' && prop.initializer && ts.isStringLiteral(prop.initializer)) {
                declared = prop.initializer.text;
              } else if (propName === 'index') {
                isIndex =
                  !prop.initializer ||
                  (ts.isJsxExpression(prop.initializer) &&
                    prop.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword);
              } else if ((propName === 'element' || propName === 'Component') && prop.initializer && ts.isJsxExpression(prop.initializer)) {
                elementAttr = prop.initializer.expression;
              }
            }
            const full =
              (declared.startsWith('/') ? declared : `${parent}/${declared}`)
                .replace(/\/+/g, '/')
                .replace(/\/$/, '') || '/';
            const hasChildRoutes =
              ts.isJsxElement(node) &&
              node.children.some(
                (ch) =>
                  (ts.isJsxElement(ch) && ch.openingElement.tagName.getText(ast) === 'Route') ||
                  (ts.isJsxSelfClosingElement(ch) && ch.tagName.getText(ast) === 'Route'),
              );
            if (!/[:*]/.test(full) && (!hasChildRoutes || isIndex) && elementAttr) {
              let spec = extractComponentSpec(elementAttr);
              if (!spec && ts.isIdentifier(elementAttr)) {
                const candidate = imports.get(elementAttr.text);
                if (candidate && PAGE_IMPORT_PREFIX.test(candidate)) spec = candidate;
              }
              if (spec) rawEntries.push({ route: full, spec });
            }
            if (ts.isJsxElement(node)) {
              for (const child of node.children) walkJsxRoutes(child, full);
            }
            return;
          }
        }
        ts.forEachChild(node, (child) => walkJsxRoutes(child, parent));
      };

      const routers = (node: import('typescript').Node) => {
        if (ts.isCallExpression(node) && /^(createBrowserRouter|createHashRouter)$/.test(node.expression.getText(ast))) {
          const routesArg = node.arguments[0];
          if (routesArg && ts.isArrayLiteralExpression(routesArg)) {
            walk(routesArg);
          } else if (routesArg && ts.isIdentifier(routesArg)) {
            const arr = arrayVars.get(routesArg.text);
            if (arr) walk(arr);
          }
        }
        ts.forEachChild(node, routers);
      };
      routers(ast);
      walkJsxRoutes(ast);

      for (const { route, spec } of rawEntries) {
        const normalizedSpec = spec.startsWith('@/') ? `./${spec.slice(2)}` : spec;
        const base = path.resolve(path.dirname(file), normalizedSpec);
        for (const suffix of ['', '.jsx', '.tsx', '.js', '.ts', '/index.jsx', '/index.tsx']) {
          try {
            const candidate = await fs.realpath(base + suffix);
            const relative = path.relative(realRoot, candidate);
            if (!relative.startsWith('..') && !path.isAbsolute(relative) && (await fs.stat(candidate)).isFile()) {
              resolvedPairs.push({ route, file: candidate });
              break;
            }
          } catch {
            /* Try the next extension. */
          }
        }
      }
    }
  }
  return resolvedPairs;
}

/** Resolve explicit React Router declarations; never guess from a component filename. */
export async function resolveReactRoute(root: string, pathname: string): Promise<string | null> {
  const pairs = await collectStaticReactRoutes(root);
  const matches = new Set(pairs.filter((p) => p.route === pathname).map((p) => p.file));
  return matches.size === 1 ? [...matches][0] : null;
}

/** Reverse lookup: find the unique static route path in React Router that renders targetFile. */
export async function findReactRouteForFile(root: string, targetFile: string): Promise<string | null> {
  const realTarget = await fs.realpath(targetFile).catch(() => path.resolve(targetFile));
  const pairs = await collectStaticReactRoutes(root);
  const routes = new Set(pairs.filter((p) => p.file === realTarget).map((p) => p.route));
  return routes.size === 1 ? [...routes][0] : null;
}
