import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { prisma } from '../lib/db.js';
import { deviceRegistry } from '../upstream/devices.js';

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

function mapTrack(record: { id: string; title: string; artist: string | null; durationSeconds: number; format: string; sizeBytes: bigint | null; tagsJson: string | null; uploadedAt: Date; metadataJson: string | null }): LibraryTrack {
  return {
    id: record.id,
    title: record.title,
    artist: record.artist,
    durationSeconds: record.durationSeconds,
    format: record.format,
    sizeBytes: record.sizeBytes ? Number(record.sizeBytes) : null,
    tags: parseJsonArray(record.tagsJson),
    uploadedAt: record.uploadedAt
  };
}

export async function listLibraryTracks(): Promise<LibraryTrack[]> {
  const tracks = await prisma.audioTrack.findMany({ orderBy: { uploadedAt: 'desc' } });
  return tracks.map((track) => mapTrack(track));
}

export async function createLibraryTrack(input: LibraryTrackInput) {
  await ensureStorageDir();
  const id = randomUUID();
  const storagePath = resolve(AUDIO_STORAGE_DIR, `${id}-${input.filename}`);
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
      filePath: storagePath
    }
  });

  return mapTrack(record);
}

export async function deleteLibraryTrack(trackId: string): Promise<void> {
  await prisma.audioTrack.delete({ where: { id: trackId } });
}

export interface PlaylistTrackInput {
  trackId: string;
  order: number;
  startOffsetSeconds?: number | null;
  deviceOverrides?: Record<string, string> | null;
}

export interface PlaylistInput {
  id?: string;
  name: string;
  description?: string | null;
  loop: boolean;
  syncMode: string;
  tracks: PlaylistTrackInput[];
}

function mapPlaylistTrack(record: { trackId: string; order: number; startOffsetSeconds: number | null; deviceOverridesJson: string | null }): PlaylistTrackInput {
  return {
    trackId: record.trackId,
    order: record.order,
    startOffsetSeconds: record.startOffsetSeconds ?? undefined,
    deviceOverrides: parseJsonObject<Record<string, string>>(record.deviceOverridesJson, {})
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
            deviceOverridesJson: serializeJson(track.deviceOverrides ?? {})
          }))
        }
      },
      include: { tracks: { orderBy: { order: 'asc' } } }
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
    tracks: playlist.tracks.map(mapPlaylistTrack)
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
            deviceOverridesJson: serializeJson(track.deviceOverrides ?? {})
          }))
        }
      },
      include: { tracks: { orderBy: { order: 'asc' } } }
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
    tracks: playlist.tracks.map(mapPlaylistTrack)
  };
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  await prisma.audioPlaylist.delete({ where: { id: playlistId } });
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
      capabilitiesJson: serializeJson(registryDevice?.capabilities ?? ['playback', 'seek', 'sync', 'upload', 'volume']) ?? '[]',
      playbackJson: JSON.stringify({
        state: 'idle',
        positionSeconds: 0,
        durationSeconds: 0,
        startedAt: null,
        syncGroup: null
      }),
      lastUpdated: new Date(),
      timelineJson: serializeJson([])
    }
  });
}

function appendTimeline(timelineJson: string | null, entry: Record<string, unknown>) {
  const timeline = parseJsonObject<Record<string, unknown>[]>(timelineJson, []);
  timeline.push({ ...entry, at: new Date().toISOString() });
  return JSON.stringify(timeline.slice(-50));
}

async function updateDevicePlayback(deviceId: string, playback: Partial<DevicePlaybackState>, extraTimeline?: Record<string, unknown>) {
  await ensureDeviceStatus(deviceId);
  const current = await prisma.audioDeviceStatus.findUniqueOrThrow({ where: { deviceId } });
  const existingPlayback = parseJsonObject<DevicePlaybackState>(current.playbackJson, {
    state: 'idle',
    positionSeconds: 0,
    durationSeconds: 0,
    startedAt: null,
    syncGroup: null,
    driftSeconds: 0
  });
  const updatedPlayback: DevicePlaybackState = {
    ...existingPlayback,
    ...playback,
    positionSeconds: playback.positionSeconds ?? existingPlayback.positionSeconds ?? 0,
    durationSeconds: playback.durationSeconds ?? existingPlayback.durationSeconds ?? 0,
    driftSeconds: playback.driftSeconds ?? existingPlayback.driftSeconds ?? 0
  };

  await prisma.audioDeviceStatus.update({
    where: { deviceId },
    data: {
      playbackJson: JSON.stringify(updatedPlayback),
      timelineJson: appendTimeline(current.timelineJson, extraTimeline ?? playback)
    }
  });
}

export async function startPlayback(request: PlaybackRequest): Promise<string> {
  const sessionId = randomUUID();
  const deviceIds = Array.from(new Set(request.deviceIds));
  if (deviceIds.length === 0) {
    throw new Error('No device IDs provided');
  }

  const assignmentMap = new Map<string, { trackId: string; startOffsetSeconds: number; trackTitle: string; durationSeconds: number }>();

  if (request.assignments?.length) {
    for (const assignment of request.assignments) {
      const track = await prisma.audioTrack.findUniqueOrThrow({ where: { id: assignment.trackId } });
      assignmentMap.set(assignment.deviceId, {
        trackId: track.id,
        startOffsetSeconds: assignment.startOffsetSeconds ?? 0,
        trackTitle: track.title,
        durationSeconds: track.durationSeconds
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
      include: { tracks: { orderBy: { order: 'asc' }, include: { track: true } } }
    });
    if (!playlist) {
      throw new Error('Playlist not found');
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
        perDevice: Object.fromEntries(deviceIds.map((id) => [id, 0]))
      })
    }
  });

  await Promise.all(
    deviceIds.map(async (deviceId, index) => {
      const assignment = assignmentMap.get(deviceId);
      if (!assignment && !defaultTrackId) {
        throw new Error('No track assigned for device');
      }
      await updateDevicePlayback(deviceId, {
        state: 'playing',
        trackId: assignment?.trackId ?? defaultTrackId ?? null,
        trackTitle: assignment?.trackTitle ?? defaultTrackTitle ?? null,
        playlistId: request.playlistId ?? null,
        positionSeconds: assignment?.startOffsetSeconds ?? 0,
        durationSeconds: assignment?.durationSeconds ?? defaultDuration,
        startedAt: new Date().toISOString(),
        syncGroup: request.syncMode !== 'independent' ? sessionId : null,
        driftSeconds: 0
      }, {
        event: 'play',
        sessionId,
        order: index
      });
    })
  );

  return sessionId;
}

export async function pauseDevice(deviceId: string) {
  await updateDevicePlayback(deviceId, { state: 'paused' }, { event: 'pause' });
}

export async function resumeDevice(deviceId: string) {
  await updateDevicePlayback(deviceId, { state: 'playing', startedAt: new Date().toISOString() }, { event: 'resume' });
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

export async function setDeviceVolume(deviceId: string, volumePercent: number) {
  await ensureDeviceStatus(deviceId);
  const current = await prisma.audioDeviceStatus.findUniqueOrThrow({ where: { deviceId } });
  await prisma.audioDeviceStatus.update({
    where: { deviceId },
    data: {
      volumePercent,
      timelineJson: appendTimeline(current.timelineJson, { event: 'volume', volumePercent })
    }
  });
}

export async function setMasterVolume(volumePercent: number) {
  await prisma.audioSetting.upsert({
    where: { key: 'masterVolume' },
    create: { key: 'masterVolume', value: String(volumePercent) },
    update: { value: String(volumePercent) }
  });
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
    driftSeconds: 0
  });
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
    timeline: parseJsonObject(record.timelineJson, [])
  };
}

export async function listDeviceSnapshots() {
  const records = await prisma.audioDeviceStatus.findMany({ orderBy: { deviceId: 'asc' } });
  return Promise.all(records.map((record) => getDeviceSnapshot(record.deviceId)));
}

export async function listPlaylists() {
  const playlists = await prisma.audioPlaylist.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { tracks: { orderBy: { order: 'asc' } } }
  });
  return playlists.map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    loop: playlist.loop,
    syncMode: playlist.syncMode,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
    tracks: playlist.tracks.map(mapPlaylistTrack)
  }));
}

export async function listSessions() {
  const sessions = await prisma.audioSession.findMany({ orderBy: { startedAt: 'desc' } });
  return sessions.map((session) => ({
    id: session.id,
    playlistId: session.playlistId,
    deviceIds: parseJsonArray(session.deviceIdsJson),
    syncMode: session.syncMode,
    state: session.state,
    startedAt: session.startedAt,
    lastError: session.lastError ?? null,
    drift: parseJsonObject(session.driftJson, { maxDriftSeconds: 0, perDevice: {} })
  }));
}

export async function getAudioOverview() {
  const [masterVolume, devices, library, playlists, sessions] = await Promise.all([
    getMasterVolume(),
    listDeviceSnapshots(),
    listLibraryTracks(),
    listPlaylists(),
    listSessions()
  ]);

  return {
    masterVolume,
    devices,
    library,
    playlists,
    sessions
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
      timelineJson: appendTimeline(current.timelineJson, { event: 'error', message })
    }
  });
}
