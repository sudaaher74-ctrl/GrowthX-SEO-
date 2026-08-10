"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../database/database.module");
const billing_controller_1 = require("./billing.controller");
const billing_service_1 = require("./billing.service");
const entitlements_guard_1 = require("./entitlements.guard");
const entitlements_service_1 = require("./entitlements.service");
const org_context_service_1 = require("./org-context.service");
const razorpay_service_1 = require("./razorpay.service");
/**
 * Global so any module can gate a route with `EntitlementsGuard` or record
 * usage without re-importing billing everywhere.
 */
let BillingModule = class BillingModule {
};
exports.BillingModule = BillingModule;
exports.BillingModule = BillingModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule],
        controllers: [billing_controller_1.BillingController],
        providers: [billing_service_1.BillingService, entitlements_service_1.EntitlementsService, org_context_service_1.OrgContextService, razorpay_service_1.RazorpayService, entitlements_guard_1.EntitlementsGuard],
        exports: [billing_service_1.BillingService, entitlements_service_1.EntitlementsService, org_context_service_1.OrgContextService, razorpay_service_1.RazorpayService, entitlements_guard_1.EntitlementsGuard],
    })
], BillingModule);
//# sourceMappingURL=billing.module.js.map