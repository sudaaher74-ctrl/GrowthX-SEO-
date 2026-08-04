import { SetMetadata, applyDecorators } from '@nestjs/common';
import { UsageMetric } from '@prisma/client';
import { Feature } from './plans.catalog';

export const REQUIRED_FEATURES_KEY = 'billing:features';
export const REQUIRED_QUOTA_KEY = 'billing:quota';
export const ORG_SOURCE_KEY = 'billing:orgSource';

/** Resources the guard knows how to trace back to an owning organization. */
export type OrgResource = 'organization' | 'project' | 'website' | 'crawlJob' | 'issue';

export interface OrgSource {
  resource: OrgResource;
  /** Route param holding the resource id, e.g. `:id`. */
  param: string;
}

export interface RequiredQuota {
  metric: UsageMetric;
  amount: number;
}

/** Denies the request unless the caller's plan includes every listed feature. */
export const RequiresFeature = (...features: Feature[]) => SetMetadata(REQUIRED_FEATURES_KEY, features);

/**
 * Denies the request when the allowance for `metric` is already spent.
 * The guard only *checks*; services call `EntitlementsService.recordUsage`
 * after the work succeeds.
 */
export const RequiresQuota = (metric: UsageMetric, amount = 1) =>
  SetMetadata(REQUIRED_QUOTA_KEY, { metric, amount } satisfies RequiredQuota);

/**
 * Tells the guard how to find the owning organization for routes that identify
 * a resource rather than an org, e.g. `POST /issues/:id/autofix`.
 */
export const OrgFrom = (resource: OrgResource, param = 'id') =>
  SetMetadata(ORG_SOURCE_KEY, { resource, param } satisfies OrgSource);

/** Convenience wrapper for the common "gate this on a feature + a quota" case. */
export const Metered = (feature: Feature, metric: UsageMetric, amount = 1) =>
  applyDecorators(RequiresFeature(feature), RequiresQuota(metric, amount));
