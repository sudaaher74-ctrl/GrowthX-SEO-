"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutonomousEngineerModule = void 0;
const common_1 = require("@nestjs/common");
const repository_understanding_service_1 = require("./agents/repository-understanding/repository-understanding.service");
const issue_analysis_service_1 = require("./agents/issue-analysis/issue-analysis.service");
const file_selection_service_1 = require("./agents/file-selection/file-selection.service");
const patch_generation_service_1 = require("./agents/patch-generation/patch-generation.service");
const validation_service_1 = require("./agents/validation/validation.service");
const git_service_1 = require("./agents/git/git.service");
const verification_service_1 = require("./agents/verification/verification.service");
const orchestrator_service_1 = require("./orchestrator/orchestrator.service");
let AutonomousEngineerModule = class AutonomousEngineerModule {
};
exports.AutonomousEngineerModule = AutonomousEngineerModule;
exports.AutonomousEngineerModule = AutonomousEngineerModule = __decorate([
    (0, common_1.Module)({
        providers: [
            repository_understanding_service_1.RepositoryUnderstandingService,
            issue_analysis_service_1.IssueAnalysisService,
            file_selection_service_1.FileSelectionService,
            patch_generation_service_1.PatchGenerationService,
            validation_service_1.ValidationService,
            git_service_1.GitService,
            verification_service_1.VerificationService,
            orchestrator_service_1.OrchestratorService
        ],
        exports: [orchestrator_service_1.OrchestratorService]
    })
], AutonomousEngineerModule);
//# sourceMappingURL=autonomous-engineer.module.js.map