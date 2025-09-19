import express from 'express';
import morgan from 'morgan';
import { router } from './http/routes.js';
import { sseHandler } from './http/sse.js';
import { metricsHandler } from './lib/metrics.js';
import { auth } from './http/util-auth.js';

const app = express();
app.use(morgan('tiny'));

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
  // eslint-disable-next-line no-console
  console.log(`API on :${port}`);
});
