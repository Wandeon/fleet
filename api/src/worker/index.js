import { startBackgroundWorkers, stopBackgroundWorkers } from './processor.js';
import { prisma, disconnectPrisma } from '../db/client.js';

async function start() {
  await prisma.SELECT 1;
  startBackgroundWorkers();
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function shutdown() {
  await stopBackgroundWorkers();
  await disconnectPrisma();
  process.exit(0);
}

start().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exitCode = 1;
});
