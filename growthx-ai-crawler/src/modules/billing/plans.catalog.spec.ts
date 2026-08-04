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
  it('prices the two self-serve tiers at ₹2,000 and ₹5,000', () => {
    expect(SELF_SERVE_PLANS).toEqual([PlanType.STARTER, PlanType.PRO]);
    expect(PLAN_CATALOG[PlanType.STARTER].amountPaise).toBe(200_000);
    expect(PLAN_CATALOG[PlanType.PRO].amountPaise).toBe(500_000);
    expect(formatInr(200_000)).toBe('₹2,000');
    expect(formatInr(500_000)).toBe('₹5,000');
  });

  describe('STARTER (₹2,000): crawl + Gemini only', () => {
    it.each([Feature.CRAWL, Feature.AI_RECOMMENDATIONS, Feature.MODEL_GEMINI])('includes %s', (feature) => {
      expect(planHasFeature(PlanType.STARTER, feature)).toBe(true);
    });

    it.each([
      Feature.MODEL_GPT,
      Feature.MODEL_CLAUDE,
      Feature.AUTO_FIX_PATCH,
      Feature.AUTO_FIX_DEPLOY,
      Feature.AI_VISIBILITY,
      Feature.MARKET_STRATEGY,
      Feature.COMPETITOR_TRACKING,
    ])('excludes %s', (feature) => {
      expect(planHasFeature(PlanType.STARTER, feature)).toBe(false);
    });

    it('grants no allowance for Pro-only metered work', () => {
      expect(quotaFor(PlanType.STARTER, UsageMetric.AUTO_FIXES)).toBe(0);
      expect(quotaFor(PlanType.STARTER, UsageMetric.AI_VISIBILITY_CHECKS)).toBe(0);
      expect(quotaFor(PlanType.STARTER, UsageMetric.STRATEGY_REPORTS)).toBe(0);
    });
  });

  describe('PRO (₹5,000): all three models plus shipping fixes', () => {
    it.each([
      Feature.MODEL_GEMINI,
      Feature.MODEL_GPT,
      Feature.MODEL_CLAUDE,
      Feature.AUTO_FIX_PATCH,
      Feature.AUTO_FIX_DEPLOY,
      Feature.AI_VISIBILITY,
      Feature.MARKET_STRATEGY,
    ])('includes %s', (feature) => {
      expect(planHasFeature(PlanType.PRO, feature)).toBe(true);
    });

    it('is a strict superset of STARTER', () => {
      for (const feature of PLAN_CATALOG[PlanType.STARTER].features) {
        expect(planHasFeature(PlanType.PRO, feature)).toBe(true);
      }
    });

    it('raises every allowance above STARTER', () => {
      expect(quotaFor(PlanType.PRO, UsageMetric.CRAWL_PAGES)).toBeGreaterThan(
        quotaFor(PlanType.STARTER, UsageMetric.CRAWL_PAGES)!,
      );
      expect(quotaFor(PlanType.PRO, UsageMetric.AI_ANALYSES)).toBeGreaterThan(
        quotaFor(PlanType.STARTER, UsageMetric.AI_ANALYSES)!,
      );
    });
  });

  it('points upgrade prompts at the cheapest plan that unlocks a feature', () => {
    expect(cheapestPlanWith(Feature.MODEL_GEMINI)?.plan).toBe(PlanType.STARTER);
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
