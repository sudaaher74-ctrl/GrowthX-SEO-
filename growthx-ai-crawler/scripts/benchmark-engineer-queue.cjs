// Run only against a disposable Redis instance. This does not invoke AI, GitHub, or the product database.
const { Queue, Worker, QueueEvents } = require('bullmq');
const { randomUUID } = require('crypto');
(async () => {
  if (process.env.BENCHMARK_ISOLATED !== 'true' || !process.env.BENCHMARK_REDIS_HOST) throw new Error('Set BENCHMARK_ISOLATED=true and an explicit disposable BENCHMARK_REDIS_HOST.');
  const connection = { host: process.env.BENCHMARK_REDIS_HOST, port: Number(process.env.BENCHMARK_REDIS_PORT || 6379), maxRetriesPerRequest: null };
  const name = 'engineer-benchmark-' + randomUUID();
  const queue = new Queue(name, { connection });
  // Each bounded waitUntilFinished subscription temporarily watches queue shutdown.
  queue.setMaxListeners(1010);
  const events = new QueueEvents(name, { connection });
  let active = 0, maximum = 0, completed = 0;
  const processJob = async () => { maximum = Math.max(maximum, ++active); await new Promise(r => setTimeout(r, 5)); --active; completed++; };
  const workers = [new Worker(name, processJob, { connection, concurrency: 4 }), new Worker(name, processJob, { connection, concurrency: 4 })];
  try {
    await queue.setGlobalConcurrency(2);
    await events.waitUntilReady();
    await Promise.all(workers.map(w => w.waitUntilReady()));
    const started = Date.now();
    const jobs = await queue.addBulk(Array.from({ length: 1000 }, (_, i) => ({ name: 'test', data: { test: true }, opts: { jobId: `request-${i}` } })));
    await queue.addBulk(Array.from({ length: 1000 }, (_, i) => ({ name: 'test', data: { test: true }, opts: { jobId: `request-${i}` } })));
    await Promise.all(jobs.map(job => job.waitUntilFinished(events, 60000)));
    if (maximum > 2 || completed !== 1000) throw new Error(`Limit/deduplication failed: ${maximum} concurrent, ${completed} completed`);
    console.log(JSON.stringify({ submitted: 1000, duplicateSubmissions: 1000, completed, maximumConcurrency: maximum, elapsedMs: Date.now() - started, scope: 'isolated queue only; not an AI or full application capacity benchmark' }));
  } finally { await Promise.all(workers.map(w => w.close())); await events.close(); await queue.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
