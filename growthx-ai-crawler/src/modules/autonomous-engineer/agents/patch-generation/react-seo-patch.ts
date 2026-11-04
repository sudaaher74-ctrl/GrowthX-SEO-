import * as fs from 'fs/promises';
import * as path from 'path';

function resolveDefaultComponent(
  ast: import('typescript').SourceFile,
  ts: typeof import('typescript'),
  file: string,
): { name: string; body: import('typescript').Node } | null {
  const hasMod = (node: import('typescript').Node, kind: import('typescript').SyntaxKind) =>
    Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === kind));

  const unwrapFunctionBody = (expr: import('typescript').Expression): import('typescript').Node | undefined => {
    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) return expr.body;
    if (ts.isParenthesizedExpression(expr)) return unwrapFunctionBody(expr.expression);
    if (ts.isCallExpression(expr) && expr.arguments.length >= 1) {
      return unwrapFunctionBody(expr.arguments[0]);
    }
    return undefined;
  };

  const findByName = (targetName: string): import('typescript').Node | undefined => {
    for (const statement of ast.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name?.text === targetName && statement.body) {
        return statement.body;
      }
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === targetName && declaration.initializer) {
            const body = unwrapFunctionBody(declaration.initializer);
            if (body) return body;
          }
        }
      }
    }
    return undefined;
  };

  // 1. export default function Account() { ... }
  for (const statement of ast.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      hasMod(statement, ts.SyntaxKind.ExportKeyword) &&
      hasMod(statement, ts.SyntaxKind.DefaultKeyword) &&
      statement.body
    ) {
      return { name: statement.name?.text || '__default__', body: statement.body };
    }
  }

  // 2. export default Account / export default () => ... / export default memo(Account)
  const exported = ast.statements.find(ts.isExportAssignment);
  if (exported) {
    let expr = exported.expression;
    while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
    if (ts.isIdentifier(expr)) {
      const body = findByName(expr.text);
      if (body) return { name: expr.text, body };
    }
    const inlineBody = unwrapFunctionBody(expr);
    if (inlineBody) return { name: '__default__', body: inlineBody };
    if (ts.isCallExpression(expr) && expr.arguments.length >= 1 && ts.isIdentifier(expr.arguments[0])) {
      const targetName = expr.arguments[0].text;
      const body = findByName(targetName);
      if (body) return { name: targetName, body };
    }
  }

  // 3. export { Account as default }
  for (const statement of ast.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const el of statement.exportClause.elements) {
        if (el.name.text === 'default') {
          const localName = el.propertyName?.text || el.name.text;
          const body = findByName(localName);
          if (body) return { name: localName, body };
        }
      }
    }
  }

  // 4. Single named export or basename match (e.g., export function Account() in Account.jsx)
  const baseName = path.basename(file).replace(/\.[cm]?[jt]sx?$/i, '');
  const namedCandidates: Array<{ name: string; body: import('typescript').Node }> = [];
  for (const statement of ast.statements) {
    if (ts.isFunctionDeclaration(statement) && hasMod(statement, ts.SyntaxKind.ExportKeyword) && statement.name && statement.body) {
      namedCandidates.push({ name: statement.name.text, body: statement.body });
    }
    if (ts.isVariableStatement(statement) && hasMod(statement, ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          const body = unwrapFunctionBody(declaration.initializer);
          if (body) namedCandidates.push({ name: declaration.name.text, body });
        }
      }
    }
  }
  if (namedCandidates.length === 1) return namedCandidates[0];
  const baseMatch = namedCandidates.find((c) => c.name.toLowerCase() === baseName.toLowerCase());
  if (baseMatch) return baseMatch;

  return null;
}

function expressionContainsJsx(
  node: import('typescript').Expression,
  ts: typeof import('typescript'),
): boolean {
  let expr = node;
  while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
  if (ts.isJsxElement(expr) || ts.isJsxSelfClosingElement(expr) || ts.isJsxFragment(expr)) return true;
  if (ts.isConditionalExpression(expr)) {
    return expressionContainsJsx(expr.whenTrue, ts) || expressionContainsJsx(expr.whenFalse, ts);
  }
  return false;
}

/** Use the app's existing Helmet provider; never insert Next.js metadata into a React SPA. */
export async function patchReactSeo(file: string, property: 'title' | 'description', value: string): Promise<{ applied: boolean; reason?: string }> {
  const ts = await import('typescript');
  const source = await fs.readFile(file, 'utf8');
  let app = path.dirname(file);
  while (app !== path.dirname(app)) {
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(app, 'package.json'), 'utf8'));
      if (!pkg.dependencies?.['react-helmet-async'] && !pkg.devDependencies?.['react-helmet-async']) {
        return { applied: false, reason: 'React SEO requires an existing react-helmet-async integration.' };
      }
      break;
    } catch { app = path.dirname(app); }
  }
  let provider = false;
  for (const entry of ['main.jsx', 'main.tsx', 'index.jsx', 'index.tsx', 'App.jsx', 'App.tsx']) {
    try { provider ||= /<HelmetProvider\b/.test(await fs.readFile(path.join(app, 'src', entry), 'utf8')); } catch { /* Try the next entry. */ }
  }
  if (!provider) return { applied: false, reason: 'No existing HelmetProvider was found; a developer must wire SEO first.' };
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let helmetName = 'Helmet';
  let imported = false;
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === 'react-helmet-async') {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        const helmet = bindings.elements.find(e => (e.propertyName?.text || e.name.text) === 'Helmet');
        if (helmet) { imported = true; helmetName = helmet.name.text; }
      }
    }
  }
  const resolvedComp = resolveDefaultComponent(ast, ts, file);
  const tag = property === 'title' ? `<title>{${JSON.stringify(value)}}</title>` : `<meta name="description" content={${JSON.stringify(value)}} />`;
  const helmets: import('typescript').JsxElement[] = [];
  const collect = (node: import('typescript').Node) => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === helmetName && imported) helmets.push(node);
    ts.forEachChild(node, collect);
  };
  collect(ast);
  let updated: string;
  if (helmets.length >= 1) {
    if (helmets.length > 1) {
      const defaultName = resolvedComp?.name ?? '';
      const branches = new Set<import('typescript').Node>();
      for (const helmet of helmets) {
        let ancestor: import('typescript').Node | undefined = helmet.parent;
        let branch: import('typescript').Node | undefined;
        let owner = '';
        while (ancestor) {
          if (!branch && ts.isReturnStatement(ancestor)) branch = ancestor;
          if (ts.isVariableDeclaration(ancestor) && ts.isIdentifier(ancestor.name)) { owner = ancestor.name.text; break; }
          if (ts.isFunctionDeclaration(ancestor)) { owner = ancestor.name?.text || '__default__'; break; }
          if (ts.isExportAssignment(ancestor)) { owner = '__default__'; break; }
          ancestor = ancestor.parent;
        }
        if (!branch || !defaultName || owner !== defaultName || branches.has(branch)) return { applied: false, reason: 'Multiple Helmet blocks require manual review.' };
        branches.add(branch);
      }
    }
    const edits: Array<{ start: number; end: number }> = [];
    for (const helmet of helmets) {
    const existing = helmet.children.filter(child => {
      if (property === 'title') return ts.isJsxElement(child) && child.openingElement.tagName.getText(ast) === 'title';
      if (!ts.isJsxSelfClosingElement(child) || child.tagName.getText(ast) !== 'meta') return false;
      return child.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(ast) === 'name' && p.initializer && ts.isStringLiteral(p.initializer) && p.initializer.text === 'description');
    });
    if (existing.length > 1) return { applied: false, reason: 'Multiple SEO tags require manual review.' };
    const start = existing[0]?.getStart(ast) ?? helmet.closingElement.getStart(ast);
    const end = existing[0]?.getEnd() ?? start;
    edits.push({ start, end });
    }
    updated = source;
    for (const edit of edits.sort((a, b) => b.start - a.start)) updated = updated.slice(0, edit.start) + tag + updated.slice(edit.end);
  } else {
    if (helmets.length > 1) return { applied: false, reason: 'Multiple Helmet blocks require manual review.' };
    if (!resolvedComp) return { applied: false, reason: 'No unambiguous default React page component.' };
    const component = resolvedComp.body;
    const returns: import('typescript').Expression[] = [];
    const findReturn = (node: import('typescript').Node) => {
      if (ts.isReturnStatement(node) && node.expression) returns.push(node.expression);
      if (node !== component && (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node))) return;
      ts.forEachChild(node, findReturn);
    };
    if (ts.isBlock(component)) findReturn(component); else returns.push(component as import('typescript').Expression);
    const jsxReturns = returns.filter(node => expressionContainsJsx(node, ts));
    if (!jsxReturns.length) return { applied: false, reason: 'Page return is not direct JSX.' };
    updated = source;
    for (const returned of jsxReturns.sort((a, b) => b.getStart(ast) - a.getStart(ast))) {
      let expression = returned;
      while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
      // Put Helmet after the page tree so it overrides inherited template metadata.
      const replacement = `(<>{${expression.getText(ast)}}<${helmetName}>${tag}</${helmetName}></>)`;
      updated = updated.slice(0, returned.getStart(ast)) + replacement + updated.slice(returned.getEnd());
    }
    if (!imported) {
      if (/\bHelmet\b/.test(source)) return { applied: false, reason: 'Helmet name conflicts with an existing identifier.' };
      updated = `import { Helmet } from 'react-helmet-async';\n` + updated;
    }
  }
  await fs.writeFile(file, updated);
  return { applied: true };
}
