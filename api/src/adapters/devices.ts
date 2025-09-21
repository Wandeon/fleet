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

import { MockAudioDeviceAdapter } from './devices.mock.js';
import { HttpAudioDeviceAdapter } from './devices.http.js';

// Factory function that selects the appropriate adapter based on configuration
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