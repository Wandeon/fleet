import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { nanoid } from 'nanoid';

const execFileAsync = promisify(execFile);

const DATA_ROOT = process.env.VIDEO_DATA_DIR || path.resolve(process.cwd(), 'data');
const VIDEOS_DIR = path.join(DATA_ROOT, 'videos');
const THUMBS_DIR = path.join(DATA_ROOT, 'thumbnails');
const META_FILE = path.join(DATA_ROOT, 'videos.json');

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function ensureVideoStorage() {
  await ensureDir(DATA_ROOT);
  await ensureDir(VIDEOS_DIR);
  await ensureDir(THUMBS_DIR);
  try {
    await fs.promises.access(META_FILE, fs.constants.F_OK);
  } catch (_) {
    await fs.promises.writeFile(META_FILE, '[]', 'utf8');
  }
}

async function readMetadata() {
  await ensureVideoStorage();
  try {
    const raw = await fs.promises.readFile(META_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`Failed to read video metadata: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

async function writeMetadata(entries) {
  await ensureVideoStorage();
  const payload = JSON.stringify(entries, null, 2);
  const tmp = `${META_FILE}.tmp`;
  await fs.promises.writeFile(tmp, payload, 'utf8');
  await fs.promises.rename(tmp, META_FILE);
}

function buildEntryResponse(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    filename: entry.filename,
    size: entry.size,
    duration: entry.duration ?? null,
    thumbnail: entry.thumbnail ? `/api/video/files/${entry.id}/thumbnail` : null,
    uploaded_at: entry.uploaded_at,
    mime_type: entry.mime_type ?? null,
  };
}

function buildVideoPath(entry) {
  return path.join(VIDEOS_DIR, entry.storage_name);
}

function buildThumbnailPath(id) {
  return path.join(THUMBS_DIR, `${id}.jpg`);
}

async function probeDuration(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-print_format', 'json',
      '-show_entries', 'format=duration',
      filePath,
    ], { timeout: 15000 });
    const data = JSON.parse(stdout);
    const duration = parseFloat(data?.format?.duration);
    if (Number.isFinite(duration)) {
      return duration;
    }
  } catch (err) {
    console.warn(`ffprobe failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
}

async function createThumbnail(filePath, id, durationSeconds) {
  const output = buildThumbnailPath(id);
  let position = 1.0;
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
    position = Math.max(0.5, durationSeconds * 0.05);
    if (durationSeconds > 5 && position > durationSeconds - 1) {
      position = durationSeconds / 2;
    }
  }
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-ss', position.toFixed(2),
      '-i', filePath,
      '-vframes', '1',
      '-vf', 'scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2',
      '-q:v', '2',
      output,
    ], { timeout: 20000 });
    return output;
  } catch (err) {
    console.warn(`ffmpeg thumbnail failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    try {
      await fs.promises.unlink(output);
    } catch (_) {
      /* ignore */
    }
    return null;
  }
}

export async function listVideoFiles() {
  const entries = await readMetadata();
  return entries.map((entry) => buildEntryResponse(entry));
}

export async function getVideoFile(id) {
  const entries = await readMetadata();
  const entry = entries.find((item) => item.id === id);
  if (!entry) return null;
  return {
    entry,
    response: buildEntryResponse(entry),
    videoPath: buildVideoPath(entry),
    thumbnailPath: entry.thumbnail ? buildThumbnailPath(entry.id) : null,
  };
}

function normalizeExtension(originalName) {
  const ext = path.extname(originalName || '').trim().toLowerCase();
  if (ext) return ext;
  return '.mp4';
}

export async function registerUploadedVideo(file) {
  if (!file || !file.path) {
    throw new Error('upload_failed');
  }
  await ensureVideoStorage();
  const id = nanoid(12);
  const ext = normalizeExtension(file.originalname);
  const storageName = `${id}${ext}`;
  const finalPath = path.join(VIDEOS_DIR, storageName);

  try {
    await fs.promises.rename(file.path, finalPath);
  } catch (err) {
    try {
      await fs.promises.unlink(file.path);
    } catch (_) {
      /* ignore */
    }
    throw err;
  }

  let duration = null;
  let thumbPath = null;
  try {
    duration = await probeDuration(finalPath);
    thumbPath = await createThumbnail(finalPath, id, duration);
  } catch (err) {
    console.warn(`Metadata extraction failed for ${finalPath}: ${err instanceof Error ? err.message : String(err)}`);
  }

  const entry = {
    id,
    filename: file.originalname,
    storage_name: storageName,
    size: file.size,
    duration: duration ?? null,
    thumbnail: thumbPath ? path.basename(thumbPath) : null,
    uploaded_at: new Date().toISOString(),
    mime_type: file.mimetype || null,
  };

  const entries = await readMetadata();
  entries.push(entry);
  try {
    await writeMetadata(entries);
  } catch (err) {
    try {
      await fs.promises.unlink(finalPath);
    } catch (_) {
      /* ignore */
    }
    if (thumbPath) {
      try {
        await fs.promises.unlink(thumbPath);
      } catch (_) {
        /* ignore */
      }
    }
    throw err;
  }
  return buildEntryResponse(entry);
}

export async function deleteVideoFile(id) {
  const entries = await readMetadata();
  const idx = entries.findIndex((entry) => entry.id === id);
  if (idx === -1) return null;
  const [entry] = entries.splice(idx, 1);
  await writeMetadata(entries);

  try {
    await fs.promises.unlink(buildVideoPath(entry));
  } catch (_) {
    /* ignore */
  }
  if (entry.thumbnail) {
    try {
      await fs.promises.unlink(buildThumbnailPath(entry.id));
    } catch (_) {
      /* ignore */
    }
  }
  return buildEntryResponse(entry);
}

export function getVideoPathFromEntry(entry) {
  return buildVideoPath(entry);
}

export function getThumbnailPathFromEntry(entry) {
  if (!entry.thumbnail) return null;
  return buildThumbnailPath(entry.id);
}

export async function ensureStorageReady() {
  await ensureVideoStorage();
}

export const paths = {
  DATA_ROOT,
  VIDEOS_DIR,
  THUMBS_DIR,
  META_FILE,
};
