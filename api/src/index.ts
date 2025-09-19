import express from 'express';
import morgan from 'morgan';
import { router } from './http/routes.js';
import { sseHandler } from './http/sse.js';
import { metricsHandler } from './lib/metrics.js';

const app = express();
app.use(morgan('tiny'));

app.get('/metrics', metricsHandler);
app.get('/stream', sseHandler);
app.use('/api', router);

const port = Number(process.env.API_PORT || 3005);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API on :${port}`);
});
