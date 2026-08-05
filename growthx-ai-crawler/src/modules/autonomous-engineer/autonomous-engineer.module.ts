import { Module, forwardRef } from '@nestjs/common';
import { OrchestratorService } from './orchestrator/orchestrator.service';
import { GitService } from './agents/git/git.service';
import { PatchGenerationService } from './agents/patch-generation/patch-generation.service';
import { ValidationService } from './agents/validation/validation.service';
import { FileSelectionService } from './agents/file-selection/file-selection.service';
import { RepositoryUnderstandingService } from './agents/repository-understanding/repository-understanding.service';
import { IssueAnalysisService } from './agents/issue-analysis/issue-analysis.service';
import { VerificationService } from './agents/verification/verification.service';
import { RepositoryGraphModule } from '../repository-graph/repository-graph.module';
import { AiSearchModule } from '../ai-search/ai-search.module';

@Module({
  imports: [
    RepositoryGraphModule,
    forwardRef(() => AiSearchModule),
  ],
  providers: [
    OrchestratorService,
    GitService,
    PatchGenerationService,
    ValidationService,
    FileSelectionService,
    RepositoryUnderstandingService,
    IssueAnalysisService,
    VerificationService
  ],
  exports: [
    OrchestratorService,
    GitService,
    PatchGenerationService,
    ValidationService,
    RepositoryUnderstandingService,
  ]
})
export class AutonomousEngineerModule {}
