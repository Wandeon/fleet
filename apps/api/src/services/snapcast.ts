import { log } from '../observability/logging.js';
import { prisma } from '../lib/db.js';

const SNAPCAST_HOST = process.env.SNAPCAST_HOST || 'snapcast-server';
const SNAPCAST_PORT = parseInt(process.env.SNAPCAST_PORT || '1780', 10);

export interface SnapcastClient {
  id: string;
  connected: boolean;
  host: {
    name: string;
    ip: string;
    os: string;
    arch: string;
  };
  config: {
    volume: {
      percent: number;
      muted: boolean;
    };
  };
  lastSeen: {
    sec: number;
    usec: number;
  };
}

export interface SnapcastStream {
  id: string;
  status: 'idle' | 'playing' | 'unknown';
  uri: {
    path: string;
    raw: string;
  };
}

export interface SnapcastStatus {
  online: boolean;
  clients: SnapcastClient[];
  streams: SnapcastStream[];
  totalClients: number;
  connectedClients: number;
  listeningClients: number;
}

/**
 * Send JSON-RPC request to Snapcast server
 */
async function sendSnapcastRPC(method: string, params: any = {}): Promise<any> {
  const url = `http://${SNAPCAST_HOST}:${SNAPCAST_PORT}/jsonrpc`;
  const body = {
    id: Date.now(),
    jsonrpc: '2.0',
    method,
    params,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Snapcast RPC failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Snapcast RPC error: ${data.error.message}`);
    }

    return data.result;
  } catch (error) {
    log.error({ error, method, params }, 'Snapcast RPC request failed');
    throw error;
  }
}

/**
 * Get Snapcast server status
 */
export async function getSnapcastStatus(): Promise<SnapcastStatus> {
  // Count listening clients from database (devices playing from Snapcast)
  // This runs regardless of Snapcast server status
  let listeningCount = 0;
  try {
    const devices = await prisma.audioDeviceStatus.findMany({
      select: { deviceId: true, playbackJson: true },
    });

    listeningCount = devices.filter((device) => {
      try {
        const playback = JSON.parse(device.playbackJson);
        const isListening = playback.state === 'playing' && playback.syncGroup === 'snapcast';
        log.info({
          deviceId: device.deviceId,
          state: playback.state,
          syncGroup: playback.syncGroup,
          isListening
        }, 'Checking device listening status');
        return isListening;
      } catch (err) {
        log.warn({ deviceId: device.deviceId, error: err }, 'Failed to parse playback JSON');
        return false;
      }
    }).length;
  } catch (err) {
    log.error({ error: err }, 'Failed to count listening clients');
  }

  try {
    const result = await sendSnapcastRPC('Server.GetStatus');
    const server = result.server;

    // Extract all clients from all groups
    const allClients: SnapcastClient[] = [];
    for (const group of server.groups || []) {
      for (const client of group.clients || []) {
        allClients.push({
          id: client.id,
          connected: client.connected,
          host: client.host,
          config: client.config,
          lastSeen: client.lastSeen,
        });
      }
    }

    // Extract streams
    const streams: SnapcastStream[] = (server.streams || []).map((stream: any) => ({
      id: stream.id,
      status: stream.status || 'unknown',
      uri: {
        path: stream.uri?.path || '',
        raw: stream.uri?.raw || '',
      },
    }));

    const connectedClients = allClients.filter((c) => c.connected).length;

    return {
      online: true,
      clients: allClients,
      streams,
      totalClients: allClients.length,
      connectedClients,
      listeningClients: listeningCount,
    };
  } catch (error) {
    log.error({ error }, 'Failed to get Snapcast status');
    return {
      online: false,
      clients: [],
      streams: [],
      totalClients: 0,
      connectedClients: 0,
      listeningClients: listeningCount,
    };
  }
}

/**
 * Delete (disconnect) a Snapcast client
 */
export async function disconnectSnapcastClient(clientId: string): Promise<void> {
  try {
    await sendSnapcastRPC('Server.DeleteClient', { id: clientId });
    log.info({ clientId }, 'Snapcast client disconnected');
  } catch (error) {
    log.error({ error, clientId }, 'Failed to disconnect Snapcast client');
    throw error;
  }
}
