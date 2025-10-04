import { promises as fs } from 'fs';
import { join } from 'path';
import { Socket } from 'net';
import { log } from '../observability/logging.js';
import { createHttpError } from '../util/errors.js';

const LIQUIDSOAP_MUSIC_PATH = process.env.LIQUIDSOAP_MUSIC_PATH || '/liquidsoap-music';
const ICECAST_STATUS_URL = process.env.ICECAST_STATUS_URL || 'http://icecast:8000/status-json.xsl';
const LIQUIDSOAP_TELNET_HOST = process.env.LIQUIDSOAP_TELNET_HOST || 'liquidsoap';
const LIQUIDSOAP_TELNET_PORT = parseInt(process.env.LIQUIDSOAP_TELNET_PORT || '1234', 10);

export interface IcecastMount {
  mount: string;
  listeners: number;
  streamStart: string;
  bitrate: number;
  serverName: string;
}

export interface IcecastStatus {
  online: boolean;
  serverStart: string | null;
  location: string | null;
  mounts: IcecastMount[];
  totalListeners: number;
}

export interface LiquidsoapStatus {
  online: boolean;
  libraryFiles: number;
  librarySize: number;
}

export interface StreamingSystemStatus {
  icecast: IcecastStatus;
  liquidsoap: LiquidsoapStatus;
  streamUrl: string;
}

export interface MusicLibraryFile {
  filename: string;
  path: string;
  size: number;
  modifiedAt: string;
}

/**
 * Get Icecast server status by querying its JSON status endpoint
 */
export async function getIcecastStatus(): Promise<IcecastStatus> {
  try {
    const response = await fetch(ICECAST_STATUS_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      log.warn({ status: response.status }, 'Icecast status endpoint returned non-OK status');
      return {
        online: false,
        serverStart: null,
        location: null,
        mounts: [],
        totalListeners: 0,
      };
    }

    const data = await response.json();
    const source = data?.icestats?.source;

    // Handle both single source (object) and multiple sources (array)
    const sources = Array.isArray(source) ? source : source ? [source] : [];

    const mounts: IcecastMount[] = sources.map((src: any) => ({
      mount: src.listenurl?.split('/').pop() || 'unknown',
      listeners: src.listeners || 0,
      streamStart: src.stream_start_iso8601 || src.stream_start || '',
      bitrate: src.bitrate || 0,
      serverName: src.server_name || '',
    }));

    const totalListeners = mounts.reduce((sum, mount) => sum + mount.listeners, 0);

    return {
      online: true,
      serverStart: data?.icestats?.server_start_iso8601 || data?.icestats?.server_start || null,
      location: data?.icestats?.location || null,
      mounts,
      totalListeners,
    };
  } catch (error) {
    log.error({ error }, 'Failed to fetch Icecast status');
    return {
      online: false,
      serverStart: null,
      location: null,
      mounts: [],
      totalListeners: 0,
    };
  }
}

/**
 * Get Liquidsoap status by checking music library
 */
export async function getLiquidsoapStatus(): Promise<LiquidsoapStatus> {
  try {
    await fs.access(LIQUIDSOAP_MUSIC_PATH);
    const files = await fs.readdir(LIQUIDSOAP_MUSIC_PATH);

    const audioFiles = files.filter(file =>
      /\.(mp3|ogg|wav|flac|m4a|aac)$/i.test(file)
    );

    let totalSize = 0;
    for (const file of audioFiles) {
      try {
        const stat = await fs.stat(join(LIQUIDSOAP_MUSIC_PATH, file));
        totalSize += stat.size;
      } catch (err) {
        log.warn({ file, error: err }, 'Failed to stat music file');
      }
    }

    return {
      online: true,
      libraryFiles: audioFiles.length,
      librarySize: totalSize,
    };
  } catch (error) {
    log.error({ error }, 'Failed to check Liquidsoap status');
    return {
      online: false,
      libraryFiles: 0,
      librarySize: 0,
    };
  }
}

/**
 * Get combined streaming system status
 */
export async function getStreamingSystemStatus(): Promise<StreamingSystemStatus> {
  const [icecast, liquidsoap] = await Promise.all([
    getIcecastStatus(),
    getLiquidsoapStatus(),
  ]);

  return {
    icecast,
    liquidsoap,
    streamUrl: 'http://icecast:8000/fleet.mp3',
  };
}

/**
 * List files in Liquidsoap music library
 */
export async function listMusicLibrary(): Promise<MusicLibraryFile[]> {
  try {
    await fs.access(LIQUIDSOAP_MUSIC_PATH);
    const files = await fs.readdir(LIQUIDSOAP_MUSIC_PATH);

    const audioFiles = files.filter(file =>
      /\.(mp3|ogg|wav|flac|m4a|aac)$/i.test(file)
    );

    const fileDetails: MusicLibraryFile[] = [];

    for (const filename of audioFiles) {
      try {
        const filePath = join(LIQUIDSOAP_MUSIC_PATH, filename);
        const stat = await fs.stat(filePath);
        fileDetails.push({
          filename,
          path: filePath,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      } catch (err) {
        log.warn({ filename, error: err }, 'Failed to stat music file');
      }
    }

    // Sort by filename
    return fileDetails.sort((a, b) => a.filename.localeCompare(b.filename));
  } catch (error) {
    log.error({ error }, 'Failed to list music library');
    throw createHttpError(500, 'internal_error', 'Failed to access music library');
  }
}

/**
 * Upload a file to Liquidsoap music library
 */
export async function uploadToMusicLibrary(
  buffer: Buffer,
  filename: string
): Promise<MusicLibraryFile> {
  try {
    // Validate filename
    if (!filename || !/\.(mp3|ogg|wav|flac|m4a|aac)$/i.test(filename)) {
      throw createHttpError(400, 'bad_request', 'Invalid audio file format');
    }

    // Sanitize filename
    const safeName = filename.replace(/[^a-z0-9_\-\.]/gi, '_');
    const filePath = join(LIQUIDSOAP_MUSIC_PATH, safeName);

    // Check if file already exists
    try {
      await fs.access(filePath);
      throw createHttpError(409, 'conflict', `File ${safeName} already exists`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }

    // Write file
    await fs.writeFile(filePath, buffer);
    log.info({ filename: safeName, size: buffer.length }, 'Uploaded file to music library');

    const stat = await fs.stat(filePath);
    return {
      filename: safeName,
      path: filePath,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  } catch (error) {
    if ((error as any).statusCode) throw error;
    log.error({ error, filename }, 'Failed to upload to music library');
    throw createHttpError(500, 'internal_error', 'Failed to upload file');
  }
}

/**
 * Delete a file from Liquidsoap music library
 */
export async function deleteFromMusicLibrary(filename: string): Promise<void> {
  try {
    // Validate and sanitize filename
    const safeName = filename.replace(/[^a-z0-9_\-\.]/gi, '_');
    const filePath = join(LIQUIDSOAP_MUSIC_PATH, safeName);

    // Security check: ensure path is within music directory
    const resolvedPath = await fs.realpath(filePath).catch(() => filePath);
    const resolvedMusicPath = await fs.realpath(LIQUIDSOAP_MUSIC_PATH);

    if (!resolvedPath.startsWith(resolvedMusicPath)) {
      throw createHttpError(403, 'forbidden', 'Access denied');
    }

    await fs.unlink(filePath);
    log.info({ filename: safeName }, 'Deleted file from music library');
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      throw createHttpError(404, 'not_found', 'File not found');
    }
    if ((error as any).statusCode) throw error;
    log.error({ error, filename }, 'Failed to delete from music library');
    throw createHttpError(500, 'internal_error', 'Failed to delete file');
  }
}

/**
 * Send a command to Liquidsoap via telnet
 */
async function sendLiquidsoapCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let response = '';

    socket.setTimeout(5000);

    socket.on('data', (data) => {
      response += data.toString();
    });

    socket.on('end', () => {
      // Extract just the command response, removing END marker
      const lines = response.split('\n').filter(line => line && line !== 'END');
      resolve(lines.join('\n').trim());
    });

    socket.on('error', (err) => {
      log.error({ error: err, command }, 'Liquidsoap telnet error');
      reject(createHttpError(503, 'upstream_unreachable', 'Liquidsoap control unavailable'));
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(createHttpError(504, 'upstream_timeout', 'Liquidsoap command timeout'));
    });

    socket.connect(LIQUIDSOAP_TELNET_PORT, LIQUIDSOAP_TELNET_HOST, () => {
      socket.write(`${command}\nquit\n`);
    });
  });
}

/**
 * Start Liquidsoap playback
 */
export async function startLiquidsoapPlayback(): Promise<void> {
  try {
    const response = await sendLiquidsoapCommand('player.start');
    log.info({ response }, 'Started Liquidsoap playback');
  } catch (error) {
    log.error({ error }, 'Failed to start Liquidsoap playback');
    throw error;
  }
}

/**
 * Stop Liquidsoap playback
 */
export async function stopLiquidsoapPlayback(): Promise<void> {
  try {
    const response = await sendLiquidsoapCommand('player.stop');
    log.info({ response }, 'Stopped Liquidsoap playback');
  } catch (error) {
    log.error({ error }, 'Failed to stop Liquidsoap playback');
    throw error;
  }
}

/**
 * Skip to next track in Liquidsoap
 */
export async function skipLiquidsoapTrack(): Promise<void> {
  try {
    const response = await sendLiquidsoapCommand('player.skip');
    log.info({ response }, 'Skipped Liquidsoap track');
  } catch (error) {
    log.error({ error }, 'Failed to skip Liquidsoap track');
    throw error;
  }
}

/**
 * Get Liquidsoap playback status
 */
export async function getLiquidsoapPlaybackStatus(): Promise<{ playing: boolean }> {
  try {
    const response = await sendLiquidsoapCommand('player.playing');
    const playing = response.trim() === 'true';
    return { playing };
  } catch (error) {
    log.error({ error }, 'Failed to get Liquidsoap status');
    return { playing: false };
  }
}
