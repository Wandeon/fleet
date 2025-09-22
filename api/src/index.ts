import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { router } from './http/routes.js';
// import { authRouter } from './http/auth.routes.js';
// import { libraryRouter } from './http/audio.library.routes.js';
import { audioDeviceRouter } from './http/audio.device.routes.js';
import { videoDeviceRouter } from './http/video.device.routes.js';
import { cameraDeviceRouter } from './http/camera.device.routes.js';
import { zigbeeDeviceRouter } from './http/zigbee.device.routes.js';
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

// Library routes (auth required) - temporarily disabled for testing
// const bearer = process.env.API_BEARER || '';
// if (bearer) {
//   app.use('/api/library', auth(bearer), libraryRouter);
// } else {
//   app.use('/api/library', libraryRouter);
// }

// Device routes (auth required)
const bearer = process.env.API_BEARER || '';
if (bearer) {
  app.use('/api/audio', auth(bearer), audioDeviceRouter);
  app.use('/api/video', auth(bearer), videoDeviceRouter);
  app.use('/api/camera', auth(bearer), cameraDeviceRouter);
  app.use('/api/zigbee', auth(bearer), zigbeeDeviceRouter);
} else {
  app.use('/api/audio', audioDeviceRouter);
  app.use('/api/video', videoDeviceRouter);
  app.use('/api/camera', cameraDeviceRouter);
  app.use('/api/zigbee', zigbeeDeviceRouter);
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
