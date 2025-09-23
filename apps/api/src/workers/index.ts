import { runPendingJobsOnce } from './executor.js';
import { pollOnce } from './poller.js';
import { log } from '../observability/logging.js';
import { startTracing } from '../observability/tracing.js';

const pollEvery = Number(process.env.POLL_INTERVAL_MS || 5000);

async function loop() {
  await runPendingJobsOnce();
  await pollOnce();
  setTimeout(loop, pollEvery);
}

void startTracing().catch((error) => {
  log.warn({ err: error instanceof Error ? error.message : error }, 'Tracing init failed in worker');
});

loop();
