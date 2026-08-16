import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import {
  NO_ENTITLEMENT_KEY,
  REQUIRED_FEATURES_KEY,
  REQUIRED_QUOTA_KEY,
} from './entitlements.decorator';

/**
 * Checks at boot that every entitlement-guarded route declares what it needs.
 *
 * `EntitlementsGuard` already refuses such a route, but it does so on the
 * request — meaning the first person to find the mistake is a customer getting
 * a 500. This walks the controllers once at startup and fails the process
 * instead, so the mistake surfaces in a deploy log.
 */
@Injectable()
export class EntitlementsAuditService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EntitlementsAuditService.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const undeclared = this.findUndeclaredRoutes();

    if (undeclared.length > 0) {
      const list = undeclared.map((r) => `  - ${r}`).join('\n');
      this.logger.error(
        `These routes use EntitlementsGuard but declare no plan requirement:\n${list}\n` +
          'Add @RequiresFeature/@Metered, or @NoEntitlement("reason") if the route genuinely needs no gate.',
      );
      throw new Error(`${undeclared.length} entitlement-guarded route(s) declare no plan requirement.`);
    }

    this.logger.log('Entitlement audit passed: every guarded route declares a plan requirement.');
  }

  /** Returns "ControllerName.methodName" for each offending handler. */
  findUndeclaredRoutes(): string[] {
    const offenders: string[] = [];

    for (const wrapper of this.discovery.getControllers()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;

      const guards = [
        ...(this.reflector.get<any[]>('__guards__', metatype) ?? []),
      ];
      const classGuarded = guards.some((g) => g?.name === 'EntitlementsGuard');

      const prototype = Object.getPrototypeOf(instance);
      const methods = this.scanner.getAllMethodNames
        ? this.scanner.getAllMethodNames(prototype)
        : Object.getOwnPropertyNames(prototype).filter((m) => m !== 'constructor');

      for (const method of methods) {
        const handler = prototype[method];
        if (typeof handler !== 'function') continue;
        // Only actual routes matter; helpers on a controller have no path.
        if (this.reflector.get('path', handler) === undefined) continue;

        const methodGuards = this.reflector.get<any[]>('__guards__', handler) ?? [];
        const guarded = classGuarded || methodGuards.some((g) => g?.name === 'EntitlementsGuard');
        if (!guarded) continue;

        const declared =
          this.reflector.getAllAndOverride(REQUIRED_FEATURES_KEY, [handler, metatype]) ||
          this.reflector.getAllAndOverride(REQUIRED_QUOTA_KEY, [handler, metatype]) ||
          this.reflector.getAllAndOverride(NO_ENTITLEMENT_KEY, [handler, metatype]);

        if (!declared) offenders.push(`${metatype.name}.${method}`);
      }
    }

    return offenders;
  }
}
