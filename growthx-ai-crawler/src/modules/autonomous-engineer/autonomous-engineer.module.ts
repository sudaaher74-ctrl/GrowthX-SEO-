import { Module } from '@nestjs/common';
import { RepositoryUnderstandingService } from './agents/repository-understanding/repository-understanding.service';
import { IssueAnalysisService } from './agents/issue-analysis/issue-analysis.service';
import { FileSelectionService } from './agents/file-selection/file-selection.service';
import { PatchGenerationService } from './agents/patch-generation/patch-generation.service';
import { ValidationService } from './agents/validation/validation.service';
import { GitService } from './agents/git/git.service';
import { VerificationService } from './agents/verification/verification.service';
import { OrchestratorService } from './orchestrator/orchestrator.service';

@Module({
  providers: [
    RepositoryUnderstandingService,
    IssueAnalysisService,
    FileSelectionService,
    PatchGenerationService,
    ValidationService,
    GitService,
    VerificationService,
    OrchestratorService
  ],
  exports: [OrchestratorService]
})
export class AutonomousEngineerModule {}
