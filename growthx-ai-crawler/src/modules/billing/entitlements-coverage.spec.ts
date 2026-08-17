import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import * as ts from 'typescript';

/**
 * Every EntitlementsGuard-protected route must declare a plan requirement.
 *
 * `EntitlementsAuditService` already asserts this, but only at boot — so a
 * missing decorator surfaced as a container that would not start, the platform
 * served a stale build (or none at all), and the dashboard showed "could not
 * reach the GrowthX API". That is an expensive way to learn about a missing
 * decorator, and the signal arrives only after a deploy has already failed.
 *
 * This reads the controller sources with the TypeScript parser, so the same
 * mistake fails here first. It deliberately does not import the controllers:
 * doing so drags in the whole dependency graph (Octokit, Playwright, Prisma)
 * to answer a question that is answerable from the syntax alone.
 */

/** Decorators that satisfy the guard, on either the method or the class. */
const DECLARING = new Set(['RequiresFeature', 'Metered', 'RequiresQuota', 'NoEntitlement']);
const ROUTE_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Options', 'Head']);

function controllerFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) controllerFiles(full, found);
    else if (entry.endsWith('.controller.ts')) found.push(full);
  }
  return found;
}

/** Decorator call names on a node, e.g. `['Get', 'Metered']`. */
function decoratorNames(node: ts.Node): string[] {
  const decorators = ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
  return decorators
    .map((d) => (ts.isCallExpression(d.expression) ? d.expression.expression : d.expression))
    .map((e) => (ts.isIdentifier(e) ? e.text : ''))
    .filter(Boolean);
}

/** True when a @UseGuards(...) on this node lists EntitlementsGuard. */
function usesEntitlementsGuard(node: ts.Node): boolean {
  const decorators = ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
  return decorators.some(
    (d) =>
      ts.isCallExpression(d.expression) &&
      ts.isIdentifier(d.expression.expression) &&
      d.expression.expression.text === 'UseGuards' &&
      d.expression.arguments.some((a) => ts.isIdentifier(a) && a.text === 'EntitlementsGuard'),
  );
}

describe('entitlement coverage across every controller', () => {
  const srcRoot = join(__dirname, '..', '..');

  it('declares a plan requirement on every entitlement-guarded route', () => {
    const files = controllerFiles(srcRoot);
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];

    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );

      source.forEachChild((node) => {
        if (!ts.isClassDeclaration(node) || !node.name) return;

        const classGuarded = usesEntitlementsGuard(node);
        const classDeclares = decoratorNames(node).some((n) => DECLARING.has(n));

        for (const member of node.members) {
          if (!ts.isMethodDeclaration(member) || !member.name) continue;

          const names = decoratorNames(member);
          const isRoute = names.some((n) => ROUTE_DECORATORS.has(n));
          if (!isRoute) continue;

          const guarded = classGuarded || usesEntitlementsGuard(member);
          if (!guarded) continue;

          const declares = classDeclares || names.some((n) => DECLARING.has(n));
          if (!declares) {
            offenders.push(
              `${node.name.text}.${member.name.getText(source)} (${relative(srcRoot, file)})`,
            );
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
