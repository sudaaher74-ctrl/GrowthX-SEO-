import * as fs from 'fs';
import * as path from 'path';

/**
 * The boot audit, run against the real controllers.
 *
 * `EntitlementsAuditService` already fails the process when a guarded route
 * declares no plan requirement, and `entitlements-audit.service.spec.ts` proves
 * that logic works — but only against fixture controllers declared inside the
 * test. So when the Content Intelligence and Market Research controllers
 * shipped 54 guarded-but-undeclared routes, `npm run build` was clean and all
 * 420 tests passed while the API could not start at all.
 *
 * Nothing in the suite boots AppModule (it needs a database), so this reads the
 * controller sources instead — the same approach as `no-fabricated-data.spec.ts`.
 * It is a coarser check than the runtime audit, and deliberately so: it needs no
 * DI container, so it runs in CI on every commit.
 */

const MODULES = path.join(__dirname, '..');

const ROUTE_DECORATOR = /^\s*@(Get|Post|Put|Patch|Delete)\s*\(/;
const DECLARATION = /@(RequiresFeature|RequiresQuota|Metered|NoEntitlement)\s*\(/;
const HANDLER = /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/;

function controllerFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return controllerFiles(full);
      return entry.isFile() && entry.name.endsWith('.controller.ts') ? [full] : [];
    });
}

/** "Controller.handler" for each guarded route that declares no requirement. */
function undeclaredRoutes(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('EntitlementsGuard')) return [];

  const lines = source.split('\n');
  const controller = path.basename(file).replace('.controller.ts', '');

  // A declaration above the `export class` line covers every route in the file.
  const classLine = lines.findIndex((line) => /^export class /.test(line));
  const classDeclares = lines.slice(0, classLine).some((line) => DECLARATION.test(line));
  const classGuarded = lines
    .slice(0, classLine)
    .some((line) => line.includes('@UseGuards') && line.includes('EntitlementsGuard'));

  const offenders: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!ROUTE_DECORATOR.test(lines[i])) continue;

    // Walk the decorator block below the route decorator, up to the handler.
    let declared = classDeclares;
    let guarded = classGuarded;
    let name = '(unknown)';

    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (DECLARATION.test(line)) declared = true;
      if (line.includes('@UseGuards') && line.includes('EntitlementsGuard')) guarded = true;
      // Skip anything that is not the handler signature itself: further
      // decorators, their wrapped argument lines, blank lines, and comments —
      // a `//` explaining the gate sits between the two often enough that
      // stopping there would report every such route as undeclared.
      const trimmed = line.trim();
      const isComment = trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
      if (trimmed.startsWith('@') || trimmed === '' || isComment || /^\s*[)\]}]/.test(line)) continue;

      const match = HANDLER.exec(line);
      if (match) name = match[1];
      break;
    }

    if (guarded && !declared) offenders.push(`${controller}.${name}`);
  }

  return offenders;
}

describe('entitlement declarations', () => {
  it('every EntitlementsGuard-protected route declares a plan requirement', () => {
    const offenders = controllerFiles(MODULES).flatMap(undeclaredRoutes);

    // Named rather than counted: the message has to say which route to fix.
    expect(offenders).toEqual([]);
  });

  it('finds the controllers it is supposed to be checking', () => {
    // Guards against the scan silently matching nothing after a refactor and
    // passing for the wrong reason.
    const guarded = controllerFiles(MODULES).filter((file) =>
      fs.readFileSync(file, 'utf8').includes('EntitlementsGuard'),
    );

    expect(guarded.length).toBeGreaterThan(10);
  });
});
