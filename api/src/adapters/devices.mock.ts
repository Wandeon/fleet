import type { AudioDeviceAdapter } from './devices.js';

interface MockDeviceState {
  playing: boolean;
  volume: number;
  position: number;
  duration: number;
  files: Set<string>;
  currentFile?: string;
}

export class MockAudioDeviceAdapter implements AudioDeviceAdapter {
  private devices = new Map<string, MockDeviceState>();

  constructor() {
    // Initialize with default states
    this.initializeDevice('pi-audio-01');
    this.initializeDevice('pi-audio-02');
  }

  private initializeDevice(deviceId: string) {
    this.devices.set(deviceId, {
      playing: false,
      volume: 1.0,
      position: 0,
      duration: 0,
      files: new Set(),
    });
  }

  private getDevice(deviceId: string): MockDeviceState {
    if (!this.devices.has(deviceId)) {
      this.initializeDevice(deviceId);
    }
    return this.devices.get(deviceId)!;
  }

  private simulateLatency(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
  }

  async status(devId: string): Promise<{
    playing: boolean;
    volume: number;
    fallback_exists?: boolean;
    position?: number;
    duration?: number;
    files?: string[];
  }> {
    await this.simulateLatency();

    const device = this.getDevice(devId);
    return {
      playing: device.playing,
      volume: device.volume,
      fallback_exists: device.files.size > 0,
      position: device.position,
      duration: device.duration,
      files: Array.from(device.files),
    };
  }

  async play(devId: string, filePath: string): Promise<void> {
    await this.simulateLatency();

    const device = this.getDevice(devId);

    // Check if file exists in device files
    const fileName = filePath.split('/').pop() || filePath;
    if (!device.files.has(fileName)) {
      throw new Error(`File ${fileName} not found on device ${devId}`);
    }

    device.playing = true;
    device.currentFile = fileName;
    device.position = 0;
    device.duration = Math.floor(Math.random() * 300) + 60; // Random duration 1-6 minutes
  }

  async pause(devId: string): Promise<void> {
    await this.simulateLatency();

    // Simulate pause not being available on some devices per consultant notes
    if (devId === 'pi-audio-02') {
      throw new Error(`Pause not supported on device ${devId}`);
    }

    const device = this.getDevice(devId);
    device.playing = false;
  }

  async stop(devId: string): Promise<void> {
    await this.simulateLatency();

    const device = this.getDevice(devId);
    device.playing = false;
    device.position = 0;
    device.currentFile = undefined;
  }

  async volume(devId: string, value: number): Promise<void> {
    await this.simulateLatency();

    if (value < 0 || value > 2) {
      throw new Error(`Invalid volume value: ${value}. Must be between 0 and 2`);
    }

    const device = this.getDevice(devId);
    device.volume = value;
  }

  async upload(devId: string, localPath: string): Promise<void> {
    await this.simulateLatency();

    const device = this.getDevice(devId);
    const fileName = localPath.split('/').pop() || localPath;

    // Simulate upload process
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 500));

    device.files.add(fileName);
  }

  // Utility method for testing
  getDeviceState(deviceId: string): MockDeviceState | undefined {
    return this.devices.get(deviceId);
  }

  // Utility method for testing - simulate file availability
  addFile(deviceId: string, fileName: string): void {
    const device = this.getDevice(deviceId);
    device.files.add(fileName);
  }
}