// ===============================================
// AUDIO DEVICE ADAPTER
// ===============================================

export interface AudioDeviceAdapter {
  status(devId: string): Promise<{
    playing: boolean;
    volume: number;
    fallback_exists?: boolean;
    position?: number;
    duration?: number;
    files?: string[];
  }>;
  play(devId: string, filePath: string): Promise<void>;
  pause(devId: string): Promise<void>;
  stop(devId: string): Promise<void>;
  volume(devId: string, value: number): Promise<void>;
  upload(devId: string, localPath: string): Promise<void>;
}

// ===============================================
// VIDEO DEVICE ADAPTER
// ===============================================

export interface VideoDeviceAdapter {
  status(devId: string): Promise<{
    power: boolean;
    input: string;
    temperature?: number;
    uptime?: number;
  }>;
  powerOn(devId: string): Promise<void>;
  powerOff(devId: string): Promise<void>;
  setInput(devId: string, source: string): Promise<void>;
}

// ===============================================
// CAMERA DEVICE ADAPTER
// ===============================================

export interface CameraDeviceAdapter {
  status(devId: string): Promise<{
    online: boolean;
    streaming: boolean;
    rtsp_url?: string;
    hls_url?: string;
    resolution?: string;
    fps?: number;
  }>;
  reboot(devId: string): Promise<void>;
  probe(devId: string): Promise<{
    rtsp_url: string;
    hls_url: string;
    resolution: string;
    fps: number;
    codec: string;
  }>;
}

// ===============================================
// ZIGBEE DEVICE ADAPTER
// ===============================================

export interface ZigbeeDeviceAdapter {
  status(devId: string): Promise<{
    coordinator_online: boolean;
    permit_join: boolean;
    devices_count: number;
    network_map?: any;
  }>;
  permitJoin(devId: string, duration: number): Promise<void>;
  reset(devId: string): Promise<void>;
  publish(devId: string, topic: string, payload: any): Promise<void>;
}

import { MockAudioDeviceAdapter, MockVideoDeviceAdapter, MockCameraDeviceAdapter, MockZigbeeDeviceAdapter } from './devices.mock.js';
import { HttpAudioDeviceAdapter, HttpVideoDeviceAdapter, HttpCameraDeviceAdapter, HttpZigbeeDeviceAdapter } from './devices.http.js';

// ===============================================
// ADAPTER FACTORIES
// ===============================================

export function getAudioAdapter(): AudioDeviceAdapter {
  const adapterType = process.env.DEVICE_ADAPTER || 'http';

  switch (adapterType) {
    case 'mock':
      return new MockAudioDeviceAdapter();
    case 'http':
    default:
      return new HttpAudioDeviceAdapter();
  }
}

export function getVideoAdapter(): VideoDeviceAdapter {
  const adapterType = process.env.DEVICE_ADAPTER || 'http';

  switch (adapterType) {
    case 'mock':
      return new MockVideoDeviceAdapter();
    case 'http':
    default:
      return new HttpVideoDeviceAdapter();
  }
}

export function getCameraAdapter(): CameraDeviceAdapter {
  const adapterType = process.env.DEVICE_ADAPTER || 'http';

  switch (adapterType) {
    case 'mock':
      return new MockCameraDeviceAdapter();
    case 'http':
    default:
      return new HttpCameraDeviceAdapter();
  }
}

export function getZigbeeAdapter(): ZigbeeDeviceAdapter {
  const adapterType = process.env.DEVICE_ADAPTER || 'http';

  switch (adapterType) {
    case 'mock':
      return new MockZigbeeDeviceAdapter();
    case 'http':
    default:
      return new HttpZigbeeDeviceAdapter();
  }
}