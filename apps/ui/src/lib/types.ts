export interface NowPlayingInfo {
  track: string;
  artist: string;
  startedAt: string;
  art?: string;
}

export type DeviceStatus = 'online' | 'offline' | 'error';

export interface AudioDevice {
  id: string;
  name: string;
  status: DeviceStatus;
  nowPlaying?: string;
  volume: number;
  isPlaying: boolean;
  lastUpdated: string;
}

export interface AudioState {
  masterVolume: number;
  nowPlaying: NowPlayingInfo | null;
  devices: AudioDevice[];
  message?: string;
}

export type PowerState = 'on' | 'off';

export interface VideoState {
  power: PowerState;
  input: string;
  volume: number;
  muted: boolean;
  previewImage: string;
  availableInputs: string[];
  lastSignal: string;
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
export type RoutePath = '/' | '/audio' | '/video' | '/zigbee' | '/camera' | '/health' | '/logs';

