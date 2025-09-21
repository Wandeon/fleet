import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { router } from './http/routes.js';
// import { authRouter } from './http/auth.routes.js';
// import { libraryRouter } from './http/audio.library.routes.js';
import { audioDeviceRouter } from './http/audio.device.routes.js';
import { groupsRouter } from './http/groups.routes.js';
import { sseHandler } from './http/sse.js';
import { metricsHandler } from './lib/metrics.js';
import { auth } from './http/util-auth.js';

const app = express();
app.use(morgan('tiny'));
app.use(cookieParser());

app.get('/metrics', metricsHandler);

// Auth routes (no auth required) - temporarily disabled
// app.use('/api/auth', authRouter);

// Library routes (auth required) - temporarily disabled for build
// const bearer = process.env.API_BEARER || '';
// if (bearer) {
//   app.use('/api/library', auth(bearer), libraryRouter);
// } else {
//   app.use('/api/library', libraryRouter);
// }

// Audio device routes (auth required)
const bearer = process.env.API_BEARER || '';
if (bearer) {
  app.use('/api/audio', auth(bearer), audioDeviceRouter);
} else {
  app.use('/api/audio', audioDeviceRouter);
}

// Groups routes (auth required)
if (bearer) {
  app.use('/api', auth(bearer), groupsRouter);
} else {
  app.use('/api', groupsRouter);
}

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
