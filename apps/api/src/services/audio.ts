import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { prisma } from '../lib/db.js';
import { deviceRegistry } from '../upstream/devices.js';
import { fetchStatus, uploadFallback, type AudioStatus } from '../upstream/audio.js';
import { createHttpError } from '../util/errors.js';
import { logger } from '../middleware/logging.js';
import { recordEvent } from '../observability/events.js';
import type { AudioPlaylistInput, AudioPlaylistReorderInput } from '../util/schema/audio.js';

export interface LibraryTrackInput {
  title: string;
  artist?: string | null;
  durationSeconds: number;
  format: string;
  sizeBytes?: number | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  buffer: Buffer;
  filename: string;
}

const AUDIO_STORAGE_DIR = resolve(__dirname, '../../prisma/data/audio-library');

async function ensureStorageDir(): Promise<void> {
  await mkdir(AUDIO_STORAGE_DIR, { recursive: true });
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(value) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function serializeJson(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return JSON.stringify(value);
}

export interface LibraryTrack {
  id: string;
  title: string;
  artist?: string | null;
  durationSeconds: number;
  format: string;
  sizeBytes?: number | null;
  tags: string[];
  uploadedAt: Date;
}

function mapTrack(record: {
  id: string;
  title: string;
  artist: string | null;
  durationSeconds: number;
  format: string;
  sizeBytes: bigint | null;
  tagsJson: string | null;
  uploadedAt: Date;
  metadataJson: string | null;
}): LibraryTrack {
  return {
    id: record.id,
    title: record.title,
    artist: record.artist,
    durationSeconds: record.durationSeconds,
    format: record.format,
    sizeBytes: record.sizeBytes ? Number(record.sizeBytes) : null,
    tags: parseJsonArray(record.tagsJson),
    uploadedAt: record.uploadedAt,
  };
}

export async function listLibraryTracks(): Promise<LibraryTrack[]> {
  const tracks = await prisma.audioTrack.findMany({ orderBy: { uploadedAt: 'desc' } });
  return tracks.map((track) => mapTrack(track));
}

export async function createLibraryTrack(input: LibraryTrackInput) {
  await ensureStorageDir();
  const id = randomUUID();
  const sanitizedFilename = basename(input.filename).replace(/\0/g, '') || 'upload';
  const storagePath = resolve(AUDIO_STORAGE_DIR, `${id}-${sanitizedFilename}`);
  await writeFile(storagePath, input.buffer);

  const record = await prisma.audioTrack.create({
    data: {
      id,
      title: input.title,
      artist: input.artist ?? null,
      durationSeconds: input.durationSeconds,
      format: input.format,
      sizeBytes: input.sizeBytes ? BigInt(Math.max(0, Math.trunc(input.sizeBytes))) : null,
      tagsJson: serializeJson(input.tags ?? []),
      metadataJson: serializeJson(input.metadata ?? {}),
      filePath: storagePath,
    },
  });

  return mapTrack(record);
}

export async function deleteLibraryTrack(trackId: string): Promise<void> {
  await prisma.audioTrack.delete({ where: { id: trackId } });
}

export type PlaylistTrackInput = AudioPlaylistInput['tracks'][number];

export type PlaylistInput = AudioPlaylistInput;

function mapPlaylistTrack(record: {
  trackId: string;
  order: number;
  startOffsetSeconds: number | null;
  deviceOverridesJson: string | null;
}): PlaylistTrackInput {
  return {
    trackId: record.trackId,
    order: record.order,
    startOffsetSeconds: record.startOffsetSeconds ?? undefined,
    deviceOverrides: parseJsonObject<Record<string, string>>(record.deviceOverridesJson, {}),
  };
}

export async function createPlaylist(input: PlaylistInput) {
  const id = input.id ?? randomUUID();
  const playlist = await prisma.$transaction(async (tx) => {
    const created = await tx.audioPlaylist.create({
      data: {
        id,
        name: input.name,
        description: input.description ?? null,
        loop: input.loop,
        syncMode: input.syncMode,
        tracks: {
          create: input.tracks.map((track, index) => ({
            id: randomUUID(),
            trackId: track.trackId,
            order: track.order ?? index,
            startOffsetSeconds: track.startOffsetSeconds ?? null,
            deviceOverridesJson: serializeJson(track.deviceOverrides ?? {}),
          })),
        },
      },
      include: { tracks: { orderBy: { order: 'asc' } } },
    });
    return created;
  });

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    loop: playlist.loop,
    syncMode: playlist.syncMode,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
    tracks: playlist.tracks.map(mapPlaylistTrack),
  };
}

export async function updatePlaylist(playlistId: string, input: PlaylistInput) {
  const playlist = await prisma.$transaction(async (tx) => {
    await tx.audioPlaylistTrack.deleteMany({ where: { playlistId } });
    const updated = await tx.audioPlaylist.update({
      where: { id: playlistId },
      data: {
        name: input.name,
        description: input.description ?? null,
        loop: input.loop,
        syncMode: input.syncMode,
        tracks: {
          create: input.tracks.map((track, index) => ({
            id: randomUUID(),
            trackId: track.trackId,
            order: track.order ?? index,
            startOffsetSeconds: track.startOffsetSeconds ?? null,
            deviceOverridesJson: serializeJson(track.deviceOverrides ?? {}),
          })),
        },
      },
      include: { tracks: { orderBy: { order: 'asc' } } },
    });
    return updated;
  });

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    loop: playlist.loop,
    syncMode: playlist.syncMode,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
    tracks: playlist.tracks.map(mapPlaylistTrack),
  };
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  await prisma.audioPlaylist.delete({ where: { id: playlistId } });
}

export async function reorderPlaylistTracks(playlistId: string, input: AudioPlaylistReorderInput) {
  const playlist = await prisma.audioPlaylist.findUnique({
    where: { id: playlistId },
    include: { tracks: { orderBy: { order: 'asc' } } },
  });

  if (!playlist) {
    throw createHttpError(404, 'not_found', 'Playlist not found');
  }

  const trackMap = new Map(playlist.tracks.map((track) => [track.trackId, track]));
  if (trackMap.size !== input.ordering.length) {
    throw new Error('Track ordering does not match playlist');
  }

  for (const entry of input.ordering) {
    if (!trackMap.has(entry.trackId)) {
      throw new Error(`Track ${entry.trackId} not part of playlist`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      input.ordering.map((entry) => {
        const track = trackMap.get(entry.trackId)!;
        return tx.audioPlaylistTrack.update({
          where: { id: track.id },
          data: { order: entry.position },
        });
      })
    );
  });

  const updated = await prisma.audioPlaylist.findUniqueOrThrow({
    where: { id: playlistId },
    include: { tracks: { orderBy: { order: 'asc' } } },
  });

  return {
    id: updated.id,
    name: updated.name,
    description: updated.description,
    loop: updated.loop,
    syncMode: updated.syncMode,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    tracks: updated.tracks.map(mapPlaylistTrack),
  };
}

export interface PlaybackAssignment {
  deviceId: string;
  trackId: string;
  startOffsetSeconds?: number | null;
}

export interface PlaybackRequest {
  deviceIds: string[];
  playlistId?: string | null;
  trackId?: string | null;
  assignments?: PlaybackAssignment[];
  syncMode: string;
}

interface DevicePlaybackState {
  state: string;
  trackId?: string | null;
  trackTitle?: string | null;
  playlistId?: string | null;
  positionSeconds: number;
  durationSeconds: number;
  startedAt?: string | null;
  syncGroup?: string | null;
  lastError?: string | null;
  driftSeconds?: number;
}

async function ensureDeviceStatus(deviceId: string): Promise<void> {
  const existing = await prisma.audioDeviceStatus.findUnique({ where: { deviceId } });
  if (existing) {
    return;
  }
  const registryDevice = deviceRegistry.getDevice(deviceId);
  await prisma.audioDeviceStatus.create({
    data: {
      deviceId,
      name: registryDevice?.name ?? deviceId,
      status: 'online',
      group: registryDevice?.module,
      volumePercent: 50,
      capabilitiesJson:
        serializeJson(
          registryDevice?.capabilities ?? ['playback', 'seek', 'sync', 'upload', 'volume']
        ) ?? '[]',
      playbackJson: JSON.stringify({
        state: 'idle',
        positionSeconds: 0,
        durationSeconds: 0,
        startedAt: null,
        syncGroup: null,
      }),
      lastUpdated: new Date(),
      timelineJson: serializeJson([]),
    },
  });
}

function appendTimeline(timelineJson: string | null, entry: Record<string, unknown>) {
  const timeline = parseJsonObject<Record<string, unknown>[]>(timelineJson, []);
  timeline.push({ ...entry, at: new Date().toISOString() });
  return JSON.stringify(timeline.slice(-50));
}

async function updateDevicePlayback(
  deviceId: string,
  playback: Partial<DevicePlaybackState>,
  extraTimeline?: Record<string, unknown>
) {
  await ensureDeviceStatus(deviceId);
  const current = await prisma.audioDeviceStatus.findUniqueOrThrow({ where: { deviceId } });
  const existingPlayback = parseJsonObject<DevicePlaybackState>(current.playbackJson, {
    state: 'idle',
    positionSeconds: 0,
    durationSeconds: 0,
    startedAt: null,
    syncGroup: null,
    driftSeconds: 0,
  });
  const updatedPlayback: DevicePlaybackState = {
    ...existingPlayback,
    ...playback,
    positionSeconds: playback.positionSeconds ?? existingPlayback.positionSeconds ?? 0,
    durationSeconds: playback.durationSeconds ?? existingPlayback.durationSeconds ?? 0,
    driftSeconds: playback.driftSeconds ?? existingPlayback.driftSeconds ?? 0,
  };

  await prisma.audioDeviceStatus.update({
    where: { deviceId },
    data: {
      playbackJson: JSON.stringify(updatedPlayback),
      timelineJson: appendTimeline(current.timelineJson, extraTimeline ?? playback),
    },
  });
}

export async function startPlayback(request: PlaybackRequest): Promise<string> {
  const sessionId = randomUUID();
  const deviceIds = Array.from(new Set(request.deviceIds));
  if (deviceIds.length === 0) {
    throw new Error('No device IDs provided');
  }

  const assignmentMap = new Map<
    string,
    { trackId: string; startOffsetSeconds: number; trackTitle: string; durationSeconds: number }
  >();

  if (request.assignments?.length) {
    for (const assignment of request.assignments) {
      const track = await prisma.audioTrack.findUniqueOrThrow({
        where: { id: assignment.trackId },
      });
      assignmentMap.set(assignment.deviceId, {
        trackId: track.id,
        startOffsetSeconds: assignment.startOffsetSeconds ?? 0,
        trackTitle: track.title,
        durationSeconds: track.durationSeconds,
      });
    }
  }

  let defaultTrackId: string | undefined;
  let defaultTrackTitle: string | undefined;
  let defaultDuration = 0;

  if (request.trackId) {
    const track = await prisma.audioTrack.findUniqueOrThrow({ where: { id: request.trackId } });
    defaultTrackId = track.id;
    defaultTrackTitle = track.title;
    defaultDuration = track.durationSeconds;
  }

  if (request.playlistId) {
    const playlist = await prisma.audioPlaylist.findUnique({
      where: { id: request.playlistId },
      include: { tracks: { orderBy: { order: 'asc' }, include: { track: true } } },
    });
    if (!playlist) {
      throw createHttpError(404, 'not_found', 'Playlist not found');
    }
    const first = playlist.tracks[0]?.track;
    if (first) {
      defaultTrackId = first.id;
      defaultTrackTitle = first.title;
      defaultDuration = first.durationSeconds;
    }
  }

  await prisma.audioSession.create({
    data: {
      id: sessionId,
      playlistId: request.playlistId ?? null,
      trackId: request.trackId ?? null,
      deviceIdsJson: JSON.stringify(deviceIds),
      assignmentsJson: serializeJson(request.assignments ?? []),
      syncMode: request.syncMode,
      state: 'playing',
      driftJson: JSON.stringify({
        maxDriftSeconds: 0,
        perDevice: Object.fromEntries(deviceIds.map((id) => [id, 0])),
      }),
    },
  });

  await Promise.all(
    deviceIds.map(async (deviceId, index) => {
      const assignment = assignmentMap.get(deviceId);
      if (!assignment && !defaultTrackId) {
        throw new Error('No track assigned for device');
      }
      await updateDevicePlayback(
        deviceId,
        {
          state: 'playing',
          trackId: assignment?.trackId ?? defaultTrackId ?? null,
          trackTitle: assignment?.trackTitle ?? defaultTrackTitle ?? null,
          playlistId: request.playlistId ?? null,
          positionSeconds: assignment?.startOffsetSeconds ?? 0,
          durationSeconds: assignment?.durationSeconds ?? defaultDuration,
          startedAt: new Date().toISOString(),
          syncGroup: request.syncMode !== 'independent' ? sessionId : null,
          driftSeconds: 0,
        },
        {
          event: 'play',
          sessionId,
          order: index,
        }
      );
    })
  );

  return sessionId;
}

export async function createPlaybackSession(request: PlaybackRequest) {
  const sessionId = await startPlayback(request);
  const created = await prisma.audioSession.findUniqueOrThrow({ where: { id: sessionId } });
  return {
    id: created.id,
    playlistId: created.playlistId,
    trackId: created.trackId,
    deviceIds: parseJsonArray(created.deviceIdsJson),
    syncMode: created.syncMode,
    state: created.state,
    startedAt: created.startedAt,
    lastError: created.lastError ?? null,
    drift: parseJsonObject(created.driftJson, { maxDriftSeconds: 0, perDevice: {} }),
  };
}

export async function pauseDevice(deviceId: string) {
  await updateDevicePlayback(deviceId, { state: 'paused' }, { event: 'pause' });
}

export async function resumeDevice(deviceId: string) {
  await updateDevicePlayback(
    deviceId,
    { state: 'playing', startedAt: new Date().toISOString() },
    { event: 'resume' }
  );
}

export async function stopDevice(deviceId: string) {
  await updateDevicePlayback(
    deviceId,
    { state: 'idle', trackId: null, trackTitle: null, playlistId: null, positionSeconds: 0 },
    { event: 'stop' }
  );
}

export async function seekDevice(deviceId: string, positionSeconds: number) {
  await updateDevicePlayback(deviceId, { positionSeconds }, { event: 'seek', positionSeconds });
}

export async function setDeviceVolume(deviceId: string, volumePercent: number, correlationId?: string) {
  await ensureDeviceStatus(deviceId);

  // Get device to call its API
  const device = deviceRegistry.getDevice(deviceId);
  if (!device) {
    throw createHttpError(404, 'not_found', `Device ${deviceId} not found`);
  }

  // Convert from 0-100 percent to 0-2.0 volume range
  const volume = (volumePercent / 100) * 2.0;

  // Call the device's audio-control API
  const { setVolume } = await import('../upstream/audio.js');
  await setVolume(device, volume, correlationId);

  // Update database
  const current = await prisma.audioDeviceStatus.findUniqueOrThrow({ where: { deviceId } });
  await prisma.audioDeviceStatus.update({
    where: { deviceId },
    data: {
      volumePercent,
      timelineJson: appendTimeline(current.timelineJson, { event: 'volume', volumePercent }),
    },
  });
}

export async function setMasterVolume(volumePercent: number) {
  await prisma.audioSetting.upsert({
    where: { key: 'masterVolume' },
    create: { key: 'masterVolume', value: String(volumePercent) },
    update: { value: String(volumePercent) },
  });
}

interface DeviceUploadResult {
  deviceId: string;
  saved: boolean;
  path: string;
  fallbackExists: boolean;
  status: Awaited<ReturnType<typeof fetchStatus>>;
}

export async function uploadDeviceFallback(
  deviceId: string,
  file: { buffer: Buffer; filename: string; mimetype?: string; size: number },
  correlationId?: string
): Promise<DeviceUploadResult> {
  const device = deviceRegistry.requireDevice(deviceId);

  const uploadResult = await uploadFallback(
    device,
    {
      buffer: file.buffer,
      filename: file.filename,
      mimetype: file.mimetype,
    },
    correlationId
  );

  const status = await fetchStatus(device, correlationId);
  if (!status.fallback_exists) {
    throw createHttpError(502, 'upstream_error', `Device ${deviceId} did not report fallback presence`);
  }

  await ensureDeviceStatus(deviceId);
  const current = await prisma.audioDeviceStatus.findUniqueOrThrow({ where: { deviceId } });
  await prisma.audioDeviceStatus.update({
    where: { deviceId },
    data: {
      lastError: null,
      timelineJson: appendTimeline(current.timelineJson, {
        event: 'upload',
        filename: file.filename,
        sizeBytes: file.size,
        path: uploadResult.path,
      }),
    },
  });

  logger.info({
    msg: 'audio.upload',
    deviceId,
    filename: file.filename,
    sizeBytes: file.size,
    path: uploadResult.path,
    saved: uploadResult.saved,
    correlationId,
  });

  recordEvent({
    type: 'audio.upload',
    severity: 'info',
    target: deviceId,
    message: `Fallback uploaded (${file.filename})`,
    metadata: {
      sizeBytes: file.size,
      path: uploadResult.path,
      saved: uploadResult.saved,
      correlationId,
    },
  });

  return {
    deviceId,
    saved: uploadResult.saved,
    path: uploadResult.path,
    fallbackExists: status.fallback_exists,
    status,
  };
}

export async function getMasterVolume(): Promise<number> {
  const record = await prisma.audioSetting.findUnique({ where: { key: 'masterVolume' } });
  return record ? Number.parseInt(record.value, 10) : 50;
}

export async function getDeviceSnapshot(deviceId: string) {
  await ensureDeviceStatus(deviceId);
  const record = await prisma.audioDeviceStatus.findUniqueOrThrow({ where: { deviceId } });
  const playback = parseJsonObject<DevicePlaybackState>(record.playbackJson, {
    state: 'idle',
    positionSeconds: 0,
    durationSeconds: 0,
    startedAt: null,
    syncGroup: null,
    driftSeconds: 0,
  });

  // Check Snapcast connection status by fetching live device status
  try {
    const device = deviceRegistry.getDevice(deviceId);
    if (device) {
      const status = await fetchStatus(device);
      if (status.snapcast_connected) {
        // If Snapcast is connected, set syncGroup to indicate synchronized playback
        playback.syncGroup = 'snapcast';
      }
    }
  } catch (error) {
    // Ignore errors fetching Snapcast status - device may be offline
    logger.debug({ msg: 'audio.snapcast_status_check_failed', deviceId, error });
  }

  return {
    id: record.deviceId,
    name: record.name,
    status: record.status,
    group: record.group,
    volumePercent: record.volumePercent,
    capabilities: parseJsonArray(record.capabilitiesJson),
    playback,
    lastUpdated: record.lastUpdated,
    lastError: record.lastError ?? null,
    timeline: parseJsonObject(record.timelineJson, []),
  };
}

export async function listDeviceSnapshots() {
  const records = await prisma.audioDeviceStatus.findMany({ orderBy: { deviceId: 'asc' } });
  return Promise.all(records.map((record) => getDeviceSnapshot(record.deviceId)));
}

export async function listPlaylists() {
  const playlists = await prisma.audioPlaylist.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { tracks: { orderBy: { order: 'asc' } } },
  });
  return playlists.map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    loop: playlist.loop,
    syncMode: playlist.syncMode,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
    tracks: playlist.tracks.map(mapPlaylistTrack),
  }));
}

export async function listSessions() {
  const sessions = await prisma.audioSession.findMany({ orderBy: { startedAt: 'desc' } });
  return sessions.map((session) => ({
    id: session.id,
    playlistId: session.playlistId,
    trackId: session.trackId,
    deviceIds: parseJsonArray(session.deviceIdsJson),
    syncMode: session.syncMode,
    state: session.state,
    startedAt: session.startedAt,
    lastError: session.lastError ?? null,
    drift: parseJsonObject(session.driftJson, { maxDriftSeconds: 0, perDevice: {} }),
  }));
}

export async function recordSessionSync(
  sessionId: string,
  payload: {
    referenceTimestamp: string;
    maxDriftSeconds: number;
    perDevice: Record<string, number>;
    correctionsApplied: boolean;
  }
) {
  const existing = await prisma.audioSession.findUnique({ where: { id: sessionId } });
  if (!existing) {
    throw createHttpError(404, 'not_found', 'Session not found');
  }

  await prisma.audioSession.update({
    where: { id: sessionId },
    data: {
      driftJson: JSON.stringify({
        referenceTimestamp: payload.referenceTimestamp,
        maxDriftSeconds: payload.maxDriftSeconds,
        perDevice: payload.perDevice,
        correctionsApplied: payload.correctionsApplied,
      }),
    },
  });

  return listSessions();
}

export function registerLibraryUpload(input: {
  filename: string;
  contentType: string;
  sizeBytes?: number;
  title?: string;
  artist?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}) {
  const uploadId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

  return {
    uploadId,
    filename: input.filename,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes ?? null,
    title: input.title ?? null,
    artist: input.artist ?? null,
    tags: input.tags ?? [],
    metadata: input.metadata ?? {},
    uploadUrl: `https://uploads.example/${uploadId}`,
    expiresAt: expiresAt.toISOString(),
    fields: {
      policy: Buffer.from(JSON.stringify({ bucket: 'audio-library', key: uploadId })).toString(
        'base64'
      ),
      algorithm: 'AWS4-HMAC-SHA256',
      credential: `mock/${now.toISOString().slice(0, 10).replace(/-/g, '')}/auto/s3/aws4_request`,
    },
  };
}

export async function getAudioOverview() {
  const [masterVolume, devices, library, playlists, sessions] = await Promise.all([
    getMasterVolume(),
    listDeviceSnapshots(),
    listLibraryTracks(),
    listPlaylists(),
    listSessions(),
  ]);

  return {
    masterVolume,
    devices,
    library,
    playlists,
    sessions,
  };
}

export async function recordDeviceError(deviceId: string, message: string) {
  await ensureDeviceStatus(deviceId);
  const current = await prisma.audioDeviceStatus.findUniqueOrThrow({ where: { deviceId } });
  await prisma.audioDeviceStatus.update({
    where: { deviceId },
    data: {
      status: 'degraded',
      lastError: message,
      timelineJson: appendTimeline(current.timelineJson, { event: 'error', message }),
    },
  });
}

/**
 * Auto-upload default fallback file to device if it doesn't exist.
 * This ensures devices always have a fallback file for resilient playback.
 */
async function autoUploadFallback(deviceId: string, correlationId?: string): Promise<boolean> {
  const device = deviceRegistry.getDevice(deviceId);
  if (!device) {
    return false;
  }

  try {
    // Check if device already has fallback
    const status = await fetchStatus(device, correlationId);
    if (status.fallback_exists) {
      logger.debug({ msg: 'audio.fallback_exists', deviceId, correlationId });
      return true;
    }

    // Try to upload default fallback from VPS
    const defaultFallbackPath = '/srv/Audio/fallback.mp3';
    const fs = await import('node:fs/promises');

    try {
      const fallbackBuffer = await fs.readFile(defaultFallbackPath);
      const fallbackStats = await fs.stat(defaultFallbackPath);

      await uploadDeviceFallback(
        deviceId,
        {
          buffer: fallbackBuffer,
          filename: 'fallback.mp3',
          mimetype: 'audio/mpeg',
          size: fallbackStats.size,
        },
        correlationId
      );

      logger.info({
        msg: 'audio.auto_upload_fallback',
        deviceId,
        sizeBytes: fallbackStats.size,
        correlationId,
      });

      recordEvent({
        type: 'audio.auto_upload',
        severity: 'info',
        target: deviceId,
        message: 'Default fallback auto-uploaded',
        metadata: { sizeBytes: fallbackStats.size, correlationId },
      });

      return true;
    } catch (fileError) {
      // Default fallback doesn't exist on VPS - log but don't fail
      logger.warn({
        msg: 'audio.fallback_missing',
        deviceId,
        path: defaultFallbackPath,
        error: fileError instanceof Error ? fileError.message : String(fileError),
        correlationId,
      });
      return false;
    }
  } catch (error) {
    logger.error({
      msg: 'audio.auto_upload_failed',
      deviceId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    });
    return false;
  }
}

/**
 * Play specific source (stream or file) on a device.
 * This is direct device control, not library-based playback.
 * Auto-uploads fallback file on first play if it doesn't exist.
 */
export async function playDeviceSource(
  deviceId: string,
  source: 'stream' | 'file',
  correlationId?: string
) {
  const device = deviceRegistry.getDevice(deviceId);
  if (!device) {
    throw createHttpError(404, 'not_found', `Device ${deviceId} not found`);
  }

  // Auto-upload fallback before first playback (non-blocking)
  autoUploadFallback(deviceId, correlationId).catch((error) => {
    logger.warn({
      msg: 'audio.auto_upload_background_error',
      deviceId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    });
  });

  const { play } = await import('../upstream/audio.js');
  return play(device, { source }, correlationId);
}

/**
 * Get device configuration (mode, source, stream_url, volume).
 */
export async function getDeviceConfig(deviceId: string, correlationId?: string) {
  const device = deviceRegistry.getDevice(deviceId);
  if (!device) {
    throw createHttpError(404, 'not_found', `Device ${deviceId} not found`);
  }

  const { fetchConfig } = await import('../upstream/audio.js');
  return fetchConfig(device, correlationId);
}

/**
 * Update device configuration.
 */
export async function setDeviceConfig(
  deviceId: string,
  payload: {
    stream_url?: string;
    volume?: number;
    mode?: 'auto' | 'manual';
    source?: 'stream' | 'file' | 'stop';
  },
  correlationId?: string
) {
  const device = deviceRegistry.getDevice(deviceId);
  if (!device) {
    throw createHttpError(404, 'not_found', `Device ${deviceId} not found`);
  }

  const { updateConfig } = await import('../upstream/audio.js');
  return updateConfig(device, payload, correlationId);
}
