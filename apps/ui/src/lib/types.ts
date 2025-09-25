export interface NowPlayingInfo {
  track: string;
  artist: string;
  startedAt: string;
  art?: string;
}

export type DeviceStatus = 'online' | 'offline' | 'error' | 'degraded';

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
    discovered: {
      id: string;
      name: string;
      type: string;
      signal: number;
    }[];
  };
}

export type LogSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export interface CameraEventDetection {
  id: string;
  label: string;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export type CameraEventSeverity = 'info' | 'warning' | 'alert' | 'error';

export interface CameraEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  description: string;
  severity: CameraEventSeverity;
  clipUrl?: string | null;
  snapshotUrl?: string | null;
  acknowledged?: boolean;
  detections?: CameraEventDetection[];
  tags?: string[];
}

export interface CameraDevice {
  id: string;
  name: string;
  status: DeviceStatus;
  location?: string | null;
  streamUrl?: string | null;
  stillUrl?: string | null;
  lastHeartbeat: string;
  capabilities: string[];
}

export interface CameraClip {
  id: string;
  cameraId: string;
  start: string;
  end: string;
  url: string;
  thumbnailUrl?: string | null;
  label?: string | null;
}

export type CameraEventEntrySeverity = 'info' | 'warn' | 'error';

export interface CameraEventEntry {
  id: string;
  ts: string;
  message: string;
  severity: CameraEventEntrySeverity;
  cameraId?: string | null;
  snapshotUrl?: string | null;
}

export interface CameraSummaryItem {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'degraded';
  lastSeen?: string | null;
  reason?: string | null;
}

export interface CameraOverview {
  status: 'online' | 'offline' | 'degraded';
  updatedAt: string;
  reason: string | null;
  cameras: CameraSummaryItem[];
}

export interface CameraPreviewState {
  cameraId: string | null;
  status: 'ready' | 'pending' | 'unavailable';
  posterUrl: string | null;
  streamUrl: string | null;
  reason?: string | null;
  updatedAt: string;
}

export interface CameraState {
  activeCameraId: string | null;
  devices: CameraDevice[];
  events: CameraEvent[];
  clips: CameraClip[];
  overview: {
    previewImage: string | null;
    streamUrl: string | null;
    lastMotion: string | null;
    health: DeviceStatus;
    updatedAt: string | null;
  };
  summary?: CameraOverview;
  preview?: CameraPreviewState;
  eventFeed?: CameraEventEntry[];
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  message: string;
  source: string;
  module?: string | null;
  deviceId?: string | null;
  correlationId?: string | null;
  context?: Record<string, unknown> | null;
  ts?: string;
  level?: LogLevel;
  msg?: string;
  service?: string;
  host?: string;
}

export interface LogSource {
  id: string;
  label: string;
  description?: string;
  kind: 'device' | 'service' | 'system' | 'group';
  module?: string | null;
  deviceId?: string | null;
  active?: boolean;
}

export interface LogsSnapshot {
  entries: LogEntry[];
  sources?: LogSource[];
  lastUpdated?: string;
  cursor?: string | null;
}

export interface LogsFilterState {
  sourceId: string;
  severity: LogSeverity | 'all';
  search: string;
}

export interface ApiAccessSettings {
  bearerTokenMasked: string | null;
  lastRotatedAt: string | null;
  expiresAt?: string | null;
  allowedOrigins: string[];
  webhookUrl?: string | null;
}

export interface ProxySettings {
  baseUrl: string;
  timeoutMs: number;
  health: 'online' | 'degraded' | 'offline';
  latencyMs: number;
  errorRate: number;
}

export interface PairingDiscoveryCandidate {
  id: string;
  name: string;
  capability: string;
  signal: number;
  discoveredAt: string;
}

export interface PairingHistoryEntry {
  id: string;
  completedAt: string;
  deviceId: string;
  status: 'success' | 'error';
  note?: string | null;
}

export interface PairingStatus {
  active: boolean;
  method: 'manual' | 'qr' | 'auto';
  expiresAt: string | null;
  discovered: PairingDiscoveryCandidate[];
  history: PairingHistoryEntry[];
}

export interface OperatorRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  assignable: boolean;
}

export interface OperatorAccount {
  id: string;
  name: string;
  email: string;
  roles: string[];
  lastActiveAt: string | null;
  status: 'active' | 'invited' | 'disabled';
}

export interface SettingsState {
  api: ApiAccessSettings;
  proxy: ProxySettings;
  pairing: PairingStatus;
  operators: OperatorAccount[];
  roles: OperatorRole[];
  pendingRestart: boolean;
  lastSavedAt: string | null;
}

export interface FleetDeviceMetric {
  id: string;
  label: string;
  value: string;
  unit?: string;
  status: 'ok' | 'warn' | 'error';
  trend?: 'up' | 'down' | 'steady';
  updatedAt?: string;
  description?: string;
}

export interface FleetDeviceAction {
  id: string;
  label: string;
  description?: string;
  group: 'audio' | 'video' | 'system' | 'network' | 'maintenance';
  method: 'POST' | 'PATCH' | 'DELETE';
  endpoint: string;
  requiresConfirmation?: boolean;
}

export interface FleetDeviceSummary {
  id: string;
  name: string;
  role: string;
  module: string;
  status: DeviceStatus;
  location?: string | null;
  lastSeen: string;
  uptime: string;
  ipAddress: string;
  version: string;
  groups: string[];
  tags: string[];
  capabilities: string[];
}

export interface FleetDeviceAlert {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  createdAt: string;
  acknowledged: boolean;
}

export interface FleetDeviceDetail {
  summary: FleetDeviceSummary;
  metrics: FleetDeviceMetric[];
  alerts: FleetDeviceAlert[];
  logs: LogEntry[];
  actions: FleetDeviceAction[];
  connections: { name: string; status: 'connected' | 'pending' | 'error'; lastChecked: string }[];
}

export interface FleetOverview {
  totals: {
    devices: number;
    online: number;
    offline: number;
    degraded: number;
  };
  modules: {
    id: string;
    label: string;
    online: number;
    offline: number;
    degraded: number;
  }[];
  devices: FleetDeviceSummary[];
  updatedAt: string;
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

export interface LayoutModuleDevice {
  id: string;
  name: string;
  role?: string | null;
  capabilities?: string[] | null;
}

export interface LayoutModuleSummary {
  module: string;
  displayName?: string;
  enabled?: boolean;
  description?: string | null;
  capabilities?: string[];
  devices?: LayoutModuleDevice[];
}

export interface LayoutData {
  health?: HealthData;
  errors?: EventFeedItem[];
  events?: EventFeedItem[];
  modules?: LayoutModuleSummary[];
  generatedAt?: string;
}

export interface LogsData {
  entries: LogEntry[];
  sources?: LogSource[];
  cursor?: string | null;
  lastUpdated: string;
}

export interface ConnectionProbe {
  status: 'online' | 'degraded' | 'offline';
  latencyMs: number;
}

export interface FleetStateDevice {
  id: string;
  name: string;
  role?: string;
  module?: string;
  online: boolean;
  reason?: string | null;
}

export interface FleetOverviewState {
  connection: ConnectionProbe;
  build: { commit: string; version: string };
  audio?: {
    total: number;
    online: number;
    devices: FleetStateDevice[];
  };
  updatedAt?: string;
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
