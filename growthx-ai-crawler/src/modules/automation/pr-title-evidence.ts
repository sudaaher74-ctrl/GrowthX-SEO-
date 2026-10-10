import * as ts from 'typescript';

/** Parse text without evaluating customer code. Conflicting return paths stay unknown. */
export function readTitleEvidence(source: string | null): { value: string | null; expression: string | null } {
  if (source === null) return { value: null, expression: null };
  const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const titles: { value: string | null; expression: string | null }[] = [];
  const walk = (node: ts.Node) => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'title') {
      const children = node.children.filter(child => !ts.isJsxText(child) || child.text.trim());
      const child = children[0];
      if (children.length === 1 && ts.isJsxExpression(child) && child.expression) {
        const expression = child.expression;
        titles.push(ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)
          ? { value: expression.text, expression: null }
          : { value: null, expression: expression.getText(ast) });
      } else if (children.every(ts.isJsxText)) {
        titles.push({ value: children.map(child => (child as ts.JsxText).text).join('').trim(), expression: null });
      } else titles.push({ value: null, expression: node.getText(ast) });
    }
    ts.forEachChild(node, walk);
  };
  walk(ast);
  if (titles.length && titles.every(title => JSON.stringify(title) === JSON.stringify(titles[0]))) return titles[0];
  return { value: null, expression: titles.length ? 'This page has different titles for different states.' : null };
}

/** Display literal options for the supported object lookup + fallback + suffix rule. */
export function readTitleVariants(source: string | null, expression: string | null): string[] {
  if (!source || !expression) return [];
  const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rule = ts.createSourceFile('rule.ts', `const title = ${expression};`, ts.ScriptTarget.Latest, true);
  const statement = rule.statements[0];
  if (!ts.isVariableStatement(statement)) return [];
  const value = statement.declarationList.declarations[0].initializer;
  if (!value || !ts.isBinaryExpression(value) || value.operatorToken.kind !== ts.SyntaxKind.PlusToken || !ts.isStringLiteral(value.right)) return [];
  const left = ts.isParenthesizedExpression(value.left) ? value.left.expression : value.left;
  if (!ts.isBinaryExpression(left) || left.operatorToken.kind !== ts.SyntaxKind.BarBarToken || !ts.isStringLiteral(left.right)) return [];
  const access = left.left;
  if (!ts.isPropertyAccessExpression(access) || access.name.text !== 'title' || !ts.isElementAccessExpression(access.expression) || !ts.isIdentifier(access.expression.expression)) return [];
  const name = access.expression.expression.text;
  const options = [left.right.text + value.right.text];
  for (const item of ast.statements) {
    if (!ts.isVariableStatement(item)) continue;
    for (const variable of item.declarationList.declarations) {
      if (!ts.isIdentifier(variable.name) || variable.name.text !== name || !variable.initializer || !ts.isObjectLiteralExpression(variable.initializer)) continue;
      for (const entry of variable.initializer.properties) {
        if (!ts.isPropertyAssignment(entry) || !ts.isObjectLiteralExpression(entry.initializer)) continue;
        for (const property of entry.initializer.properties) {
          if (ts.isPropertyAssignment(property) && property.name.getText(ast).replace(/['"]/g, '') === 'title' && ts.isStringLiteral(property.initializer)) options.push(property.initializer.text + value.right.text);
        }
      }
    }
  }
  return options.length > 1 ? [...new Set(options)] : [];
}
