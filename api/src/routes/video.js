import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { getDevice as getRegistryDevice } from '../utils/deviceRegistry.js';
import { callDeviceEndpoint, ensureKind } from '../utils/deviceHttp.js';
import {
  getDevice as getDeviceRecord
} from '../services/deviceService.js';
import { queueDeviceCommand } from '../services/commandService.js';
import {
  ensureStorageReady,
  listVideoFiles,
  registerUploadedVideo,
  deleteVideoFile,
  getVideoFile,
  getVideoPathFromEntry,
  getThumbnailPathFromEntry,
  paths as storagePaths,
} from '../utils/videoStorage.js';

await ensureStorageReady();

const router = Router();

const allowedExtensions = new Set(['.mp4', '.m4v', '.mov', '.avi', '.mkv', '.ts', '.webm']);
const uploadLimits = { fileSize: 50 * 1024 * 1024 };

function fileFilter(_req, file, cb) {
  const mime = file.mimetype || '';
  const ext = (path.extname(file.originalname || '') || '').toLowerCase();
  if (mime.startsWith('video/') || allowedExtensions.has(ext)) {
    cb(null, true);
  } else {
    const err = new Error('unsupported_video_type');
    err.code = 'UNSUPPORTED_MEDIA_TYPE';
    cb(err);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, storagePaths.VIDEOS_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '').toLowerCase();
    const safeExt = allowedExtensions.has(ext) ? ext : '.mp4';
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    cb(null, `${timestamp}-${random}${safeExt}`);
  },
});

const upload = multer({ storage, limits: uploadLimits, fileFilter });

function makeAbsolute(req, relativePath) {
  if (!relativePath) return null;
  const base = `${req.protocol}://${req.get('host')}`;
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  return `${base}${relativePath}`;
}

function presentFile(req, file) {
  if (!file) return null;
  return {
    ...file,
    thumbnail: makeAbsolute(req, file.thumbnail),
    stream_url: makeAbsolute(req, `/api/video/files/${file.id}/stream`),
    download_url: makeAbsolute(req, `/api/video/files/${file.id}/download`),
  };
}

function findVideoDevice(id) {
  const device = getRegistryDevice(id);
  if (!device) return null;
  if (!ensureKind(device, ['video', 'hdmi-media'])) {
    return null;
  }
  return device;
}

async function loadVideoDeviceRecord(id) {
  try {
    const device = await getDeviceRecord(id);
    if (!ensureKind(device, ['video', 'hdmi-media'])) {
      return null;
    }
    return device;
  } catch (err) {
    return null;
  }
}

function sendProxyResponse(res, deviceId, result, overrideData) {
  const data = overrideData !== undefined ? overrideData : result.data;
  res.status(result.status).json({
    ok: result.ok,
    status: result.status,
    device: deviceId,
    data,
  });
}

function handleProxyError(res, error, code = 'video_proxy_failed') {
  const detail = error instanceof Error ? error.message : String(error);
  const status = detail === 'device_url_unset' ? 400 : 502;
  res.status(status).json({ error: code, detail });
}

function buildPlaybackUrl(req, fileId) {
  return makeAbsolute(req, `/api/video/files/${fileId}/stream`);
}

router.get('/files', async (req, res) => {
  try {
    const files = await listVideoFiles();
    const presented = files.map((file) => presentFile(req, file));
    res.json({ files: presented, count: presented.length });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    res.status(500).json({ status: 'error', message: 'list_failed', detail });
  }
});

router.post('/files/upload', (req, res) => {
  upload.single('video')(req, res, async (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.code === 'UNSUPPORTED_MEDIA_TYPE' ? 415 : 400;
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'file_too_large' : err.message || 'upload_failed';
      return res.status(status).json({ status: 'error', message });
    }
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'video_file_missing' });
    }
    try {
      const stored = await registerUploadedVideo(req.file);
      res.status(201).json({ status: 'ok', message: 'video_uploaded', file: presentFile(req, stored) });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      res.status(500).json({ status: 'error', message: 'video_store_failed', detail });
    }
  });
});

router.delete('/files/:fileId', async (req, res) => {
  try {
    const removed = await deleteVideoFile(req.params.fileId);
    if (!removed) {
      return res.status(404).json({ status: 'error', message: 'file_not_found' });
    }
    res.json({ status: 'ok', message: 'video_deleted', file: presentFile(req, removed) });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    res.status(500).json({ status: 'error', message: 'video_delete_failed', detail });
  }
});

router.get('/files/:fileId/download', async (req, res) => {
  try {
    const record = await getVideoFile(req.params.fileId);
    if (!record) {
      return res.status(404).json({ error: 'file_not_found' });
    }
    res.download(getVideoPathFromEntry(record.entry), record.entry.filename);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'video_download_failed', detail });
  }
});

router.get('/files/:fileId/stream', async (req, res) => {
  try {
    const record = await getVideoFile(req.params.fileId);
    if (!record) {
      return res.status(404).json({ error: 'file_not_found' });
    }
    res.sendFile(getVideoPathFromEntry(record.entry));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'video_stream_failed', detail });
  }
});

router.get('/files/:fileId/thumbnail', async (req, res) => {
  try {
    const record = await getVideoFile(req.params.fileId);
    if (!record || !record.entry.thumbnail) {
      return res.status(404).json({ error: 'thumbnail_not_found' });
    }
    res.sendFile(getThumbnailPathFromEntry(record.entry));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'thumbnail_fetch_failed', detail });
  }
});

router.post('/play', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const deviceIds = Array.isArray(body.device_ids) ? body.device_ids : [];
  const fileId = typeof body.file_id === 'string' ? body.file_id : null;
  if (!fileId) {
    return res.status(400).json({ status: 'error', message: 'file_id_required' });
  }
  if (deviceIds.length === 0) {
    return res.status(400).json({ status: 'error', message: 'device_ids_required' });
  }
  const record = await getVideoFile(fileId);
  if (!record) {
    return res.status(404).json({ status: 'error', message: 'file_not_found' });
  }
  const streamUrl = buildPlaybackUrl(req, fileId);
  const jobs = [];
  for (const id of deviceIds) {
    const deviceRecord = await loadVideoDeviceRecord(id);
    if (!deviceRecord) {
      jobs.push({ device_id: id, error: 'device_not_found' });
      continue;
    }
    const requestDefinition = {
      path: '/play',
      method: 'POST',
      body: { url: streamUrl, start: 0 },
      timeout: 8000,
    };
    const { jobId } = await queueDeviceCommand(deviceRecord, {
      command: 'media.play',
      payload: { url: streamUrl },
      request: requestDefinition,
      successEvent: 'media.play.started',
      errorEvent: 'media.play.failed',
      statePatch: { media: { status: 'playing', source: streamUrl } },
      stateOnError: { media: { status: 'error', source: streamUrl } },
    });
    jobs.push({ device_id: id, job_id: jobId });
  }
  res.status(202).json({ status: 'accepted', jobs });
});

router.post('/stop', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const deviceIds = Array.isArray(body.device_ids) ? body.device_ids : [];
  if (deviceIds.length === 0) {
    return res.status(400).json({ status: 'error', message: 'device_ids_required' });
  }
  const jobs = [];
  for (const id of deviceIds) {
    const deviceRecord = await loadVideoDeviceRecord(id);
    if (!deviceRecord) {
      jobs.push({ device_id: id, error: 'device_not_found' });
      continue;
    }
    const requestDefinition = {
      path: '/stop',
      method: 'POST',
      timeout: 8000,
    };
    const { jobId } = await queueDeviceCommand(deviceRecord, {
      command: 'media.stop',
      payload: {},
      request: requestDefinition,
      successEvent: 'media.stop.success',
      errorEvent: 'media.stop.failed',
      statePatch: { media: { status: 'stopped' } },
    });
    jobs.push({ device_id: id, job_id: jobId });
  }
  res.status(202).json({ status: 'accepted', jobs });
});

router.post('/devices/:deviceId/tv/power', async (req, res) => {
  const { deviceId } = req.params;
  const registryDevice = findVideoDevice(deviceId);
  if (!registryDevice) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const deviceRecord = await loadVideoDeviceRecord(deviceId);
  if (!deviceRecord) {
    return res.status(404).json({ error: 'device_not_found' });
  }

  const body = req.body || {};
  let desired = body.state ?? body.value ?? body.mode;
  if (typeof desired === 'string') {
    desired = desired.trim().toLowerCase();
  } else if (desired === true) {
    desired = 'on';
  } else if (desired === false) {
    desired = 'off';
  }

  if (desired !== 'on' && desired !== 'off') {
    return res.status(400).json({ error: 'invalid_state', detail: 'state must be "on" or "off"' });
  }

  const commandName = desired === 'on' ? 'tv.power_on' : 'tv.power_off';
  const pathSuffix = desired === 'on' ? '/tv/power_on' : '/tv/power_off';

  const { jobId } = await queueDeviceCommand(deviceRecord, {
    command: commandName,
    payload: { desired },
    request: { path: pathSuffix, method: 'POST' },
    successEvent: 'tv.power.changed',
    errorEvent: 'tv.power.failed',
    statePatch: { tv: { power: desired } },
    markOfflineOnError: true,
  });

  res.status(202).json({ accepted: true, job_id: jobId, device: deviceId });
});

router.post('/devices/:deviceId/tv/volume', async (req, res) => {
  const { deviceId } = req.params;
  const registryDevice = findVideoDevice(deviceId);
  if (!registryDevice) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const deviceRecord = await loadVideoDeviceRecord(deviceId);
  if (!deviceRecord) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const body = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  let volume = body.volume ?? body.level ?? body.percent ?? body.value;
  if (volume !== undefined) {
    const numeric = Number(volume);
    if (Number.isFinite(numeric)) {
      volume = numeric <= 1 ? numeric * 100 : numeric;
      volume = Math.max(0, Math.min(100, Math.round(volume)));
      body.volume = volume;
    } else {
      delete body.volume;
    }
  }
  if (body.volume === undefined && body.direction === undefined && body.mute === undefined) {
    return res.status(400).json({ error: 'invalid_payload', detail: 'Provide volume, direction, or mute state.' });
  }

  const { jobId } = await queueDeviceCommand(deviceRecord, {
    command: 'tv.volume',
    payload: body,
    request: { path: '/volume', method: 'POST', body },
    successEvent: 'tv.volume.changed',
    errorEvent: 'tv.volume.failed',
    statePatch: { tv: { volume: body.volume ?? null } },
  });

  res.status(202).json({ accepted: true, job_id: jobId, device: deviceId });
});

router.post('/devices/:deviceId/tv/input', async (req, res) => {
  const { deviceId } = req.params;
  const registryDevice = findVideoDevice(deviceId);
  if (!registryDevice) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const deviceRecord = await loadVideoDeviceRecord(deviceId);
  if (!deviceRecord) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const payload = req.body && typeof req.body === 'object' ? req.body : {};

  const source = typeof payload.source === 'string' ? payload.source : undefined;
  if (!source) {
    return res.status(400).json({ error: 'invalid_payload', detail: 'source required' });
  }

  const { jobId } = await queueDeviceCommand(deviceRecord, {
    command: 'tv.input',
    payload,
    request: { path: '/tv/input', method: 'POST', body: payload },
    successEvent: 'tv.input.changed',
    errorEvent: 'tv.input.failed',
    statePatch: { tv: { input: source } },
  });

  res.status(202).json({ accepted: true, job_id: jobId, device: deviceId });
});

router.get('/devices/:deviceId/health', async (req, res) => {
  const { deviceId } = req.params;
  const device = findVideoDevice(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const url = device.api?.health_url;
  if (!url) {
    return res.status(400).json({ error: 'health_unavailable' });
  }
  try {
    const result = await callDeviceEndpoint(device, {
      url,
      method: 'GET',
      accept: 'text/plain, application/json;q=0.8',
    });
    sendProxyResponse(res, deviceId, result);
  } catch (err) {
    handleProxyError(res, err, 'video_health_failed');
  }
});

export default router;
