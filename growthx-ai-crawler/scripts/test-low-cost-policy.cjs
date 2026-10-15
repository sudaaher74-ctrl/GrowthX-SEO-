// Runs only inside the disposable test database/container created by the shell script.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
if (!process.env.DATABASE_URL?.includes('/low_cost_policy_test')) throw new Error('A disposable low_cost_policy_test database is required');
for (const name of ['multi-ai-router.types', 'low-cost-policy', 'low-cost-policy.service']) {
  const source = fs.readFileSync(`/policy-source/src/modules/ai-search/multi-ai-router/${name}.ts`, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true, emitDecoratorMetadata: true } });
  fs.writeFileSync(`/app/dist/modules/ai-search/multi-ai-router/${name}.js`, outputText);
}
require('reflect-metadata');
const { PrismaClient } = require('@prisma/client');
const { ConfigService } = require('@nestjs/config');
const { LowCostPolicyService } = require('../dist/modules/ai-search/multi-ai-router/low-cost-policy.service');
(async () => {
  const prisma = new PrismaClient();
  try {
    const config = new ConfigService({ AI_PLATFORM_MONTHLY_INR: '0.02', AI_CUSTOMER_MONTHLY_INR: '100', AI_INTERNAL_MONTHLY_INR: '20', AI_ACCOUNTING_INR_PER_USD: '100' });
    const service = new LowCostPolicyService(prisma, config);
    service.verifyPrice = async () => {};
    const request = { organizationId: 'org', task: 'SUMMARY_GENERATION', prompt: 'hi', maxTokens: 100 };
    let paidCalls = 0;
    const complete = async () => {
      paidCalls++;
      return { provider: 'GEMINI', model: 'gemini-2.5-flash-lite', text: 'test answer', refused: false, usage: { inputTokens: 10, outputTokens: 10, estimatedCostUsd: 0.00014, actualCostUsd: null } };
    };
    const attempts = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => service.run({ ...request, prompt: `hi ${i}` }, 'gemini-2.5-flash-lite', complete)));
    assert.equal(paidCalls, 1, 'parallel API/worker reservations exceeded the platform cap');
    assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
    const rows = await prisma.$queryRaw`SELECT * FROM "AiUsageRecord"`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'OK');
    assert.equal(rows[0].budgetCategory, 'INTERNAL');
    const cache = await prisma.$queryRaw`SELECT * FROM "AiInternalAnalysisCache"`;
    assert.equal(cache.length, 1);
    console.log('Real PostgreSQL: parallel reservations enforced the platform cap; settlement and persistent caching passed.');

    await prisma.$executeRaw`DELETE FROM "AiUsageRecord"`;
    const failed = new LowCostPolicyService(prisma, new ConfigService());
    failed.verifyPrice = async () => {};
    await assert.rejects(failed.run({ ...request, prompt: 'timeout test' }, 'gemini-2.5-flash-lite', async () => { throw new Error('timeout'); }), /timeout/);
    const errors = await prisma.$queryRaw`SELECT * FROM "AiUsageRecord"`;
    assert.equal(errors.length, 1);
    assert.equal(errors[0].status, 'ERROR');
    assert.ok(errors[0].reservedCostUsd > 0);
    assert.equal(errors[0].actualCostUsd, null);
    console.log('Real PostgreSQL: unknown failed-provider spend retained its reservation. No provider APIs were called.');
  } finally { await prisma.$disconnect(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
