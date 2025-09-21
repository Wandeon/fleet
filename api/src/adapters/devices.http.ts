import type { AudioDeviceAdapter } from './devices.js';
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