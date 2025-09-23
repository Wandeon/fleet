import express from 'express';
import { router } from './http/routes.js';
import { sseHandler } from './http/sse.js';
import { auth } from './http/util-auth.js';
import { correlationIdMiddleware, log, requestLogger } from './observability/logging.js';
import { metricsHandler, metricsMiddleware } from './observability/metrics.js';
import { startTracing } from './observability/tracing.js';

const app = express();

void startTracing().catch((error) => {
  log.warn({ err: error instanceof Error ? error.message : error }, 'Tracing initialization failed');
});

app.use(correlationIdMiddleware);
app.use(requestLogger());
app.use(metricsMiddleware);

app.get('/metrics', metricsHandler);

const bearer = process.env.API_BEARER || '';
if (bearer) {
  app.get('/stream', auth(bearer), sseHandler);
} else {
  app.get('/stream', sseHandler);
}
app.use('/api', router);

const port = Number(process.env.API_PORT || 3005);
app.listen(port, () => {
  log.info({ port }, 'Fleet API listening');
});
