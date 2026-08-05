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
const orchestrator_service_1 = require("./orchestrator/orchestrator.service");
const git_service_1 = require("./agents/git/git.service");
const patch_generation_service_1 = require("./agents/patch-generation/patch-generation.service");
const validation_service_1 = require("./agents/validation/validation.service");
const file_selection_service_1 = require("./agents/file-selection/file-selection.service");
const repository_understanding_service_1 = require("./agents/repository-understanding/repository-understanding.service");
const issue_analysis_service_1 = require("./agents/issue-analysis/issue-analysis.service");
const verification_service_1 = require("./agents/verification/verification.service");
const repository_graph_module_1 = require("../repository-graph/repository-graph.module");
const ai_search_module_1 = require("../ai-search/ai-search.module");
let AutonomousEngineerModule = class AutonomousEngineerModule {
};
exports.AutonomousEngineerModule = AutonomousEngineerModule;
exports.AutonomousEngineerModule = AutonomousEngineerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            repository_graph_module_1.RepositoryGraphModule,
            (0, common_1.forwardRef)(() => ai_search_module_1.AiSearchModule),
        ],
        providers: [
            orchestrator_service_1.OrchestratorService,
            git_service_1.GitService,
            patch_generation_service_1.PatchGenerationService,
            validation_service_1.ValidationService,
            file_selection_service_1.FileSelectionService,
            repository_understanding_service_1.RepositoryUnderstandingService,
            issue_analysis_service_1.IssueAnalysisService,
            verification_service_1.VerificationService
        ],
        exports: [
            orchestrator_service_1.OrchestratorService,
            git_service_1.GitService,
            patch_generation_service_1.PatchGenerationService,
            validation_service_1.ValidationService,
            repository_understanding_service_1.RepositoryUnderstandingService,
        ]
    })
], AutonomousEngineerModule);
//# sourceMappingURL=autonomous-engineer.module.js.map