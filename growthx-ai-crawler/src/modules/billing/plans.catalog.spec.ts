import { PlanType, UsageMetric } from '@prisma/client';
import {
  Feature,
  PLAN_CATALOG,
  SELF_SERVE_PLANS,
  cheapestPlanWith,
  formatInr,
  planHasFeature,
  quotaFor,
} from './plans.catalog';

describe('plans catalog', () => {
  it('prices the three self-serve tiers at ₹1,999, ₹4,999 and ₹6,999', () => {
    expect(SELF_SERVE_PLANS).toEqual([PlanType.STARTER, PlanType.GROWTH, PlanType.PRO]);
    expect(PLAN_CATALOG[PlanType.STARTER].amountPaise).toBe(199_900);
    expect(PLAN_CATALOG[PlanType.GROWTH].amountPaise).toBe(499_900);
    expect(PLAN_CATALOG[PlanType.PRO].amountPaise).toBe(699_900);
    expect(formatInr(199_900)).toBe('₹1,999');
    expect(formatInr(499_900)).toBe('₹4,999');
    expect(formatInr(699_900)).toBe('₹6,999');
  });

  describe('STARTER (₹1,999): crawl + Gemini + basic competitor visibility', () => {
    it.each([Feature.CRAWL, Feature.AI_RECOMMENDATIONS, Feature.MODEL_GEMINI, Feature.COMPETITOR_TRACKING])(
      'includes %s',
      (feature) => {
        expect(planHasFeature(PlanType.STARTER, feature)).toBe(true);
      },
    );

    it.each([
      Feature.MODEL_GPT,
      Feature.MODEL_CLAUDE,
      Feature.AUTO_FIX_PATCH,
      Feature.AUTO_FIX_DEPLOY,
      Feature.AI_VISIBILITY,
      Feature.MARKET_STRATEGY,
      Feature.API_ACCESS,
    ])('excludes %s', (feature) => {
      expect(planHasFeature(PlanType.STARTER, feature)).toBe(false);
    });

    it('grants no allowance for Growth/Pro-only metered work', () => {
      expect(quotaFor(PlanType.STARTER, UsageMetric.AUTO_FIXES)).toBe(0);
      expect(quotaFor(PlanType.STARTER, UsageMetric.AI_VISIBILITY_CHECKS)).toBe(0);
      expect(quotaFor(PlanType.STARTER, UsageMetric.STRATEGY_REPORTS)).toBe(0);
    });
  });

  describe('GROWTH (₹4,999): GPT, AI visibility, market & content strategy', () => {
    it.each([Feature.MODEL_GPT, Feature.AI_VISIBILITY, Feature.MARKET_STRATEGY, Feature.COMPETITOR_TRACKING])(
      'includes %s',
      (feature) => {
        expect(planHasFeature(PlanType.GROWTH, feature)).toBe(true);
      },
    );

    it.each([Feature.MODEL_CLAUDE, Feature.AUTO_FIX_PATCH, Feature.AUTO_FIX_DEPLOY, Feature.API_ACCESS])(
      'excludes %s — shipping code starts at Pro',
      (feature) => {
        expect(planHasFeature(PlanType.GROWTH, feature)).toBe(false);
      },
    );

    it('is a strict superset of STARTER', () => {
      for (const feature of PLAN_CATALOG[PlanType.STARTER].features) {
        expect(planHasFeature(PlanType.GROWTH, feature)).toBe(true);
      }
    });
  });

  describe('PRO (₹6,999): Claude, repository analysis and shipped fixes', () => {
    it.each([
      Feature.MODEL_GEMINI,
      Feature.MODEL_GPT,
      Feature.MODEL_CLAUDE,
      Feature.AUTO_FIX_PATCH,
      Feature.AUTO_FIX_DEPLOY,
      Feature.AI_VISIBILITY,
      Feature.MARKET_STRATEGY,
      Feature.API_ACCESS,
    ])('includes %s', (feature) => {
      expect(planHasFeature(PlanType.PRO, feature)).toBe(true);
    });

    it('is a strict superset of GROWTH', () => {
      for (const feature of PLAN_CATALOG[PlanType.GROWTH].features) {
        expect(planHasFeature(PlanType.PRO, feature)).toBe(true);
      }
    });

    it('raises every allowance above GROWTH', () => {
      expect(quotaFor(PlanType.PRO, UsageMetric.CRAWL_PAGES)).toBeGreaterThan(
        quotaFor(PlanType.GROWTH, UsageMetric.CRAWL_PAGES)!,
      );
      expect(quotaFor(PlanType.PRO, UsageMetric.AI_ANALYSES)).toBeGreaterThan(
        quotaFor(PlanType.GROWTH, UsageMetric.AI_ANALYSES)!,
      );
    });
  });

  it('points upgrade prompts at the cheapest plan that unlocks a feature', () => {
    expect(cheapestPlanWith(Feature.MODEL_GEMINI)?.plan).toBe(PlanType.STARTER);
    expect(cheapestPlanWith(Feature.MARKET_STRATEGY)?.plan).toBe(PlanType.GROWTH);
    expect(cheapestPlanWith(Feature.MODEL_CLAUDE)?.plan).toBe(PlanType.PRO);
    expect(cheapestPlanWith(Feature.AUTO_FIX_DEPLOY)?.plan).toBe(PlanType.PRO);
    // Enterprise-only features have no self-serve upgrade path.
    expect(cheapestPlanWith(Feature.WHITE_LABEL_REPORTS)).toBeNull();
  });

  it('leaves FREE with crawling only', () => {
    expect([...PLAN_CATALOG[PlanType.FREE].features]).toEqual([Feature.CRAWL]);
    expect(quotaFor(PlanType.FREE, UsageMetric.AI_ANALYSES)).toBe(0);
  });

  it('gives ENTERPRISE unlimited quotas', () => {
    for (const metric of Object.values(UsageMetric)) {
      expect(quotaFor(PlanType.ENTERPRISE, metric)).toBeNull();
    }
  });
});
