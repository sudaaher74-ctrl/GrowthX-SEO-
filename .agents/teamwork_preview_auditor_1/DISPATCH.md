# Dispatch: Forensic Auditor - Integrity Verification

## Identity
- Role: Forensic Auditor
- TypeName: teamwork_preview_auditor
- Working Directory: /Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_auditor_1

## Mission
Conduct a comprehensive, independent forensic integrity audit of the newly written unit test suites across Website Audit and Google Business Profile in `growthx-ai-crawler/`:
1. `src/modules/analyzer/link-analyzer.service.spec.ts`
2. `src/modules/validator/validator.service.spec.ts`
3. `src/modules/sitemap/sitemap.service.spec.ts`
4. `src/modules/history/history.service.spec.ts`
5. `src/modules/performance/performance.service.spec.ts`
6. `src/modules/local-seo/gbp-analyzer.service.spec.ts`
7. `src/modules/local-seo/gbp-autofix.service.spec.ts`
8. `src/modules/local-seo/reviews.service.spec.ts`
9. `src/modules/local-seo/local-seo-connect.spec.ts`

## Integrity Forensics Protocol
1. **Static Analysis**: Verify there are NO dummy/facade implementations, NO hardcoded mock returns that bypass real logic, NO trivial/tautological assertions (`expect(true).toBe(true)`), and NO test skipping (`fit`, `xit`, `test.skip`).
2. **Execution Validation**: Execute the full test runner:
   `npm test -- src/modules/analyzer/link-analyzer.service.spec.ts src/modules/validator/validator.service.spec.ts src/modules/sitemap/sitemap.service.spec.ts src/modules/history/history.service.spec.ts src/modules/performance/performance.service.spec.ts src/modules/local-seo/gbp-analyzer.service.spec.ts src/modules/local-seo/gbp-autofix.service.spec.ts src/modules/local-seo/reviews.service.spec.ts src/modules/local-seo/local-seo-connect.spec.ts`
   Confirm 0 syntax errors, 0 import errors, and 100% pass rate.
3. **Model Invocation Verification**: Verify that each of the core models for Website Audit (`Page`, `Link`, `Website`, `CrawlJob`, `Issue`, `Performance`) and GBP (`GbpFixProposal`, `LocalReview`, `LocalLocation`, `Integration`) are authentically invoked and asserted against.

## Resources
- ORIGINAL_REQUEST.md: /Users/milquu/Documents/Coding Projects/AI Seo/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/milquu/Documents/Coding Projects/AI Seo/.agents/PROJECT.md

## Output Requirements
Write your audit report to `/Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_auditor_1/handoff.md` concluding with a clear verdict (`CLEAN` or `INTEGRITY VIOLATION`).
Notify orchestrator via send_message.

## 2026-09-21T06:23:40Z
Perform a forensic integrity audit across all 9 newly created test suites in growthx-ai-crawler/:
1. src/modules/analyzer/link-analyzer.service.spec.ts
2. src/modules/validator/validator.service.spec.ts
3. src/modules/sitemap/sitemap.service.spec.ts
4. src/modules/history/history.service.spec.ts
5. src/modules/performance/performance.service.spec.ts
6. src/modules/local-seo/gbp-analyzer.service.spec.ts
7. src/modules/local-seo/gbp-autofix.service.spec.ts
8. src/modules/local-seo/reviews.service.spec.ts
9. src/modules/local-seo/local-seo-connect.spec.ts

Execute static analysis and runtime tracing. Verify:
- No hardcoded test results, no facade/dummy logic, no circumvented tests.
- Execute the test runner across all 9 suites:
  npm test -- src/modules/analyzer/link-analyzer.service.spec.ts src/modules/validator/validator.service.spec.ts src/modules/sitemap/sitemap.service.spec.ts src/modules/history/history.service.spec.ts src/modules/performance/performance.service.spec.ts src/modules/local-seo/gbp-analyzer.service.spec.ts src/modules/local-seo/gbp-autofix.service.spec.ts src/modules/local-seo/reviews.service.spec.ts src/modules/local-seo/local-seo-connect.spec.ts
- Verify authentic invocation of underlying models for Website Audit and GBP.

Write your report to /Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_auditor_1/handoff.md with verdict (CLEAN or INTEGRITY VIOLATION).
Notify orchestrator via send_message.
