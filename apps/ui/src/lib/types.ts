export interface NowPlayingInfo {
  track: string;
  artist: string;
  startedAt: string;
  art?: string;
}

export type DeviceStatus = 'online' | 'offline' | 'error';

export type AudioPlaybackStateName = 'idle' | 'playing' | 'paused' | 'buffering' | 'error';

export interface AudioDevicePlayback {
  state: AudioPlaybackStateName;
  trackId: string | null;
  trackTitle: string | null;
  playlistId: string | null;
  positionSeconds: number;
  durationSeconds: number;
  startedAt: string | null;
  syncGroup: string | null;
  lastError?: string | null;
}

export interface AudioDeviceSnapshot {
  id: string;
  name: string;
  status: DeviceStatus;
  group?: string | null;
  volumePercent: number;
  capabilities: string[];
  playback: AudioDevicePlayback;
  lastUpdated: string;
}

export interface AudioLibraryTrack {
  id: string;
  title: string;
  artist?: string | null;
  durationSeconds: number;
  format: string;
  sizeBytes?: number;
  tags?: string[];
  uploadedAt: string;
}

export interface AudioPlaylistTrack {
  trackId: string;
  order: number;
  startOffsetSeconds?: number;
  deviceOverrides?: Record<string, string>;
}

export type AudioSyncMode = 'independent' | 'synced' | 'grouped';

export interface AudioPlaylist {
  id: string;
  name: string;
  description?: string | null;
  loop: boolean;
  syncMode: AudioSyncMode;
  createdAt: string;
  updatedAt: string;
  tracks: AudioPlaylistTrack[];
}

export interface AudioSession {
  id: string;
  playlistId?: string | null;
  deviceIds: string[];
  syncMode: AudioSyncMode;
  state: 'preparing' | 'playing' | 'paused' | 'completed' | 'error';
  startedAt: string;
}

export interface AudioState {
  masterVolume: number;
  devices: AudioDeviceSnapshot[];
  library: AudioLibraryTrack[];
  playlists: AudioPlaylist[];
  sessions: AudioSession[];
  message?: string;
}

export type PowerState = 'on' | 'off';

export interface VideoInputOption {
  id: string;
  label: string;
  kind: 'hdmi' | 'cast' | 'app' | 'other';
}

export interface VideoLiveStream {
  deviceId: string;
  streamUrl: string;
  thumbnailUrl?: string;
  startedAt: string;
  latencyMs: number;
  status: 'ready' | 'connecting' | 'error';
}

export interface VideoRecordingSegment {
  id: string;
  start: string;
  end: string;
  label?: string | null;
  url: string;
}

export interface VideoCecDevice {
  id: string;
  name: string;
  power: PowerState;
  input?: string | null;
}

export interface VideoState {
  power: PowerState;
  input: string;
  availableInputs: VideoInputOption[];
  livePreview: VideoLiveStream | null;
  recordings: VideoRecordingSegment[];
  volume: number;
  muted: boolean;
  lastSignal: string;
  cecDevices: VideoCecDevice[];
}

export interface ZigbeeDevice {
  id: string;
  name: string;
  type: string;
  state: 'open' | 'closed' | 'active' | 'inactive';
  lastSeen: string;
  battery?: number;
}

export interface ZigbeeState {
  devices: ZigbeeDevice[];
  quickActions: { id: string; label: string; description: string }[];
  hubStatus: DeviceStatus;
  pairing?: {
    active: boolean;
    expiresAt?: string;
    discovered: Array<{
      id: string;
      name: string;
      type: string;
      signal: number;
    }>;
  };
}

export interface CameraEvent {
  id: string;
  timestamp: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
}

export interface CameraState {
  previewImage: string;
  lastMotion: string | null;
  events: CameraEvent[];
}

export interface HealthTile {
  id: string;
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'error' | 'offline';
  hint?: string;
  link?: { label: string; href: RoutePath | `http${string}` | `https${string}` };
}

export interface HealthData {
  updatedAt: string;
  uptime: string;
  metrics: HealthTile[];
}

export interface EventFeedItem {
  id: string;
  timestamp: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  actionLabel?: string;
}

export interface LayoutData {
  health: HealthData;
  errors: EventFeedItem[];
  events: EventFeedItem[];
}

export interface LogsData {
  entries: EventFeedItem[];
  cursor?: string;
}

export interface ConnectionProbe {
  status: 'online' | 'degraded' | 'offline';
  latencyMs: number;
}
export type RoutePath =
  | '/'
  | '/audio'
  | '/video'
  | '/zigbee'
  | '/camera'
  | '/health'
  | '/logs'
  | '/fleet'
  | '/fleet/layout'
  | `/fleet/${string}`;
