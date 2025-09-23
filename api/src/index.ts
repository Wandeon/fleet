import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { router } from './http/routes.js';
// import { authRouter } from './http/auth.routes.js';
import { libraryRouter } from './http/library.routes.js';
import { playlistsRouter } from './http/playlists.routes.js';
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

// Public health endpoint (no auth required)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Compatibility aliases for legacy UI paths (prevents 404s)
const addCompatibilityRoutes = (authMiddleware?: any) => {
  const middleware = authMiddleware ? [authMiddleware] : [];

  // Legacy playlist routes → canonical routes
  app.get('/api/library/playlists', ...middleware, (req, res) => {
    res.redirect(302, '/api/playlists' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : ''));
  });

  app.post('/api/library/playlists', ...middleware, (req, res) => {
    res.redirect(307, '/api/playlists');
  });

  app.put('/api/library/playlists', ...middleware, (req, res) => {
    res.redirect(307, '/api/playlists');
  });

  app.delete('/api/library/playlists', ...middleware, (req, res) => {
    res.redirect(307, '/api/playlists');
  });
};

// Auth routes (no auth required) - temporarily disabled
// app.use('/api/auth', authRouter);

// Get bearer token for all protected routes
const bearer = process.env.API_BEARER || '';

// Add compatibility routes with auth if bearer token is set
addCompatibilityRoutes(bearer ? auth(bearer) : undefined);

// Library routes (auth required)
if (bearer) {
  app.use('/api/library', auth(bearer), libraryRouter);
  app.use('/api/playlists', auth(bearer), playlistsRouter);
} else {
  app.use('/api/library', libraryRouter);
  app.use('/api/playlists', playlistsRouter);
}

// Device routes (auth required)
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

// Groups routes (auth required) - mount after more specific routes
if (bearer) {
  app.use('/api/groups', auth(bearer), groupsRouter);
  app.use('/api/fleet', auth(bearer), groupsRouter);
} else {
  app.use('/api/groups', groupsRouter);
  app.use('/api/fleet', groupsRouter);
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
