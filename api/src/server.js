import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { logger } from './utils/logger.js';
import { cspNonce } from './middleware/cspNonce.js';
import { limitHealth, limitLogs } from './middleware/rateLimiters.js';
import health from './routes/health.js';
import devices from './routes/devices.js';
import logs from './routes/logs.js';
import operations from './routes/operations.js';
import video from './routes/video.js';
import deviceStates from './routes/deviceStates.js';
import deviceEvents from './routes/deviceEvents.js';
import jobs from './routes/jobs.js';
import stream from './routes/stream.js';
import zigbee from './routes/zigbee.js';
import camera from './routes/camera.js';
import auth from './routes/auth.js';
import { errorId } from './middleware/errorId.js';
import { startBackgroundWorkers, stopBackgroundWorkers } from './worker/processor.js';
import { disconnectPrisma } from './db/client.js';

const app = express();
app.disable('x-powered-by');

app.use(logger);
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(cspNonce);

app.use(helmet({ contentSecurityPolicy: false }));

app.use('/api/auth', auth);
app.use('/api/health', limitHealth, health);
app.use('/api/devices', devices);
app.use('/api/device_states', deviceStates);
app.use('/api/device_events', deviceEvents);
app.use('/api/jobs', jobs);
app.use('/api/stream', stream);
app.use('/api/video', video);
app.use('/api/zigbee', zigbee);
app.use('/api/camera', camera);
app.use('/api/logs', limitLogs, logs);
app.use('/api/operations', operations);

app.use((req, res) => res.status(404).json({ error: 'not_found' }));
app.use(errorId);

const port = process.env.PORT || 3005;
const server = app.listen(port, () => console.log(`API listening on :${port}`));

startBackgroundWorkers();

async function shutdown() {
  await stopBackgroundWorkers();
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
