import { randomUUID } from 'node:crypto';
import { deviceRegistry } from '../upstream/devices.js';

type PowerState = 'on' | 'standby';

type VideoDeviceState = {
  deviceId: string;
  name: string;
  power: PowerState;
  mute: boolean;
  input: string;
  lastUpdated: string;
};

const deviceStateStore = new Map<string, VideoDeviceState>();

function ensureState(deviceId: string): VideoDeviceState {
  const existing = deviceStateStore.get(deviceId);
  if (existing) {
    return existing;
  }
  const device = deviceRegistry.getDevice(deviceId);
  const now = new Date().toISOString();
  const state: VideoDeviceState = {
    deviceId,
    name: device?.name ?? deviceId,
    power: 'standby',
    mute: false,
    input: 'hdmi1',
    lastUpdated: now
  };
  deviceStateStore.set(deviceId, state);
  return state;
}

export function listVideoDevices() {
  return deviceRegistry
    .list()
    .filter((device) => device.module === 'video' || device.role.includes('video'))
    .map((device) => {
      const state = ensureState(device.id);
      return {
        id: device.id,
        name: device.name,
        module: device.module,
        role: device.role,
        status: state.power === 'on' ? 'online' : 'standby',
        power: state.power,
        mute: state.mute,
        input: state.input,
        lastUpdated: state.lastUpdated
      };
    });
}

export function setDevicePower(deviceId: string, power: PowerState) {
  const state = ensureState(deviceId);
  const updated: VideoDeviceState = {
    ...state,
    power,
    lastUpdated: new Date().toISOString()
  };
  deviceStateStore.set(deviceId, updated);
  return updated;
}

export function setDeviceMute(deviceId: string, mute: boolean) {
  const state = ensureState(deviceId);
  const updated: VideoDeviceState = {
    ...state,
    mute,
    lastUpdated: new Date().toISOString()
  };
  deviceStateStore.set(deviceId, updated);
  return updated;
}

export function setDeviceInput(deviceId: string, input: string) {
  const state = ensureState(deviceId);
  const updated: VideoDeviceState = {
    ...state,
    input,
    lastUpdated: new Date().toISOString()
  };
  deviceStateStore.set(deviceId, updated);
  return updated;
}

export function requestPreviewSession(deviceId?: string) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const targetDevice = deviceId ? ensureState(deviceId) : null;
  return {
    sessionId,
    streamUrl: `https://video.example/preview/${sessionId}`,
    expiresAt,
    device: targetDevice
      ? {
          id: targetDevice.deviceId,
          name: targetDevice.name,
          input: targetDevice.input
        }
      : null
  };
}

export function listRecordingSegments() {
  return [
    {
      id: 'segment-001',
      deviceId: 'video-primary',
      startedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 3500 * 1000).toISOString(),
      durationSeconds: 600,
      status: 'available'
    },
    {
      id: 'segment-002',
      deviceId: 'video-primary',
      startedAt: new Date(Date.now() - 1800 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 1500 * 1000).toISOString(),
      durationSeconds: 300,
      status: 'processing'
    }
  ];
}

export function createClipExport(recordingId: string, payload: { startOffsetSeconds: number; endOffsetSeconds: number }) {
  const exportId = randomUUID();
  return {
    exportId,
    recordingId,
    status: 'queued',
    startOffsetSeconds: payload.startOffsetSeconds,
    endOffsetSeconds: payload.endOffsetSeconds,
    requestedAt: new Date().toISOString(),
    downloadUrl: `https://video.example/exports/${exportId}.mp4`
  };
}
