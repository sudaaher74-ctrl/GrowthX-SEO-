"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../database/database.module");
const ai_search_module_1 = require("../ai-search/ai-search.module");
const autonomous_engineer_module_1 = require("../autonomous-engineer/autonomous-engineer.module");
const security_module_1 = require("../security/security.module");
const strategy_module_1 = require("../strategy/strategy.module");
const automation_controller_1 = require("./automation.controller");
const automation_service_1 = require("./automation.service");
const content_generation_service_1 = require("./content-generation.service");
let AutomationModule = class AutomationModule {
};
exports.AutomationModule = AutomationModule;
exports.AutomationModule = AutomationModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule, ai_search_module_1.AiSearchModule, autonomous_engineer_module_1.AutonomousEngineerModule, security_module_1.SecurityModule, strategy_module_1.StrategyModule],
        controllers: [automation_controller_1.AutomationController],
        providers: [automation_service_1.AutomationService, content_generation_service_1.ContentGenerationService],
        exports: [automation_service_1.AutomationService, content_generation_service_1.ContentGenerationService],
    })
], AutomationModule);
//# sourceMappingURL=automation.module.js.map