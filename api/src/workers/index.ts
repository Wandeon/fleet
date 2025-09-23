import { runPendingJobsOnce } from './executor.js';
import { pollOnce } from './poller.js';

const pollEvery = Number(process.env.POLL_INTERVAL_MS || 5000);

async function loop() {
  console.log(`[Worker] Starting poll cycle at ${new Date().toISOString()}`);
  try {
    await runPendingJobsOnce();
    await pollOnce();
    console.log(`[Worker] Poll cycle completed, next in ${pollEvery}ms`);
  } catch (error) {
    console.error(`[Worker] Error during poll cycle:`, error);
  }
  setTimeout(loop, pollEvery);
}

console.log(`[Worker] Starting worker with ${pollEvery}ms poll interval`);
loop();
