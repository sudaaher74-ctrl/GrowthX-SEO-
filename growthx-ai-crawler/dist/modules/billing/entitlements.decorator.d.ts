import { UsageMetric } from '@prisma/client';
import { Feature } from './plans.catalog';
export declare const REQUIRED_FEATURES_KEY = "billing:features";
export declare const REQUIRED_QUOTA_KEY = "billing:quota";
export declare const ORG_SOURCE_KEY = "billing:orgSource";
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
export declare const RequiresFeature: (...features: Feature[]) => import("@nestjs/common").CustomDecorator<string>;
/**
 * Denies the request when the allowance for `metric` is already spent.
 * The guard only *checks*; services call `EntitlementsService.recordUsage`
 * after the work succeeds.
 */
export declare const RequiresQuota: (metric: UsageMetric, amount?: number) => import("@nestjs/common").CustomDecorator<string>;
/**
 * Tells the guard how to find the owning organization for routes that identify
 * a resource rather than an org, e.g. `POST /issues/:id/autofix`.
 */
export declare const OrgFrom: (resource: OrgResource, param?: string) => import("@nestjs/common").CustomDecorator<string>;
/** Convenience wrapper for the common "gate this on a feature + a quota" case. */
export declare const Metered: (feature: Feature, metric: UsageMetric, amount?: number) => <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
