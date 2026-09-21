# Dispatch: Worker M1 - Website Audit Unit Test Suites

## Identity
- Role: Worker (Website Audit Test Writer)
- TypeName: teamwork_preview_worker
- Working Directory: /Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_worker_m1

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mission & Scope
Implement complete, rigorous unit test suites for Website Audit core models and services in `growthx-ai-crawler/`:
1. `src/modules/analyzer/link-analyzer.service.spec.ts` (invoking Link and Page logic)
2. `src/modules/validator/validator.service.spec.ts` (invoking Website validation logic)
3. `src/modules/sitemap/sitemap.service.spec.ts` (invoking Sitemap parsing and Page discovery)
4. `src/modules/history/history.service.spec.ts` (invoking CrawlJob and Issue diffing logic)
5. `src/modules/performance/performance.service.spec.ts` (invoking Performance and Page metrics upsert)

## Exclusive File Ownership
You exclusively own:
- `growthx-ai-crawler/src/modules/analyzer/link-analyzer.service.spec.ts`
- `growthx-ai-crawler/src/modules/validator/validator.service.spec.ts`
- `growthx-ai-crawler/src/modules/sitemap/sitemap.service.spec.ts`
- `growthx-ai-crawler/src/modules/history/history.service.spec.ts`
- `growthx-ai-crawler/src/modules/performance/performance.service.spec.ts`

Do NOT touch any other files or modules.

## Technical Specifications & Blueprints
Read the detailed blueprints, test cases, and mock examples in:
- `/Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_explorer_survey_2_gen2/handoff.md` (Sections 4.2 to 4.6)
- `/Users/milquu/Documents/Coding Projects/AI Seo/.agents/ORIGINAL_REQUEST.md`
- `/Users/milquu/Documents/Coding Projects/AI Seo/.agents/PROJECT.md`

## Verification Requirements
1. Run test command: `npm test -- src/modules/analyzer/link-analyzer.service.spec.ts src/modules/validator/validator.service.spec.ts src/modules/sitemap/sitemap.service.spec.ts src/modules/history/history.service.spec.ts src/modules/performance/performance.service.spec.ts` inside `growthx-ai-crawler/`.
2. Ensure 100% of newly written tests pass with 0 syntax or import errors.
3. Verify that tests invoke the underlying models (`Link`, `Page`, `Website`, `CrawlJob`, `Issue`, `Performance`).
4. Document the exact commands run and output in your handoff report at `/Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_worker_m1/handoff.md`.
5. Notify orchestrator via send_message when done.

## 2026-09-21T06:15:30Z
<USER_REQUEST>
You are teamwork_preview_worker_m1.
Your working directory is /Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_worker_m1.
Read /Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_worker_m1/DISPATCH.md, /Users/milquu/Documents/Coding Projects/AI Seo/.agents/ORIGINAL_REQUEST.md, and /Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_explorer_survey_2_gen2/handoff.md.

Implement the unit test suites for Website Audit core models and services in growthx-ai-crawler/:
1. src/modules/analyzer/link-analyzer.service.spec.ts
2. src/modules/validator/validator.service.spec.ts
3. src/modules/sitemap/sitemap.service.spec.ts
4. src/modules/history/history.service.spec.ts
5. src/modules/performance/performance.service.spec.ts

Run tests inside growthx-ai-crawler/:
npm test -- src/modules/analyzer/link-analyzer.service.spec.ts src/modules/validator/validator.service.spec.ts src/modules/sitemap/sitemap.service.spec.ts src/modules/history/history.service.spec.ts src/modules/performance/performance.service.spec.ts

Ensure all tests pass cleanly. Write your report to /Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_worker_m1/handoff.md and notify orchestrator via send_message.
</USER_REQUEST>
