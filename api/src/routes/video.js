import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { getDevice } from '../utils/deviceRegistry.js';
import { callDeviceEndpoint, ensureKind } from '../utils/deviceHttp.js';
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
  const device = getDevice(id);
  if (!device) return null;
  if (!ensureKind(device, ['video', 'hdmi-media'])) {
    return null;
  }
  return device;
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

async function invokeDevicePlayback(deviceId, options) {
  const device = findVideoDevice(deviceId);
  if (!device) {
    return {
      device_id: deviceId,
      ok: false,
      error: 'device_not_found',
    };
  }
  try {
    const result = await callDeviceEndpoint(device, options);
    return {
      device_id: deviceId,
      ok: result.ok,
      status: result.status,
      data: result.data ?? null,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      device_id: deviceId,
      ok: false,
      error: detail,
    };
  }
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
    res.status(500).json({ error: 'video_list_failed', detail });
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
  const tasks = deviceIds.map((id) =>
    invokeDevicePlayback(id, {
      path: '/play',
      method: 'POST',
      body: { url: streamUrl, start: 0 },
      timeout: 8000,
    })
  );
  const results = await Promise.all(tasks);
  const successCount = results.filter((r) => r.ok).length;
  const failureCount = results.length - successCount;
  const status = failureCount === 0 ? 'ok' : successCount > 0 ? 'partial' : 'error';
  const message =
    status === 'ok'
      ? `Playback started on ${successCount} device${successCount === 1 ? '' : 's'}.`
      : status === 'partial'
        ? `Playback started on ${successCount} device(s); ${failureCount} failed.`
        : 'Failed to start playback on all devices.';
  res.status(status === 'error' ? 502 : 200).json({ status, message, file: presentFile(req, record.response), results });
});

router.post('/stop', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const deviceIds = Array.isArray(body.device_ids) ? body.device_ids : [];
  if (deviceIds.length === 0) {
    return res.status(400).json({ status: 'error', message: 'device_ids_required' });
  }
  const tasks = deviceIds.map((id) =>
    invokeDevicePlayback(id, {
      path: '/stop',
      method: 'POST',
      timeout: 8000,
    })
  );
  const results = await Promise.all(tasks);
  const successCount = results.filter((r) => r.ok).length;
  const failureCount = results.length - successCount;
  const status = failureCount === 0 ? 'ok' : successCount > 0 ? 'partial' : 'error';
  const message =
    status === 'ok'
      ? `Playback stopped on ${successCount} device${successCount === 1 ? '' : 's'}.`
      : status === 'partial'
        ? `Playback stopped on ${successCount} device(s); ${failureCount} failed.`
        : 'Failed to stop playback on all devices.';
  res.status(status === 'error' ? 502 : 200).json({ status, message, results });
});

router.post('/devices/:deviceId/tv/power', async (req, res) => {
  const { deviceId } = req.params;
  const device = findVideoDevice(deviceId);
  if (!device) {
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

  const pathSuffix = desired === 'on' ? '/tv/power_on' : '/tv/power_off';
  try {
    const result = await callDeviceEndpoint(device, {
      path: pathSuffix,
      method: 'POST',
    });
    const formatted =
      result.data && typeof result.data === 'object'
        ? { ...result.data, state: desired }
        : { state: desired, response: result.data ?? null };
    sendProxyResponse(res, deviceId, result, formatted);
  } catch (err) {
    handleProxyError(res, err, 'video_power_failed');
  }
});

router.post('/devices/:deviceId/tv/volume', async (req, res) => {
  const { deviceId } = req.params;
  const device = findVideoDevice(deviceId);
  if (!device) {
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

  try {
    const result = await callDeviceEndpoint(device, {
      path: '/volume',
      method: 'POST',
      body,
    });
    sendProxyResponse(res, deviceId, result);
  } catch (err) {
    handleProxyError(res, err, 'video_volume_failed');
  }
});

router.post('/devices/:deviceId/tv/input', async (req, res) => {
  const { deviceId } = req.params;
  const device = findVideoDevice(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    const result = await callDeviceEndpoint(device, {
      path: '/tv/input',
      method: 'POST',
      body: payload,
    });
    sendProxyResponse(res, deviceId, result);
  } catch (err) {
    handleProxyError(res, err, 'video_input_failed');
  }
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
