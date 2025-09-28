import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  createLibraryTrack,
  getAudioOverview,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  startPlayback,
  getDeviceSnapshot,
  pauseDevice,
  resumeDevice,
  stopDevice,
  seekDevice,
  setDeviceVolume,
  setMasterVolume,
  listPlaylists,
  reorderPlaylistTracks,
  listSessions,
  createPlaybackSession,
  recordSessionSync,
  registerLibraryUpload,
  uploadDeviceFallback,
} from '../services/audio.js';
import {
  audioPlaybackRequestSchema,
  audioPlaylistSchema,
  audioSeekSchema,
  audioVolumeSchema,
  audioMasterVolumeSchema,
  deviceIdParamSchema,
  audioPlaylistReorderSchema,
  audioPlaybackSessionSchema,
  audioSessionSyncSchema,
  audioLibraryUploadRegistrationSchema,
} from '../util/schema/audio.js';
import { createHttpError } from '../util/errors.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/overview', async (_req, res, next) => {
  res.locals.routePath = '/audio/overview';
  try {
    const overview = await getAudioOverview();
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

router.post('/library', upload.single('file'), async (req, res, next) => {
  res.locals.routePath = '/audio/library';
  try {
    const file = req.file;
    if (!file) {
      throw createHttpError(400, 'bad_request', 'Missing upload file');
    }
    const schema = z.object({
      title: z.string().min(1),
      artist: z.string().optional(),
      tags: z.string().optional(),
      durationSeconds: z.coerce.number().min(0).optional(),
      format: z.string().min(1).optional(),
    });
    const payload = schema.parse(req.body ?? {});
    const track = await createLibraryTrack({
      title: payload.title,
      artist: payload.artist,
      durationSeconds: payload.durationSeconds ?? Number((file.size / 128000).toFixed(2)),
      format: payload.format ?? file.mimetype ?? 'application/octet-stream',
      sizeBytes: file.size,
      tags: payload.tags
        ? payload.tags
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        : [],
      buffer: file.buffer,
      filename: file.originalname,
    });
    res.status(201).json(track);
  } catch (error) {
    next(error);
  }
});

router.post('/library/uploads', (req, res, next) => {
  res.locals.routePath = '/audio/library/uploads';
  try {
    const payload = audioLibraryUploadRegistrationSchema.parse(req.body ?? {});
    const registration = registerLibraryUpload(payload);
    res.status(201).json(registration);
  } catch (error) {
    next(error);
  }
});

router.post('/playlists', async (req, res, next) => {
  res.locals.routePath = '/audio/playlists';
  try {
    const payload = audioPlaylistSchema.parse(req.body);
    const playlist = await createPlaylist(payload);
    res.status(201).json(playlist);
  } catch (error) {
    next(error);
  }
});

router.get('/playlists', async (_req, res, next) => {
  res.locals.routePath = '/audio/playlists';
  try {
    const playlists = await listPlaylists();
    res.json({ items: playlists, total: playlists.length });
  } catch (error) {
    next(error);
  }
});

router.put('/playlists/:playlistId', async (req, res, next) => {
  res.locals.routePath = '/audio/playlists/:playlistId';
  try {
    const params = z.object({ playlistId: z.string().min(1) }).parse(req.params);
    const payload = audioPlaylistSchema.parse(req.body);
    const playlist = await updatePlaylist(params.playlistId, payload);
    res.json(playlist);
  } catch (error) {
    next(error);
  }
});

router.delete('/playlists/:playlistId', async (req, res, next) => {
  res.locals.routePath = '/audio/playlists/:playlistId';
  try {
    const params = z.object({ playlistId: z.string().min(1) }).parse(req.params);
    await deletePlaylist(params.playlistId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/playlists/:playlistId/reorder', async (req, res, next) => {
  res.locals.routePath = '/audio/playlists/:playlistId/reorder';
  try {
    const params = z.object({ playlistId: z.string().min(1) }).parse(req.params);
    const payload = audioPlaylistReorderSchema.parse(req.body);
    const playlist = await reorderPlaylistTracks(params.playlistId, payload);
    res.json(playlist);
  } catch (error) {
    next(error);
  }
});

router.post('/playback', async (req, res, next) => {
  res.locals.routePath = '/audio/playback';
  try {
    const payload = audioPlaybackRequestSchema.parse(req.body);
    await startPlayback(payload);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
});

router.get('/playback/sessions', async (_req, res, next) => {
  res.locals.routePath = '/audio/playback/sessions';
  try {
    const sessions = await listSessions();
    res.json({ items: sessions, total: sessions.length });
  } catch (error) {
    next(error);
  }
});

router.post('/playback/sessions', async (req, res, next) => {
  res.locals.routePath = '/audio/playback/sessions';
  try {
    const payload = audioPlaybackSessionSchema.parse(req.body);
    const session = await createPlaybackSession(payload);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

router.post('/playback/sessions/:sessionId/sync', async (req, res, next) => {
  res.locals.routePath = '/audio/playback/sessions/:sessionId/sync';
  try {
    const params = z.object({ sessionId: z.string().min(1) }).parse(req.params);
    const payload = audioSessionSyncSchema.parse(req.body);
    const sessions = await recordSessionSync(params.sessionId, payload);
    res.status(202).json({ sessions, updatedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.get('/devices/:deviceId', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const snapshot = await getDeviceSnapshot(deviceId);
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

router.post('/devices/:deviceId/pause', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/pause';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    await pauseDevice(deviceId);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
});

router.post('/devices/:deviceId/resume', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/resume';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    await resumeDevice(deviceId);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
});

router.post('/devices/:deviceId/stop', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/stop';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    await stopDevice(deviceId);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
});

router.post('/devices/:deviceId/seek', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/seek';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const payload = audioSeekSchema.parse(req.body);
    await seekDevice(deviceId, payload.positionSeconds);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
});

router.post('/devices/:deviceId/volume', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/volume';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const payload = audioVolumeSchema.parse(req.body);
    await setDeviceVolume(deviceId, payload.volumePercent);
    res.status(202).json({ accepted: true, volumePercent: payload.volumePercent });
  } catch (error) {
    next(error);
  }
});

router.post('/devices/:deviceId/upload', upload.single('file'), async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/upload';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const file = req.file;
    if (!file) {
      throw createHttpError(400, 'bad_request', 'Missing upload file');
    }

    const result = await uploadDeviceFallback(
      deviceId,
      {
        buffer: file.buffer,
        filename: file.originalname || 'upload',
        mimetype: file.mimetype,
        size: file.size,
      },
      req.correlationId
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/master-volume', async (req, res, next) => {
  res.locals.routePath = '/audio/master-volume';
  try {
    const payload = audioMasterVolumeSchema.parse(req.body);
    await setMasterVolume(payload.volumePercent);
    res.status(202).json({ accepted: true, volumePercent: payload.volumePercent });
  } catch (error) {
    next(error);
  }
});

export const audioRouter = router;
