import type { AudioDeviceAdapter, VideoDeviceAdapter, CameraDeviceAdapter, ZigbeeDeviceAdapter } from './devices.js';
import { prisma } from '../lib/db.js';
import fs from 'fs/promises';

export class HttpAudioDeviceAdapter implements AudioDeviceAdapter {
  private readonly timeout = 3000; // 3 seconds
  private readonly retryDelays = [500, 1000]; // 500ms, then 1000ms

  private async getDeviceConfig(deviceId: string): Promise<{
    baseUrl: string;
    token?: string;
  }> {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    let address;
    try {
      address = JSON.parse(device.address);
    } catch (error) {
      throw new Error(`Invalid device address format for ${deviceId}`);
    }

    const baseUrl = address.baseUrl;
    if (!baseUrl) {
      throw new Error(`No baseUrl configured for device ${deviceId}`);
    }

    // Get token from environment if token_env is specified
    let token = address.token;
    if (address.tokenEnv) {
      token = process.env[address.tokenEnv] || token;
    }

    return { baseUrl, token };
  }

  private async makeRequest(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Retry on network errors if retries are available
      if (retryCount < this.retryDelays.length) {
        const delay = this.retryDelays[retryCount];
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(url, options, retryCount + 1);
      }

      throw error;
    }
  }

  async status(devId: string): Promise<{
    playing: boolean;
    volume: number;
    fallback_exists?: boolean;
    position?: number;
    duration?: number;
    files?: string[];
  }> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.makeRequest(`${baseUrl}/status`, { headers });
    const data = await response.json();

    return {
      playing: data.playing || false,
      volume: data.volume || 1.0,
      fallback_exists: data.fallback_exists,
      position: data.position,
      duration: data.duration,
      files: data.files,
    };
  }

  async play(devId: string, filePath: string): Promise<void> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const fileName = filePath.split('/').pop() || filePath;

    await this.makeRequest(`${baseUrl}/play`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ file: fileName }),
    });
  }

  async pause(devId: string): Promise<void> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      await this.makeRequest(`${baseUrl}/pause`, {
        method: 'POST',
        headers,
      });
    } catch (error) {
      // Per consultant notes, some devices don't support pause
      if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        throw new Error(`Pause not supported on device ${devId}`);
      }
      throw error;
    }
  }

  async stop(devId: string): Promise<void> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await this.makeRequest(`${baseUrl}/stop`, {
      method: 'POST',
      headers,
    });
  }

  async volume(devId: string, value: number): Promise<void> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await this.makeRequest(`${baseUrl}/volume`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ volume: value }),
    });
  }

  async upload(devId: string, localPath: string): Promise<void> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);

    // Read file from local filesystem
    const fileBuffer = await fs.readFile(localPath);
    const fileName = localPath.split('/').pop() || 'upload';

    // Create form data
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)]);
    formData.append('file', blob, fileName);

    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await this.makeRequest(`${baseUrl}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
  }
}

// ===============================================
// VIDEO HTTP ADAPTER
// ===============================================

export class HttpVideoDeviceAdapter implements VideoDeviceAdapter {
  private readonly timeout = 5000; // 5 seconds for video operations
  private readonly retryDelays = [1000, 2000]; // Longer delays for TV operations

  private async getDeviceConfig(deviceId: string): Promise<{
    baseUrl: string;
    token?: string;
  }> {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    let address;
    try {
      address = JSON.parse(device.address);
    } catch (error) {
      throw new Error(`Invalid device address format for ${deviceId}`);
    }

    const baseUrl = address.baseUrl;
    if (!baseUrl) {
      throw new Error(`No baseUrl configured for device ${deviceId}`);
    }

    // Get token from environment if token_env is specified
    let token = address.token;
    if (address.tokenEnv) {
      token = process.env[address.tokenEnv] || token;
    }

    return { baseUrl, token };
  }

  private async makeRequest(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (retryCount < this.retryDelays.length) {
        const delay = this.retryDelays[retryCount];
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(url, options, retryCount + 1);
      }

      throw error;
    }
  }

  async status(devId: string): Promise<{
    power: boolean;
    input: string;
    temperature?: number;
    uptime?: number;
  }> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.makeRequest(`${baseUrl}/tv/status`, { headers });
    const data = await response.json();

    return {
      power: data.power || false,
      input: data.input || 'HDMI1',
      temperature: data.temperature,
      uptime: data.uptime,
    };
  }

  async powerOn(devId: string): Promise<void> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await this.makeRequest(`${baseUrl}/tv/power_on`, {
      method: 'POST',
      headers,
    });
  }

  async powerOff(devId: string): Promise<void> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await this.makeRequest(`${baseUrl}/tv/power_off`, {
      method: 'POST',
      headers,
    });
  }

  async setInput(devId: string, source: string): Promise<void> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await this.makeRequest(`${baseUrl}/tv/input`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source }),
    });
  }
}

// ===============================================
// CAMERA HTTP ADAPTER
// ===============================================

export class HttpCameraDeviceAdapter implements CameraDeviceAdapter {
  private readonly timeout = 4000; // 4 seconds
  private readonly retryDelays = [750, 1500];

  private async getDeviceConfig(deviceId: string): Promise<{
    baseUrl: string;
    token?: string;
  }> {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    let address;
    try {
      address = JSON.parse(device.address);
    } catch (error) {
      throw new Error(`Invalid device address format for ${deviceId}`);
    }

    const baseUrl = address.baseUrl;
    if (!baseUrl) {
      throw new Error(`No baseUrl configured for device ${deviceId}`);
    }

    let token = address.token;
    if (address.tokenEnv) {
      token = process.env[address.tokenEnv] || token;
    }

    return { baseUrl, token };
  }

  private async makeRequest(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (retryCount < this.retryDelays.length) {
        const delay = this.retryDelays[retryCount];
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(url, options, retryCount + 1);
      }

      throw error;
    }
  }

  async status(devId: string): Promise<{
    online: boolean;
    streaming: boolean;
    rtsp_url?: string;
    hls_url?: string;
    resolution?: string;
    fps?: number;
  }> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.makeRequest(`${baseUrl}/camera/status`, { headers });
    const data = await response.json();

    return {
      online: data.online || false,
      streaming: data.streaming || false,
      rtsp_url: data.rtsp_url,
      hls_url: data.hls_url,
      resolution: data.resolution,
      fps: data.fps,
    };
  }

  async reboot(devId: string): Promise<void> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await this.makeRequest(`${baseUrl}/camera/reboot`, {
      method: 'POST',
      headers,
    });
  }

  async probe(devId: string): Promise<{
    rtsp_url: string;
    hls_url: string;
    resolution: string;
    fps: number;
    codec: string;
  }> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.makeRequest(`${baseUrl}/camera/probe`, {
      method: 'POST',
      headers,
    });
    const data = await response.json();

    return {
      rtsp_url: data.rtsp_url,
      hls_url: data.hls_url,
      resolution: data.resolution,
      fps: data.fps,
      codec: data.codec,
    };
  }
}

// ===============================================
// ZIGBEE HTTP ADAPTER
// ===============================================

export class HttpZigbeeDeviceAdapter implements ZigbeeDeviceAdapter {
  private readonly timeout = 6000; // 6 seconds for Zigbee operations
  private readonly retryDelays = [1000, 2000];

  private async getDeviceConfig(deviceId: string): Promise<{
    baseUrl: string;
    token?: string;
  }> {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    let address;
    try {
      address = JSON.parse(device.address);
    } catch (error) {
      throw new Error(`Invalid device address format for ${deviceId}`);
    }

    const baseUrl = address.baseUrl;
    if (!baseUrl) {
      throw new Error(`No baseUrl configured for device ${deviceId}`);
    }

    let token = address.token;
    if (address.tokenEnv) {
      token = process.env[address.tokenEnv] || token;
    }

    return { baseUrl, token };
  }

  private async makeRequest(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (retryCount < this.retryDelays.length) {
        const delay = this.retryDelays[retryCount];
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(url, options, retryCount + 1);
      }

      throw error;
    }
  }

  async status(devId: string): Promise<{
    coordinator_online: boolean;
    permit_join: boolean;
    devices_count: number;
    network_map?: any;
  }> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.makeRequest(`${baseUrl}/zigbee/status`, { headers });
    const data = await response.json();

    return {
      coordinator_online: data.coordinator_online || false,
      permit_join: data.permit_join || false,
      devices_count: data.devices_count || 0,
      network_map: data.network_map,
    };
  }

  async permitJoin(devId: string, duration: number): Promise<void> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await this.makeRequest(`${baseUrl}/zigbee/permit_join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ duration }),
    });
  }

  async reset(devId: string): Promise<void> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await this.makeRequest(`${baseUrl}/zigbee/reset`, {
      method: 'POST',
      headers,
    });
  }

  async publish(devId: string, topic: string, payload: any): Promise<void> {
    const { baseUrl, token } = await this.getDeviceConfig(devId);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await this.makeRequest(`${baseUrl}/zigbee/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ topic, payload }),
    });
  }
}