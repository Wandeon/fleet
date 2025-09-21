import type { AudioDeviceAdapter, VideoDeviceAdapter, CameraDeviceAdapter, ZigbeeDeviceAdapter } from './devices.js';

// ===============================================
// MOCK DEVICE STATE INTERFACES
// ===============================================

interface MockAudioState {
  playing: boolean;
  volume: number;
  position: number;
  duration: number;
  files: Set<string>;
  currentFile?: string;
}

interface MockVideoState {
  power: boolean;
  input: string;
  temperature: number;
  uptime: number;
}

interface MockCameraState {
  online: boolean;
  streaming: boolean;
  rtsp_url: string;
  hls_url: string;
  resolution: string;
  fps: number;
}

interface MockZigbeeState {
  coordinator_online: boolean;
  permit_join: boolean;
  devices_count: number;
  network_map: any;
}

// ===============================================
// AUDIO MOCK ADAPTER
// ===============================================

export class MockAudioDeviceAdapter implements AudioDeviceAdapter {
  private devices = new Map<string, MockAudioState>();

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

  private getDevice(deviceId: string): MockAudioState {
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
  getDeviceState(deviceId: string): MockAudioState | undefined {
    return this.devices.get(deviceId);
  }

  // Utility method for testing - simulate file availability
  addFile(deviceId: string, fileName: string): void {
    const device = this.getDevice(deviceId);
    device.files.add(fileName);
  }
}

// ===============================================
// VIDEO MOCK ADAPTER
// ===============================================

export class MockVideoDeviceAdapter implements VideoDeviceAdapter {
  private devices = new Map<string, MockVideoState>();

  constructor() {
    // Initialize with default states
    this.initializeDevice('pi-video-01');
  }

  private initializeDevice(deviceId: string) {
    this.devices.set(deviceId, {
      power: false,
      input: 'HDMI1',
      temperature: 45 + Math.random() * 15, // 45-60°C
      uptime: Math.floor(Math.random() * 86400), // Random uptime in seconds
    });
  }

  private getDevice(deviceId: string): MockVideoState {
    if (!this.devices.has(deviceId)) {
      this.initializeDevice(deviceId);
    }
    return this.devices.get(deviceId)!;
  }

  private simulateLatency(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  }

  async status(devId: string): Promise<{
    power: boolean;
    input: string;
    temperature?: number;
    uptime?: number;
  }> {
    await this.simulateLatency();

    const device = this.getDevice(devId);
    return {
      power: device.power,
      input: device.input,
      temperature: device.temperature,
      uptime: device.uptime,
    };
  }

  async powerOn(devId: string): Promise<void> {
    await this.simulateLatency();

    const device = this.getDevice(devId);
    device.power = true;
    device.uptime = 0; // Reset uptime on power on
  }

  async powerOff(devId: string): Promise<void> {
    await this.simulateLatency();

    const device = this.getDevice(devId);
    device.power = false;
  }

  async setInput(devId: string, source: string): Promise<void> {
    await this.simulateLatency();

    const validInputs = ['HDMI1', 'HDMI2', 'HDMI3', 'USB', 'VGA'];
    if (!validInputs.includes(source)) {
      throw new Error(`Invalid input source: ${source}. Valid inputs: ${validInputs.join(', ')}`);
    }

    const device = this.getDevice(devId);
    device.input = source;
  }

  // Utility method for testing
  getDeviceState(deviceId: string): MockVideoState | undefined {
    return this.devices.get(deviceId);
  }
}

// ===============================================
// CAMERA MOCK ADAPTER
// ===============================================

export class MockCameraDeviceAdapter implements CameraDeviceAdapter {
  private devices = new Map<string, MockCameraState>();

  constructor() {
    // Initialize with default states
    this.initializeDevice('pi-camera-01');
  }

  private initializeDevice(deviceId: string) {
    this.devices.set(deviceId, {
      online: true,
      streaming: true,
      rtsp_url: `rtsp://${deviceId}:8554/camera`,
      hls_url: `http://${deviceId}:8888/camera/index.m3u8`,
      resolution: '1920x1080',
      fps: 30,
    });
  }

  private getDevice(deviceId: string): MockCameraState {
    if (!this.devices.has(deviceId)) {
      this.initializeDevice(deviceId);
    }
    return this.devices.get(deviceId)!;
  }

  private simulateLatency(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 75 + Math.random() * 150));
  }

  async status(devId: string): Promise<{
    online: boolean;
    streaming: boolean;
    rtsp_url?: string;
    hls_url?: string;
    resolution?: string;
    fps?: number;
  }> {
    await this.simulateLatency();

    const device = this.getDevice(devId);
    return {
      online: device.online,
      streaming: device.streaming,
      rtsp_url: device.rtsp_url,
      hls_url: device.hls_url,
      resolution: device.resolution,
      fps: device.fps,
    };
  }

  async reboot(devId: string): Promise<void> {
    await this.simulateLatency();

    const device = this.getDevice(devId);

    // Simulate reboot process
    device.online = false;
    device.streaming = false;

    // Simulate boot time
    setTimeout(() => {
      device.online = true;
      device.streaming = true;
    }, 2000);
  }

  async probe(devId: string): Promise<{
    rtsp_url: string;
    hls_url: string;
    resolution: string;
    fps: number;
    codec: string;
  }> {
    await this.simulateLatency();

    const device = this.getDevice(devId);

    if (!device.online) {
      throw new Error(`Camera ${devId} is offline`);
    }

    return {
      rtsp_url: device.rtsp_url,
      hls_url: device.hls_url,
      resolution: device.resolution,
      fps: device.fps,
      codec: 'H.264',
    };
  }

  // Utility method for testing
  getDeviceState(deviceId: string): MockCameraState | undefined {
    return this.devices.get(deviceId);
  }

  // Utility method for testing - simulate camera offline/online
  setOnline(deviceId: string, online: boolean): void {
    const device = this.getDevice(deviceId);
    device.online = online;
    device.streaming = online;
  }
}

// ===============================================
// ZIGBEE MOCK ADAPTER
// ===============================================

export class MockZigbeeDeviceAdapter implements ZigbeeDeviceAdapter {
  private devices = new Map<string, MockZigbeeState>();

  constructor() {
    // Initialize with default states
    this.initializeDevice('pi-video-01'); // Video Pi also serves as Zigbee coordinator
  }

  private initializeDevice(deviceId: string) {
    this.devices.set(deviceId, {
      coordinator_online: true,
      permit_join: false,
      devices_count: Math.floor(Math.random() * 10) + 5, // 5-15 devices
      network_map: {
        coordinator: { ieee: '0x00124b0024c87d6f', type: 'Coordinator' },
        devices: [
          { ieee: '0x00158d0001f4c2a3', friendly_name: 'bedroom_sensor', type: 'EndDevice' },
          { ieee: '0x00158d0001f4c2a4', friendly_name: 'living_room_light', type: 'Router' },
        ],
      },
    });
  }

  private getDevice(deviceId: string): MockZigbeeState {
    if (!this.devices.has(deviceId)) {
      this.initializeDevice(deviceId);
    }
    return this.devices.get(deviceId)!;
  }

  private simulateLatency(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 300));
  }

  async status(devId: string): Promise<{
    coordinator_online: boolean;
    permit_join: boolean;
    devices_count: number;
    network_map?: any;
  }> {
    await this.simulateLatency();

    const device = this.getDevice(devId);
    return {
      coordinator_online: device.coordinator_online,
      permit_join: device.permit_join,
      devices_count: device.devices_count,
      network_map: device.network_map,
    };
  }

  async permitJoin(devId: string, duration: number): Promise<void> {
    await this.simulateLatency();

    const device = this.getDevice(devId);
    device.permit_join = true;

    // Automatically disable permit join after duration
    setTimeout(() => {
      device.permit_join = false;
    }, duration * 1000);
  }

  async reset(devId: string): Promise<void> {
    await this.simulateLatency();

    const device = this.getDevice(devId);

    // Simulate coordinator reset
    device.coordinator_online = false;
    device.permit_join = false;
    device.devices_count = 0;

    // Simulate recovery after reset
    setTimeout(() => {
      device.coordinator_online = true;
      device.devices_count = Math.floor(Math.random() * 5) + 2; // Fewer devices after reset
    }, 3000);
  }

  async publish(devId: string, topic: string, payload: any): Promise<void> {
    await this.simulateLatency();

    const device = this.getDevice(devId);

    if (!device.coordinator_online) {
      throw new Error(`Zigbee coordinator on ${devId} is offline`);
    }

    // Simulate MQTT publish - just log for mock
    console.log(`[MOCK ZIGBEE ${devId}] Publishing to ${topic}:`, payload);
  }

  // Utility method for testing
  getDeviceState(deviceId: string): MockZigbeeState | undefined {
    return this.devices.get(deviceId);
  }

  // Utility method for testing - simulate coordinator status
  setCoordinatorOnline(deviceId: string, online: boolean): void {
    const device = this.getDevice(deviceId);
    device.coordinator_online = online;
  }
}