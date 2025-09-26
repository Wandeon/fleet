import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { bearerAuth } from './auth/bearer';
import { correlationIdMiddleware } from './middleware/correlation';
import { errorHandler } from './middleware/errors';
import { loggingMiddleware, logger } from './middleware/logging';
import { rateLimit } from './middleware/rate-limit';
import { metricsHandler, metricsMiddleware } from './observability/metrics';
import { healthRouter } from './observability/health';
import { audioRouter } from './routes/audio';
import { fleetRouter } from './routes/fleet';
import { videoRouter } from './routes/video';
import { zigbeeRouter } from './routes/zigbee';
import { cameraRouter } from './routes/camera';
import { healthSummaryRouter } from './routes/health';
import { logsRouter } from './routes/logs';
import { settingsRouter } from './routes/settings';
import { deviceRegistry, initializeRegistry } from './upstream/devices';

export function createApp() {
  if (!deviceRegistry.isReady()) {
    initializeRegistry();
  }

  const app = express();
  app.disable('x-powered-by');

  const allowedOrigins = new Set(config.corsAllowedOrigins);
  const allowAll = config.NODE_ENV !== 'production' || allowedOrigins.has('*');
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowAll || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true
    })
  );

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(correlationIdMiddleware);
  app.use(loggingMiddleware);
  app.use(metricsMiddleware);

  app.use(healthRouter);

  app.get('/metrics', bearerAuth, metricsHandler);

  app.use(rateLimit);
  app.use(bearerAuth);

  app.use('/fleet', fleetRouter);
  app.use('/audio', audioRouter);
  app.use('/video', videoRouter);
  app.use('/zigbee', zigbeeRouter);
  app.use('/camera', cameraRouter);
  app.use('/health', healthSummaryRouter);
  app.use('/logs', logsRouter);
  app.use('/settings', settingsRouter);

  app.use(errorHandler);

  return app;
}

export function startServer() {
  const app = createApp();
  const server = app.listen(config.HTTP_PORT, () => {
    logger.info({ msg: 'server_listening', port: config.HTTP_PORT });
  });

  const shutdown = () => {
    logger.info({ msg: 'server_shutdown_initiated' });
    server.close(() => {
      logger.info({ msg: 'server_shutdown_complete' });
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}

if (require.main === module) {
  startServer();
}
