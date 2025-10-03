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
  listDeviceSnapshots,
  playDeviceSource,
  getDeviceConfig,
  setDeviceConfig,
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
import { log } from '../observability/logging.js';

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
    log.info(
      {
        title: payload.title,
        artist: payload.artist,
        sizeBytes: file.size,
        filename: file.originalname,
      },
      'Track upload to library requested'
    );
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
    log.info(
      {
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        sizeBytes: track.sizeBytes,
      },
      'Track uploaded to library'
    );
    res.status(201).json(track);
  } catch (error) {
    log.error({ error }, 'Failed to upload track to library');
    next(error);
  }
});

router.post('/library/uploads', (req, res, next) => {
  res.locals.routePath = '/audio/library/uploads';
  try {
    const payload = audioLibraryUploadRegistrationSchema.parse(req.body ?? {});
    log.info({ filename: payload.filename, sizeBytes: payload.sizeBytes }, 'Library upload registration requested');
    const registration = registerLibraryUpload(payload);
    log.info({ uploadId: registration.uploadId }, 'Library upload registered');
    res.status(201).json(registration);
  } catch (error) {
    log.error({ error }, 'Failed to register library upload');
    next(error);
  }
});

router.post('/playlists', async (req, res, next) => {
  res.locals.routePath = '/audio/playlists';
  try {
    const payload = audioPlaylistSchema.parse(req.body);
    log.info(
      {
        name: payload.name,
        trackCount: payload.tracks.length,
        syncMode: payload.syncMode,
      },
      'Playlist creation requested'
    );
    const playlist = await createPlaylist(payload);
    log.info(
      {
        playlistId: playlist.id,
        name: playlist.name,
        trackCount: playlist.tracks.length,
      },
      'Playlist created'
    );
    res.status(201).json(playlist);
  } catch (error) {
    log.error({ error }, 'Failed to create playlist');
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
    log.info(
      {
        playlistId: params.playlistId,
        name: payload.name,
        trackCount: payload.tracks.length,
      },
      'Playlist update requested'
    );
    const playlist = await updatePlaylist(params.playlistId, payload);
    log.info(
      {
        playlistId: playlist.id,
        name: playlist.name,
        trackCount: playlist.tracks.length,
      },
      'Playlist updated'
    );
    res.json(playlist);
  } catch (error) {
    log.error({ playlistId: req.params.playlistId, error }, 'Failed to update playlist');
    next(error);
  }
});

router.delete('/playlists/:playlistId', async (req, res, next) => {
  res.locals.routePath = '/audio/playlists/:playlistId';
  try {
    const params = z.object({ playlistId: z.string().min(1) }).parse(req.params);
    log.info({ playlistId: params.playlistId }, 'Playlist deletion requested');
    await deletePlaylist(params.playlistId);
    log.info({ playlistId: params.playlistId }, 'Playlist deleted');
    res.status(204).send();
  } catch (error) {
    log.error({ playlistId: req.params.playlistId, error }, 'Failed to delete playlist');
    next(error);
  }
});

router.post('/playlists/:playlistId/reorder', async (req, res, next) => {
  res.locals.routePath = '/audio/playlists/:playlistId/reorder';
  try {
    const params = z.object({ playlistId: z.string().min(1) }).parse(req.params);
    const payload = audioPlaylistReorderSchema.parse(req.body);
    log.info({ playlistId: params.playlistId, trackCount: payload.ordering.length }, 'Playlist reorder requested');
    const playlist = await reorderPlaylistTracks(params.playlistId, payload);
    log.info({ playlistId: playlist.id }, 'Playlist reordered');
    res.json(playlist);
  } catch (error) {
    log.error({ playlistId: req.params.playlistId, error }, 'Failed to reorder playlist');
    next(error);
  }
});

router.post('/playback', async (req, res, next) => {
  res.locals.routePath = '/audio/playback';
  try {
    const payload = audioPlaybackRequestSchema.parse(req.body);
    log.info(
      {
        deviceIds: payload.deviceIds,
        trackId: payload.trackId,
        playlistId: payload.playlistId,
        syncMode: payload.syncMode,
      },
      'Audio playback start requested'
    );
    await startPlayback(payload);
    log.info(
      {
        deviceIds: payload.deviceIds,
        trackId: payload.trackId,
        playlistId: payload.playlistId,
      },
      'Audio playback started'
    );
    res.status(202).json({ accepted: true });
  } catch (error) {
    log.error({ error }, 'Failed to start audio playback');
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
    log.info({ deviceIds: payload.deviceIds, syncMode: payload.syncMode }, 'Playback session creation requested');
    const session = await createPlaybackSession(payload);
    log.info({ sessionId: session.id }, 'Playback session created');
    res.status(201).json(session);
  } catch (error) {
    log.error({ error }, 'Failed to create playback session');
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

router.get('/devices', async (_req, res, next) => {
  res.locals.routePath = '/audio/devices';
  try {
    const devices = await listDeviceSnapshots();
    res.json({ devices, total: devices.length });
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

router.post('/devices/:deviceId/play', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/play';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const schema = z.object({ source: z.enum(['stream', 'file']) });
    const payload = schema.parse(req.body ?? {});
    log.info({ deviceId, source: payload.source }, 'Device play source requested');
    const result = await playDeviceSource(deviceId, payload.source, req.correlationId);
    log.info({ deviceId, source: payload.source }, 'Device play source updated');
    res.status(202).json(result);
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to play device source');
    next(error);
  }
});

router.get('/devices/:deviceId/config', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/config';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const config = await getDeviceConfig(deviceId, req.correlationId);
    res.json(config);
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to get device config');
    next(error);
  }
});

router.put('/devices/:deviceId/config', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/config';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const schema = z.object({
      stream_url: z.string().url().optional(),
      volume: z.number().min(0).max(2).optional(),
      mode: z.enum(['auto', 'manual']).optional(),
      source: z.enum(['stream', 'file', 'stop']).optional(),
    });
    const payload = schema.parse(req.body ?? {});
    log.info({ deviceId, payload }, 'Device config update requested');
    const result = await setDeviceConfig(deviceId, payload, req.correlationId);
    log.info({ deviceId }, 'Device config updated');
    res.json(result);
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to update device config');
    next(error);
  }
});

router.post('/devices/:deviceId/pause', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/pause';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    log.info({ deviceId }, 'Audio device pause requested');
    await pauseDevice(deviceId);
    log.info({ deviceId }, 'Audio device paused');
    res.status(202).json({ accepted: true });
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to pause audio device');
    next(error);
  }
});

router.post('/devices/:deviceId/resume', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/resume';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    log.info({ deviceId }, 'Audio device resume requested');
    await resumeDevice(deviceId);
    log.info({ deviceId }, 'Audio device resumed');
    res.status(202).json({ accepted: true });
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to resume audio device');
    next(error);
  }
});

router.post('/devices/:deviceId/stop', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/stop';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    log.info({ deviceId }, 'Audio device stop requested');
    await stopDevice(deviceId);
    log.info({ deviceId }, 'Audio device stopped');
    res.status(202).json({ accepted: true });
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to stop audio device');
    next(error);
  }
});

router.post('/devices/:deviceId/seek', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/seek';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const payload = audioSeekSchema.parse(req.body);
    log.info({ deviceId, positionSeconds: payload.positionSeconds }, 'Audio device seek requested');
    await seekDevice(deviceId, payload.positionSeconds);
    log.info({ deviceId, positionSeconds: payload.positionSeconds }, 'Audio device seeked');
    res.status(202).json({ accepted: true });
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to seek audio device');
    next(error);
  }
});

router.post('/devices/:deviceId/volume', async (req, res, next) => {
  res.locals.routePath = '/audio/devices/:deviceId/volume';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const payload = audioVolumeSchema.parse(req.body);
    log.info({ deviceId, volumePercent: payload.volumePercent }, 'Audio device volume change requested');
    await setDeviceVolume(deviceId, payload.volumePercent);
    log.info({ deviceId, volumePercent: payload.volumePercent }, 'Audio device volume changed');
    res.status(202).json({ accepted: true, volumePercent: payload.volumePercent });
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to change audio device volume');
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

    log.info(
      {
        deviceId,
        filename: file.originalname,
        sizeBytes: file.size,
      },
      'Device fallback upload requested'
    );
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
    log.info(
      {
        deviceId,
        filename: file.originalname,
        saved: result.saved,
        path: result.path,
      },
      'Device fallback uploaded'
    );
    res.status(201).json(result);
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to upload device fallback');
    next(error);
  }
});

router.post('/master-volume', async (req, res, next) => {
  res.locals.routePath = '/audio/master-volume';
  try {
    const payload = audioMasterVolumeSchema.parse(req.body);
    log.info({ volumePercent: payload.volumePercent }, 'Master volume change requested');
    await setMasterVolume(payload.volumePercent);
    log.info({ volumePercent: payload.volumePercent }, 'Master volume changed');
    res.status(202).json({ accepted: true, volumePercent: payload.volumePercent });
  } catch (error) {
    log.error({ error }, 'Failed to change master volume');
    next(error);
  }
});

// ==================== Streaming System Management ====================

import {
  getStreamingSystemStatus,
  listMusicLibrary,
  uploadToMusicLibrary,
  deleteFromMusicLibrary,
} from '../services/streaming.js';

router.get('/stream/status', async (_req, res, next) => {
  res.locals.routePath = '/audio/stream/status';
  try {
    const status = await getStreamingSystemStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

router.get('/stream/library', async (_req, res, next) => {
  res.locals.routePath = '/audio/stream/library';
  try {
    const files = await listMusicLibrary();
    res.json({ files, total: files.length });
  } catch (error) {
    next(error);
  }
});

router.post('/stream/library', upload.single('file'), async (req, res, next) => {
  res.locals.routePath = '/audio/stream/library';
  try {
    const file = req.file;
    if (!file) {
      throw createHttpError(400, 'bad_request', 'Missing upload file');
    }

    log.info(
      { filename: file.originalname, sizeBytes: file.size },
      'Music file upload to Liquidsoap requested'
    );

    const uploaded = await uploadToMusicLibrary(file.buffer, file.originalname);
    res.status(201).json(uploaded);
  } catch (error) {
    next(error);
  }
});

router.delete('/stream/library/:filename', async (req, res, next) => {
  res.locals.routePath = '/audio/stream/library/:filename';
  try {
    const { filename } = req.params;
    await deleteFromMusicLibrary(filename);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export const audioRouter = router;
