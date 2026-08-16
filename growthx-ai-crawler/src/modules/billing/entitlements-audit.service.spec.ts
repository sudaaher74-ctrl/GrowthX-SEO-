import { Controller, Get, UseGuards } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementsAuditService } from './entitlements-audit.service';
import { EntitlementsGuard } from './entitlements.guard';
import { EntitlementsService } from './entitlements.service';
import { OrgContextService } from './org-context.service';
import { NoEntitlement, RequiresFeature } from './entitlements.decorator';
import { Feature } from './plans.catalog';

// Stand-ins for the real thing: guarded controllers in each of the three
// states the audit has to tell apart.
@Controller('declared')
@UseGuards(EntitlementsGuard)
class DeclaredController {
  @Get()
  @RequiresFeature(Feature.MARKET_STRATEGY)
  handler() {
    return 'ok';
  }
}

@Controller('exempt')
@UseGuards(EntitlementsGuard)
@NoEntitlement('core workspace route')
class ExemptController {
  @Get()
  handler() {
    return 'ok';
  }
}

@Controller('undeclared')
@UseGuards(EntitlementsGuard)
class UndeclaredController {
  @Get()
  handler() {
    return 'ok';
  }
}

@Controller('ungarded')
class UnguardedController {
  @Get()
  handler() {
    return 'ok';
  }
}

async function auditWith(controllers: any[]): Promise<EntitlementsAuditService> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [DiscoveryModule],
    controllers,
    providers: [
      EntitlementsAuditService,
      // The guard is instantiated because the controllers reference it, but the
      // audit only reads metadata — it never calls through.
      EntitlementsGuard,
      { provide: EntitlementsService, useValue: { assertFeature: jest.fn(), assertQuota: jest.fn() } },
      { provide: OrgContextService, useValue: { resolve: jest.fn() } },
    ],
  }).compile();
  // Deliberately not calling module.init(): that fires onApplicationBootstrap,
  // which is the behaviour under test. compile() is enough for discovery.
  return module.get(EntitlementsAuditService);
}

describe('EntitlementsAuditService', () => {
  it('accepts a guarded route that declares a feature', async () => {
    const audit = await auditWith([DeclaredController]);

    expect(audit.findUndeclaredRoutes()).toEqual([]);
  });

  it('accepts a guarded route explicitly exempted', async () => {
    const audit = await auditWith([ExemptController]);

    expect(audit.findUndeclaredRoutes()).toEqual([]);
  });

  it('ignores a route that is not entitlement guarded', async () => {
    const audit = await auditWith([UnguardedController]);

    expect(audit.findUndeclaredRoutes()).toEqual([]);
  });

  // The point of the whole service: catch this at boot rather than letting a
  // customer discover it as a 500.
  it('reports a guarded route that declares nothing', async () => {
    const audit = await auditWith([UndeclaredController]);

    expect(audit.findUndeclaredRoutes()).toEqual(['UndeclaredController.handler']);
  });

  it('fails application bootstrap when a route is undeclared', async () => {
    const audit = await auditWith([UndeclaredController]);

    expect(() => audit.onApplicationBootstrap()).toThrow(/declare no plan requirement/);
  });

  it('lets bootstrap proceed when every route is declared', async () => {
    const audit = await auditWith([DeclaredController, ExemptController, UnguardedController]);

    expect(() => audit.onApplicationBootstrap()).not.toThrow();
  });
});
