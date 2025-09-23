import { Router } from 'express';
import { deviceRegistry, initializeRegistry } from '../upstream/devices';

const router = Router();

router.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

router.get('/readyz', (_req, res) => {
  if (!deviceRegistry.isReady()) {
    initializeRegistry();
  }

  if (!deviceRegistry.isReady()) {
    res.status(503).json({
      status: 'error',
      reason: deviceRegistry.getLastError()?.message ?? 'Device registry unavailable'
    });
    return;
  }

  res.json({
    status: 'ok',
    devices: deviceRegistry.list().length,
    lastLoadedAt: deviceRegistry.getLastLoadedAt()?.toISOString()
  });
});

export const healthRouter = router;
