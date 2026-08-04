"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metered = exports.OrgFrom = exports.RequiresQuota = exports.RequiresFeature = exports.ORG_SOURCE_KEY = exports.REQUIRED_QUOTA_KEY = exports.REQUIRED_FEATURES_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIRED_FEATURES_KEY = 'billing:features';
exports.REQUIRED_QUOTA_KEY = 'billing:quota';
exports.ORG_SOURCE_KEY = 'billing:orgSource';
/** Denies the request unless the caller's plan includes every listed feature. */
const RequiresFeature = (...features) => (0, common_1.SetMetadata)(exports.REQUIRED_FEATURES_KEY, features);
exports.RequiresFeature = RequiresFeature;
/**
 * Denies the request when the allowance for `metric` is already spent.
 * The guard only *checks*; services call `EntitlementsService.recordUsage`
 * after the work succeeds.
 */
const RequiresQuota = (metric, amount = 1) => (0, common_1.SetMetadata)(exports.REQUIRED_QUOTA_KEY, { metric, amount });
exports.RequiresQuota = RequiresQuota;
/**
 * Tells the guard how to find the owning organization for routes that identify
 * a resource rather than an org, e.g. `POST /issues/:id/autofix`.
 */
const OrgFrom = (resource, param = 'id') => (0, common_1.SetMetadata)(exports.ORG_SOURCE_KEY, { resource, param });
exports.OrgFrom = OrgFrom;
/** Convenience wrapper for the common "gate this on a feature + a quota" case. */
const Metered = (feature, metric, amount = 1) => (0, common_1.applyDecorators)((0, exports.RequiresFeature)(feature), (0, exports.RequiresQuota)(metric, amount));
exports.Metered = Metered;
//# sourceMappingURL=entitlements.decorator.js.map