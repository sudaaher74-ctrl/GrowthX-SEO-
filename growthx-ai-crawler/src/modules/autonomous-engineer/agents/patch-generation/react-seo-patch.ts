import * as fs from 'fs/promises';
import * as path from 'path';

/** Use the app's existing Helmet provider; never insert Next.js metadata into a React SPA. */
export async function patchReactSeo(file: string, property: 'title' | 'description', value: string): Promise<{ applied: boolean; reason?: string }> {
  const ts = await import('typescript');
  const source = await fs.readFile(file, 'utf8');
  let app = path.dirname(file);
  while (app !== path.dirname(app)) {
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(app, 'package.json'), 'utf8'));
      if (!pkg.dependencies?.['react-helmet-async']) return { applied: false, reason: 'React SEO requires an existing react-helmet-async integration.' };
      break;
    } catch { app = path.dirname(app); }
  }
  let provider = false;
  for (const entry of ['main.jsx', 'main.tsx', 'index.jsx', 'index.tsx']) {
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
      const exported = ast.statements.find(ts.isExportAssignment);
      const defaultName = exported && ts.isIdentifier(exported.expression) ? exported.expression.text : '';
      const branches = new Set<import('typescript').Node>();
      for (const helmet of helmets) {
        let ancestor: import('typescript').Node | undefined = helmet.parent;
        let branch: import('typescript').Node | undefined;
        let owner = '';
        while (ancestor) {
          if (!branch && ts.isReturnStatement(ancestor)) branch = ancestor;
          if (ts.isVariableDeclaration(ancestor) && ts.isIdentifier(ancestor.name)) { owner = ancestor.name.text; break; }
          if (ts.isFunctionDeclaration(ancestor)) { owner = ancestor.name?.text || ''; break; }
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
    const exported = ast.statements.find(ts.isExportAssignment);
    if (!exported || !ts.isIdentifier(exported.expression)) return { applied: false, reason: 'No unambiguous default React page component.' };
    const name = exported.expression.text;
    let component: import('typescript').Node | undefined;
    for (const statement of ast.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) component = statement.body;
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer &&
              (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) component = declaration.initializer.body;
        }
      }
    }
    if (!component) return { applied: false, reason: 'No unambiguous default React page component.' };
    const returns: import('typescript').Expression[] = [];
    const findReturn = (node: import('typescript').Node) => {
      if (ts.isReturnStatement(node) && node.expression) returns.push(node.expression);
      if (node !== component && (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node))) return;
      ts.forEachChild(node, findReturn);
    };
    if (ts.isBlock(component)) findReturn(component); else returns.push(component as import('typescript').Expression);
    const jsxReturns = returns.filter(node => {
      let expression = node;
      while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
      return ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression) || ts.isJsxFragment(expression);
    });
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
