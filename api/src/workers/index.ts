import { runPendingJobsOnce } from './executor.js';
import { pollOnce } from './poller.js';

const pollEvery = Number(process.env.POLL_INTERVAL_MS || 5000);

async function loop() {
  await runPendingJobsOnce();
  await pollOnce();
  setTimeout(loop, pollEvery);
}

loop();
