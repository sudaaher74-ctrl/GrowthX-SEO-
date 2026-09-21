# Dispatch: Worker M2 - Google Business Profile Unit Test Suites

## Identity
- Role: Worker (GBP Test Writer)
- TypeName: teamwork_preview_worker
- Working Directory: /Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_worker_m2

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mission & Scope
Implement complete, rigorous unit test suites for Google Business Profile (GBP) core models and services in `growthx-ai-crawler/`:
1. `src/modules/local-seo/gbp-analyzer.service.spec.ts` (invoking GbpFixProposal and Project models)
2. `src/modules/local-seo/gbp-autofix.service.spec.ts` (invoking GbpFixProposal state transitions PENDING -> APPROVED -> PUSHED / REJECTED)
3. `src/modules/local-seo/reviews.service.spec.ts` (invoking LocalReview and Integration models)
4. `src/modules/local-seo/local-seo-connect.spec.ts` (invoking LocalLocation model upsert)

## Exclusive File Ownership
You exclusively own:
- `growthx-ai-crawler/src/modules/local-seo/gbp-analyzer.service.spec.ts`
- `growthx-ai-crawler/src/modules/local-seo/gbp-autofix.service.spec.ts`
- `growthx-ai-crawler/src/modules/local-seo/reviews.service.spec.ts`
- `growthx-ai-crawler/src/modules/local-seo/local-seo-connect.spec.ts`

Do NOT touch any other files or modules.

## Technical Specifications & Blueprints
Read the detailed blueprints, test cases, and mock examples in:
- `/Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_explorer_survey_3_gen2/handoff.md` (Sections 4 & 5)
- `/Users/milquu/Documents/Coding Projects/AI Seo/.agents/ORIGINAL_REQUEST.md`
- `/Users/milquu/Documents/Coding Projects/AI Seo/.agents/PROJECT.md`
- Reference existing GBP tests in `src/modules/integrations/google/business-profile.service.spec.ts` and `src/modules/integrations/google/business-profile.testing.ts` (`fakePrisma()` helper).

## Verification Requirements
1. Run test command: `npm test -- src/modules/local-seo/gbp-analyzer.service.spec.ts src/modules/local-seo/gbp-autofix.service.spec.ts src/modules/local-seo/reviews.service.spec.ts src/modules/local-seo/local-seo-connect.spec.ts` inside `growthx-ai-crawler/`.
2. Ensure 100% of newly written tests pass with 0 syntax or import errors.
3. Verify that tests invoke the underlying models (`GbpFixProposal`, `LocalReview`, `LocalLocation`, `Integration`).
4. Document the exact commands run and output in your handoff report at `/Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_worker_m2/handoff.md`.
5. Notify orchestrator via send_message when done.

## 2026-09-21T06:15:30Z
You are teamwork_preview_worker_m2.
Your working directory is /Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_worker_m2.
Read /Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_worker_m2/DISPATCH.md, /Users/milquu/Documents/Coding Projects/AI Seo/.agents/ORIGINAL_REQUEST.md, and /Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_explorer_survey_3_gen2/handoff.md.

Implement the unit test suites for Google Business Profile core models and services in growthx-ai-crawler/:
1. src/modules/local-seo/gbp-analyzer.service.spec.ts
2. src/modules/local-seo/gbp-autofix.service.spec.ts
3. src/modules/local-seo/reviews.service.spec.ts
4. src/modules/local-seo/local-seo-connect.spec.ts

Run tests inside growthx-ai-crawler/:
npm test -- src/modules/local-seo/gbp-analyzer.service.spec.ts src/modules/local-seo/gbp-autofix.service.spec.ts src/modules/local-seo/reviews.service.spec.ts src/modules/local-seo/local-seo-connect.spec.ts

Ensure all tests pass cleanly. Write your report to /Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_worker_m2/handoff.md and notify orchestrator via send_message.
