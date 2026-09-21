# Dispatch: Worker Remediation & Final Verification

## Identity
- Role: Worker (Remediation & Final Verification)
- TypeName: teamwork_preview_worker
- Working Directory: /Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_worker_remediation

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor has independently verified your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mission
1. Remediate the issue identified by Challenger 2 in `growthx-ai-crawler/src/modules/local-seo/gbp-autofix.service.ts`:
   - In `approveAndPushFix(proposalId, projectId)`: Move `const proposal = await this.prisma.gbpFixProposal.findFirst(...)` and the `if (!proposal) throw new NotFoundException(...)` check OUTSIDE the `try/catch` block.
   - This ensures that if the proposal does not exist or is not PENDING, `NotFoundException` is thrown directly without triggering the catch block's `update({ data: { status: 'PENDING' } })`.
2. In `growthx-ai-crawler/src/modules/local-seo/gbp-autofix.service.spec.ts`:
   - In the test `'throws NotFoundException if the proposal is not found or not in PENDING status'`:
     Change `expect(updateProposal).toHaveBeenCalledWith(...)` to `expect(updateProposal).not.toHaveBeenCalled()`.
3. In `growthx-ai-crawler/src/modules/local-seo/reviews.service.ts`:
   - Ensure `draftReply` handles missing or empty `aiResponse?.text` safely (e.g., `const replyText = aiResponse?.text?.trim(); if (!replyText) throw new Error('AI failed to generate a reply');`).
4. Run the full test suite across all 9 newly created test suites:
   `npm test -- src/modules/analyzer/link-analyzer.service.spec.ts src/modules/validator/validator.service.spec.ts src/modules/sitemap/sitemap.service.spec.ts src/modules/history/history.service.spec.ts src/modules/performance/performance.service.spec.ts src/modules/local-seo/gbp-analyzer.service.spec.ts src/modules/local-seo/gbp-autofix.service.spec.ts src/modules/local-seo/reviews.service.spec.ts src/modules/local-seo/local-seo-connect.spec.ts`
   Confirm 91/91 tests pass cleanly.
5. In workspace root `/Users/milquu/Documents/Coding Projects/AI Seo`:
   Run the mandatory git commands:
   - `git add .`
   - `git commit -m "feat(tests): add automated unit test suite for website audit and google business profile"`
   - `git push`
   (Use BypassSandbox=true if needed for git locks or network push).
6. Document all results and commands in `/Users/milquu/Documents/Coding Projects/AI Seo/.agents/teamwork_preview_worker_remediation/handoff.md` and notify orchestrator via send_message.
