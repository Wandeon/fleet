import cors from 'cors';
import express, { NextFunction, Request, RequestHandler, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { Script } from 'vm';
import { middleware as openapiValidator } from 'express-openapi-validator';

const API_PREFIX = '/api';
const DEFAULT_DELAY_MS = Number(process.env.MOCK_DELAY_MS ?? '120');
const UNSTABLE_MODE = process.env.MOCK_UNSTABLE === '1';
const DEVICE_ROUTE_PREFIXES = ['/audio', '/video', '/zigbee', '/camera'];
const RATE_LIMIT_LIMIT = 120;
const RATE_LIMIT_RETRY_AFTER = 30;

type AudioSource = 'stream' | 'file';
type PlaybackState = 'idle' | 'playing' | 'buffering' | 'error';

interface ErrorPayload {
  code: string;
  message: string;
  hint?: string;
  correlationId: string;
  details?: unknown;
}

interface AudioPlaybackState {
  state: PlaybackState;
  source: AudioSource;
  trackTitle?: string | null;
  since?: string | null;
  errorMessage?: string | null;
}

interface AudioVolumeState {
  level: number;
  locked?: boolean;
  lastChangedBy?: string | null;
}

interface AudioConfigState {
  streamUrl?: string | null;
  mode?: string | null;
  defaultSource?: AudioSource | null;
}

interface AudioDeviceStatus {
  id: string;
  displayName: string;
  online: boolean;
  playback: AudioPlaybackState;
  volume: AudioVolumeState;
  lastSeen: string;
  capabilities?: string[];
  config?: AudioConfigState;
}

interface TvStatus {
  id: string;
  displayName: string;
  online: boolean;
  power: 'on' | 'off';
  input: string;
  availableInputs?: string[];
  volume: number;
  mute: boolean;
  lastSeen: string;
}

interface ZigbeeDeviceSummary {
  id: string;
  displayName: string;
  type: string;
  state: string;
  batteryPercent?: number | null;
  lastSeen?: string;
}

type ZigbeeRuleComparison = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'includes' | 'excludes';

interface ZigbeeRuleCondition {
  field: string;
  operator: ZigbeeRuleComparison;
  value: string | number | boolean | Array<string | number | boolean>;
}

type ZigbeeRuleTrigger =
  | {
      type: 'sensor_event';
      sensorId: string;
      event: string;
      condition?: ZigbeeRuleCondition;
      cooldownSeconds?: number;
    }
  | {
      type: 'schedule';
      cron: string;
      timezone?: string;
    }
  | {
      type: 'expression';
      expression: string;
      language?: 'js';
      description?: string;
    };

type ZigbeeRuleAction =
  | {
      type: 'device_command';
      deviceId: string;
      command: string;
      payload?: Record<string, unknown>;
    }
  | {
      type: 'notify';
      channel: 'slack' | 'email' | 'sms';
      message: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'delay';
      durationSeconds: number;
    };

interface ZigbeeRuleRecord {
  id: string;
  name: string;
  description?: string | null;
  trigger: ZigbeeRuleTrigger;
  actions: ZigbeeRuleAction[];
  tags?: string[];
  metadata?: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CameraSummaryItem {
  id: string;
  displayName: string;
  online: boolean;
  recording: boolean;
  lastEventAt: string | null;
}

interface CameraStorageSummary {
  usedPercent: number;
  retentionDays: number;
}

interface CameraSummary {
  cameras: CameraSummaryItem[];
  storage: CameraStorageSummary;
}

interface CameraEvent {
  id: string;
  cameraId: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  clipUrl: string | null;
  thumbnailUrl: string | null;
  synopsis?: string | null;
}

interface CameraPreview {
  cameraId: string;
  url: string;
  expiresAt: string;
}

interface ModuleHealth {
  id: string;
  status: 'healthy' | 'degraded' | 'down';
  message?: string | null;
}

interface HealthSummary {
  status: 'healthy' | 'degraded' | 'down';
  updatedAt: string;
  modules: ModuleHealth[];
}

interface RecentEvent {
  id: string;
  source: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  correlationId?: string | null;
}

interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

const fixturesDir = path.resolve(__dirname, 'fixtures');
const apiSpecPath = path.resolve(__dirname, '../api/openapi.yaml');

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function loadFixture<T>(file: string): T {
  const fullPath = path.join(fixturesDir, file);
  const raw = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(raw) as T;
}

const layoutFixture = loadFixture<Record<string, unknown>>('layout.json');
const stateTemplate = loadFixture<Record<string, unknown>>('state.json');
const audioSeed = loadFixture<PaginatedResult<AudioDeviceStatus>>('audio.devices.json');
const tvTemplate = loadFixture<TvStatus>('video.tv.json');
const zigbeeSeed = loadFixture<PaginatedResult<ZigbeeDeviceSummary>>('zigbee.devices.json');
const zigbeeRulesSeed = loadFixture<{ items: ZigbeeRuleRecord[] }>('zigbee.rules.json');
const cameraSummaryTemplate = loadFixture<CameraSummary>('camera.summary.json');
const cameraEventsSeed = loadFixture<PaginatedResult<CameraEvent>>('camera.events.json');
const recentEventsSeed = loadFixture<PaginatedResult<RecentEvent>>('events.recent.json');
const healthTemplate = loadFixture<HealthSummary>('health.summary.json');

const cameraPreviewMap = new Map<string, CameraPreview>();
for (const file of fs.readdirSync(fixturesDir)) {
  const match = file.match(/^camera\.preview\.(.+)\.json$/);
  if (match) {
    cameraPreviewMap.set(match[1], loadFixture<CameraPreview>(file));
  }
}

const audioDevices = new Map<string, AudioDeviceStatus>();
audioSeed.items.forEach((device) => {
  audioDevices.set(device.id, clone(device));
});

let tvStatus: TvStatus = clone(tvTemplate);
const zigbeeDevices = new Map<string, ZigbeeDeviceSummary>();
zigbeeSeed.items.forEach((device) => {
  zigbeeDevices.set(device.id, clone(device));
});
const zigbeeRules = new Map<string, ZigbeeRuleRecord>();
zigbeeRulesSeed.items.forEach((rule) => {
  zigbeeRules.set(rule.id, clone(rule));
});
let cameraSummary: CameraSummary = clone(cameraSummaryTemplate);
let cameraEvents: CameraEvent[] = cameraEventsSeed.items.map((evt) => clone(evt));
let recentEvents: RecentEvent[] = recentEventsSeed.items.map((evt) => clone(evt));

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use((req, res, next) => {
  const incoming = (req.header('x-correlation-id') ?? '').trim();
  const id = incoming.length > 0 ? incoming : randomUUID();
  res.locals.correlationId = id;
  res.setHeader('x-correlation-id', id);
  next();
});

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

app.use(API_PREFIX, async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }
  const auth = req.header('authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="fleet-api"');
    await sendError(res, 401, 'AUTH_REQUIRED', 'Bearer token is required.');
    return;
  }
  const token = auth.slice(7).trim();
  if (!token) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="fleet-api"');
    await sendError(res, 401, 'AUTH_REQUIRED', 'Bearer token is required.');
    return;
  }
  if (token.endsWith(':ro') && req.method !== 'GET') {
    await sendError(
      res,
      403,
      'AUTH_FORBIDDEN',
      'Token lacks the required scope for write operations.'
    );
    return;
  }
  if (token.toLowerCase() === 'forbidden') {
    await sendError(res, 403, 'AUTH_FORBIDDEN', 'Token is missing the required scope.');
    return;
  }
  next();
});

const validatorMiddleware = openapiValidator({
  apiSpec: apiSpecPath,
  validateRequests: true,
  validateResponses: true,
}) as RequestHandler[];

app.use(API_PREFIX, ...validatorMiddleware);

const router = express.Router();

router.get(
  '/fleet/layout',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    await sendJson(res, 200, clone(layoutFixture));
  })
);

router.get(
  '/fleet/overview',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const overview = buildFleetOverview();
    await sendJson(res, 200, overview);
  })
);

router.get(
  '/audio/devices',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const devices = Array.from(audioDevices.values()).map((device) => clone(device));
    const paged = paginate(devices, req);
    await sendJson(res, 200, paged);
  })
);

router.get(
  '/audio/devices/:id',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const device = audioDevices.get(req.params.id);
    if (!device) {
      await sendError(
        res,
        404,
        'RESOURCE_NOT_FOUND',
        `Audio device ${req.params.id} was not found.`
      );
      return;
    }
    await sendJson(res, 200, clone(device));
  })
);

router.post(
  '/audio/devices/:id/play',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const device = audioDevices.get(req.params.id);
    if (!device) {
      await sendError(
        res,
        404,
        'RESOURCE_NOT_FOUND',
        `Audio device ${req.params.id} was not found.`
      );
      return;
    }
    if (!device.online) {
      await sendError(res, 409, 'AUDIO_DEVICE_BUSY', `Device ${req.params.id} is offline.`);
      return;
    }
    device.playback.state = 'playing';
    device.playback.source = req.body.source;
    device.playback.trackTitle =
      device.playback.trackTitle ??
      (req.body.source === 'stream' ? 'Live Stream' : 'Fallback File');
    device.playback.since = new Date().toISOString();
    device.volume.lastChangedBy = 'ui';
    device.lastSeen = new Date().toISOString();
    await sendJson(res, 200, clone(device));
  })
);

router.post(
  '/audio/devices/:id/stop',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const device = audioDevices.get(req.params.id);
    if (!device) {
      await sendError(
        res,
        404,
        'RESOURCE_NOT_FOUND',
        `Audio device ${req.params.id} was not found.`
      );
      return;
    }
    device.playback.state = 'idle';
    device.playback.since = new Date().toISOString();
    device.playback.trackTitle = null;
    device.volume.lastChangedBy = 'ui';
    await sendJson(res, 200, { id: device.id, playback: clone(device.playback) });
  })
);

router.post(
  '/audio/devices/:id/volume',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const device = audioDevices.get(req.params.id);
    if (!device) {
      await sendError(
        res,
        404,
        'RESOURCE_NOT_FOUND',
        `Audio device ${req.params.id} was not found.`
      );
      return;
    }
    device.volume.level = req.body.volume;
    device.volume.lastChangedBy = 'ui';
    device.lastSeen = new Date().toISOString();
    await sendJson(res, 200, clone(device));
  })
);

router.put(
  '/audio/devices/:id/config',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const device = audioDevices.get(req.params.id);
    if (!device) {
      await sendError(
        res,
        404,
        'RESOURCE_NOT_FOUND',
        `Audio device ${req.params.id} was not found.`
      );
      return;
    }
    if (!device.config) {
      device.config = {};
    }
    if (typeof req.body.streamUrl !== 'undefined') {
      device.config.streamUrl = req.body.streamUrl;
    }
    if (typeof req.body.mode !== 'undefined') {
      device.config.mode = req.body.mode;
    }
    if (typeof req.body.source !== 'undefined') {
      device.config.defaultSource = req.body.source;
    }
    device.lastSeen = new Date().toISOString();
    await sendJson(res, 200, clone(device));
  })
);

router.post(
  '/audio/devices/:id/upload',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const device = audioDevices.get(req.params.id);
    if (!device) {
      await sendError(
        res,
        404,
        'RESOURCE_NOT_FOUND',
        `Audio device ${req.params.id} was not found.`
      );
      return;
    }

    device.lastSeen = new Date().toISOString();
    const status = {
      stream_url: device.config?.streamUrl ?? 'http://stream.example.com/fallback',
      volume: device.volume.level,
      mode: device.config?.mode ?? 'auto',
      source: device.playback.source ?? 'stream',
      fallback_exists: true,
    };

    await sendJson(res, 201, {
      deviceId: device.id,
      saved: true,
      path: '/data/fallback.mp3',
      fallbackExists: true,
      status,
      uploadedAt: new Date().toISOString(),
    });
  })
);

router.get(
  '/video/tv',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    await sendJson(res, 200, clone(tvStatus));
  })
);

router.post(
  '/video/tv/power',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    tvStatus.power = req.body.on ? 'on' : 'off';
    tvStatus.online = req.body.on;
    tvStatus.lastSeen = new Date().toISOString();
    await sendJson(res, 200, clone(tvStatus));
  })
);

router.post(
  '/video/tv/input',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    if (tvStatus.availableInputs && !tvStatus.availableInputs.includes(req.body.input)) {
      await sendError(res, 422, 'VALIDATION_FAILED', `Input ${req.body.input} is not available.`, {
        details: { availableInputs: tvStatus.availableInputs },
      });
      return;
    }
    tvStatus.input = req.body.input;
    tvStatus.lastSeen = new Date().toISOString();
    await sendJson(res, 200, clone(tvStatus));
  })
);

router.post(
  '/video/tv/volume',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    tvStatus.volume = req.body.level;
    tvStatus.lastSeen = new Date().toISOString();
    await sendJson(res, 200, clone(tvStatus));
  })
);

router.post(
  '/video/tv/mute',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    tvStatus.mute = req.body.mute;
    tvStatus.lastSeen = new Date().toISOString();
    await sendJson(res, 200, clone(tvStatus));
  })
);

router.get(
  '/zigbee/devices',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const devices = Array.from(zigbeeDevices.values()).map((device) => clone(device));
    const paged = paginate(devices, req);
    await sendJson(res, 200, paged);
  })
);

router.post(
  '/zigbee/devices/:id/action',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const device = zigbeeDevices.get(req.params.id);
    if (!device) {
      await sendError(
        res,
        404,
        'RESOURCE_NOT_FOUND',
        `Zigbee device ${req.params.id} was not found.`
      );
      return;
    }
    const action: string = req.body.action;
    if (action === 'toggle') {
      device.state = device.state === 'on' ? 'off' : 'on';
    } else if (action === 'on') {
      device.state = 'on';
    } else if (action === 'off') {
      device.state = 'off';
    } else if (action === 'scene') {
      if (!req.body.scene) {
        await sendError(res, 422, 'VALIDATION_FAILED', 'Scene name is required for scene actions.');
        return;
      }
      device.state = `scene:${req.body.scene}`;
    }
    device.lastSeen = new Date().toISOString();
    await sendJson(res, 202, clone(device));
  })
);

router.get(
  '/zigbee/rules',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const items = Array.from(zigbeeRules.values()).map((rule) => clone(rule));
    await sendJson(res, 200, { items, total: items.length });
  })
);

router.get(
  '/zigbee/rules/:id',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const rule = zigbeeRules.get(req.params.id);
    if (!rule) {
      await sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Rule not found.');
      return;
    }
    await sendJson(res, 200, clone(rule));
  })
);

router.post(
  '/zigbee/rules',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const normalized = normalizeRuleDefinition(req.body);
    const now = new Date().toISOString();
    const rule: ZigbeeRuleRecord = {
      id: randomUUID(),
      name: normalized.name,
      description: normalized.description ?? null,
      trigger: normalized.trigger,
      actions: normalized.actions,
      tags: normalized.tags ?? [],
      metadata: normalized.metadata ?? {},
      enabled: normalized.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };
    zigbeeRules.set(rule.id, rule);
    await sendJson(res, 201, clone(rule));
  })
);

router.put(
  '/zigbee/rules/:id',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const rule = zigbeeRules.get(req.params.id);
    if (!rule) {
      await sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Rule not found.');
      return;
    }
    const updates = req.body ?? {};
    if (!updates || Object.keys(updates).length === 0) {
      await sendError(res, 400, 'VALIDATION_FAILED', 'No fields provided for update.');
      return;
    }
    const normalized = normalizeRuleUpdate(rule, updates);
    zigbeeRules.set(rule.id, normalized);
    await sendJson(res, 200, clone(normalized));
  })
);

router.delete(
  '/zigbee/rules/:id',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const existed = zigbeeRules.delete(req.params.id);
    if (!existed) {
      await sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Rule not found.');
      return;
    }
    res.status(204).send();
  })
);

router.patch(
  '/zigbee/rules/:id/enable',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const rule = zigbeeRules.get(req.params.id);
    if (!rule) {
      await sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Rule not found.');
      return;
    }
    const enabled = typeof req.body?.enabled === 'boolean' ? req.body.enabled : true;
    rule.enabled = enabled;
    rule.updatedAt = new Date().toISOString();
    zigbeeRules.set(rule.id, rule);
    await sendJson(res, 200, clone(rule));
  })
);

router.post(
  '/zigbee/rules/validate',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const normalized = normalizeRuleDefinition(req.body);
    await sendJson(res, 200, { valid: true, normalized, evaluatedAt: new Date().toISOString() });
  })
);

router.post(
  '/zigbee/rules/simulate',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const payload = req.body ?? {};
    let rule: ZigbeeRuleRecord | undefined;
    if (payload.definition) {
      const normalized = normalizeRuleDefinition(payload.definition);
      const now = new Date().toISOString();
      rule = {
        id: payload.ruleId ?? `sim-${randomUUID()}`,
        name: normalized.name,
        description: normalized.description ?? null,
        trigger: normalized.trigger,
        actions: normalized.actions,
        tags: normalized.tags ?? [],
        metadata: normalized.metadata ?? {},
        enabled: normalized.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      };
    } else if (payload.ruleId) {
      rule = zigbeeRules.get(payload.ruleId);
    }

    if (!rule) {
      await sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Rule not found for simulation.');
      return;
    }

    const started = new Date();
    const evaluation = evaluateRule(rule, payload.input ?? {});
    const completed = new Date();
    await sendJson(res, 200, {
      matched: evaluation.matched,
      actions: evaluation.matched ? clone(rule.actions) : [],
      rule: clone(rule),
      evaluation: {
        triggerType: rule.trigger.type,
        reason: evaluation.reason,
        error: evaluation.error,
        startedAt: started.toISOString(),
        completedAt: completed.toISOString(),
        durationMs: completed.getTime() - started.getTime(),
      },
    });
  })
);

router.get(
  '/camera/summary',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    await sendJson(res, 200, clone(cameraSummary));
  })
);

router.get(
  '/camera/events',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    let events = cameraEvents.slice();
    const since = req.query.since as string | undefined;
    if (since) {
      const sinceTs = new Date(since).getTime();
      events = events.filter((evt) => new Date(evt.timestamp).getTime() >= sinceTs);
    }
    const paged = paginate(
      events.map((evt) => clone(evt)),
      req
    );
    await sendJson(res, 200, paged);
  })
);

router.get(
  '/camera/preview/:id',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const preview = cameraPreviewMap.get(req.params.id);
    if (!preview) {
      await sendError(
        res,
        404,
        'RESOURCE_NOT_FOUND',
        `Preview for camera ${req.params.id} is not available.`
      );
      return;
    }
    await sendJson(res, 200, clone(preview));
  })
);

router.get(
  '/health/summary',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const summary = buildHealthSummary();
    await sendJson(res, 200, summary);
  })
);

router.get(
  '/events/recent',
  asyncHandler(async (req, res) => {
    if (await maybeSimulate(res, req)) {
      return;
    }
    const events = recentEvents.map((event) => clone(event));
    const paged = paginate(events, req);
    await sendJson(res, 200, paged);
  })
);

app.use(API_PREFIX, router);

function normalizeRuleDefinition(input: any): {
  name: string;
  description?: string;
  trigger: ZigbeeRuleTrigger;
  actions: ZigbeeRuleAction[];
  tags?: string[];
  metadata?: Record<string, unknown>;
  enabled?: boolean;
} {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new Error('name is required');
  }
  const description = typeof input?.description === 'string' ? input.description.trim() : undefined;
  const trigger = input?.trigger as ZigbeeRuleTrigger;
  const actions = Array.isArray(input?.actions) ? (input.actions as ZigbeeRuleAction[]) : [];
  if (!trigger || !actions.length) {
    throw new Error('trigger and actions are required');
  }
  const tags = Array.isArray(input?.tags) ? uniqueTags(input.tags as string[]) : undefined;
  const metadata =
    input?.metadata && typeof input.metadata === 'object'
      ? (input.metadata as Record<string, unknown>)
      : undefined;
  const enabled = typeof input?.enabled === 'boolean' ? input.enabled : undefined;
  return {
    name,
    ...(description ? { description } : {}),
    trigger,
    actions,
    ...(tags && tags.length ? { tags } : {}),
    ...(metadata ? { metadata } : {}),
    ...(typeof enabled === 'boolean' ? { enabled } : {}),
  };
}

function normalizeRuleUpdate(existing: ZigbeeRuleRecord, updates: any): ZigbeeRuleRecord {
  const normalized = normalizeRuleDefinition({
    ...existing,
    ...updates,
    name: updates?.name ?? existing.name,
  });
  return {
    ...existing,
    name: normalized.name,
    description: normalized.description ?? null,
    trigger: normalized.trigger,
    actions: normalized.actions,
    tags: normalized.tags ?? [],
    metadata: normalized.metadata ?? {},
    enabled: normalized.enabled ?? existing.enabled,
    updatedAt: new Date().toISOString(),
  };
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const normalized = tag.trim().toLowerCase();
    if (!normalized) continue;
    seen.add(normalized);
  }
  return Array.from(seen.values()).slice(0, 10);
}

function getByPath(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = source;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function compareValues(operator: ZigbeeRuleComparison, left: unknown, right: unknown): boolean {
  switch (operator) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'gt':
      return typeof left === 'number' && typeof right === 'number' ? left > right : false;
    case 'gte':
      return typeof left === 'number' && typeof right === 'number' ? left >= right : false;
    case 'lt':
      return typeof left === 'number' && typeof right === 'number' ? left < right : false;
    case 'lte':
      return typeof left === 'number' && typeof right === 'number' ? left <= right : false;
    case 'includes':
      if (typeof left === 'string' && typeof right === 'string') {
        return left.includes(right);
      }
      if (Array.isArray(left)) {
        return left.includes(right as never);
      }
      return false;
    case 'excludes':
      if (typeof left === 'string' && typeof right === 'string') {
        return !left.includes(right);
      }
      if (Array.isArray(left)) {
        return !left.includes(right as never);
      }
      return false;
    default:
      return false;
  }
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const child = (value as Record<string, unknown>)[key];
      if (child && typeof child === 'object' && !Object.isFrozen(child)) {
        freezeDeep(child);
      }
    }
  }
  return value;
}

function runRuleExpression(expression: string, context: Record<string, unknown>): boolean {
  const script = new Script(`(function(context){"use strict"; return (${expression});})`);
  const fn = script.runInNewContext({ Math }) as (ctx: Record<string, unknown>) => unknown;
  const result = fn(freezeDeep(structuredClone(context)));
  return Boolean(result);
}

function evaluateRule(
  rule: ZigbeeRuleRecord,
  input: {
    event?: Record<string, unknown>;
    context?: Record<string, unknown>;
    sensor?: Record<string, unknown>;
  }
): { matched: boolean; reason: string; error?: string } {
  if (rule.trigger.type === 'sensor_event') {
    const event = input.event ?? {};
    const sensorId = (event.sensorId as string) ?? (input.sensor?.id as string);
    const eventType = (event.type as string) ?? (event.event as string);
    if (sensorId !== rule.trigger.sensorId || eventType !== rule.trigger.event) {
      return { matched: false, reason: 'Sensor or event mismatch.' };
    }
    if (rule.trigger.condition) {
      const payload = (event.payload as Record<string, unknown>) ?? input.context ?? {};
      const value = getByPath(payload, rule.trigger.condition.field);
      const matched = compareValues(
        rule.trigger.condition.operator,
        value,
        rule.trigger.condition.value
      );
      return { matched, reason: matched ? 'Condition matched.' : 'Condition did not match.' };
    }
    return { matched: true, reason: 'Sensor event matched.' };
  }

  if (rule.trigger.type === 'schedule') {
    const context = input.context ?? {};
    if (context.cron && context.cron === rule.trigger.cron) {
      return { matched: true, reason: 'Cron expression matched.' };
    }
    if (context.scheduled === true) {
      return { matched: true, reason: 'Scheduled flag matched.' };
    }
    return { matched: false, reason: 'Schedule context did not match.' };
  }

  if (rule.trigger.type === 'expression') {
    try {
      const contextInput = (input.context as Record<string, unknown>) ?? {};
      const matched = runRuleExpression(rule.trigger.expression, {
        ...contextInput,
        event: input.event ?? {},
        sensor: input.sensor ?? {},
        context: contextInput,
        now: new Date().toISOString(),
      });
      return {
        matched,
        reason: matched
          ? 'Expression evaluated to truthy value.'
          : 'Expression evaluated to falsy value.',
      };
    } catch (error: any) {
      return {
        matched: false,
        reason: 'Expression evaluation failed.',
        error: error?.message ?? 'Unknown error',
      };
    }
  }

  return { matched: false, reason: 'Unsupported trigger type.' };
}

app.use(async (req, res) => {
  await sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Route not implemented.');
});

app.use(async (err: any, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) {
    return;
  }
  if (err && err.status === 401) {
    await sendError(res, 401, 'AUTH_REQUIRED', err.message ?? 'Bearer token is required.');
    return;
  }
  if (err && err.status === 403) {
    await sendError(res, 403, 'AUTH_FORBIDDEN', err.message ?? 'Token lacks required scope.');
    return;
  }
  if (err && err.status === 404) {
    await sendError(res, 404, 'RESOURCE_NOT_FOUND', err.message ?? 'Resource not found.');
    return;
  }
  if (err && err.status && Array.isArray(err.errors)) {
    await sendError(res, 422, 'VALIDATION_FAILED', 'Request validation failed.', {
      details: err.errors,
    });
    return;
  }
  // eslint-disable-next-line no-console
  console.error('Mock server error', err);
  await sendError(
    res,
    err?.status ?? 500,
    'INTERNAL_ERROR',
    err?.message ?? 'Unexpected error occurred.'
  );
});

const port = Number(process.env.PORT ?? '3015');
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock API server listening on http://localhost:${port}${API_PREFIX}`);
  if (UNSTABLE_MODE) {
    // eslint-disable-next-line no-console
    console.log('MOCK_UNSTABLE=1 enabled - simulating intermittent device timeouts.');
  }
});

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

async function sendJson(res: Response, status: number, payload: unknown) {
  await applyDelay();
  res.status(status).json(payload);
}

async function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  extras: Partial<ErrorPayload> = {}
) {
  await applyDelay();
  const correlationId: string = res.locals.correlationId ?? randomUUID();
  const response: ErrorPayload = {
    code,
    message,
    correlationId,
    ...(extras.hint ? { hint: extras.hint } : {}),
    ...(typeof extras.details !== 'undefined' ? { details: extras.details } : {}),
  };
  if (status === 429) {
    res.setHeader('x-ratelimit-limit', RATE_LIMIT_LIMIT.toString());
    res.setHeader('x-ratelimit-remaining', '0');
    res.setHeader('retry-after', RATE_LIMIT_RETRY_AFTER.toString());
  }
  res.status(status).json(response);
}

async function applyDelay() {
  if (DEFAULT_DELAY_MS <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, DEFAULT_DELAY_MS));
}

function paginate<T>(items: T[], req: Request): PaginatedResult<T> {
  const limitRaw = req.query.limit as string | undefined;
  const cursorRaw = req.query.cursor as string | undefined;
  const limit = clampLimit(limitRaw);
  const offset = parseCursor(cursorRaw);
  const page = items.slice(offset, offset + limit);
  const nextCursor = offset + limit < items.length ? `offset-${offset + limit}` : null;
  return { items: page, nextCursor };
}

function clampLimit(limitRaw?: string): number {
  if (!limitRaw) {
    return 50;
  }
  const parsed = Number(limitRaw);
  if (Number.isNaN(parsed)) {
    return 50;
  }
  return Math.min(200, Math.max(1, Math.floor(parsed)));
}

function parseCursor(cursor?: string): number {
  if (!cursor) {
    return 0;
  }
  const match = cursor.match(/^offset-(\d+)$/);
  if (!match) {
    return 0;
  }
  return Number(match[1]);
}

async function maybeSimulate(res: Response, req: Request): Promise<boolean> {
  const header = (req.header('x-mock-simulate') ?? '').toLowerCase();
  if (header === 'timeout') {
    await sendError(res, 504, 'UPSTREAM_TIMEOUT', 'Simulated upstream timeout.');
    return true;
  }
  if (header === 'bad-gateway') {
    await sendError(res, 502, 'UPSTREAM_UNAVAILABLE', 'Simulated upstream failure.');
    return true;
  }
  if (header === 'conflict') {
    await sendError(res, 409, 'RESOURCE_BUSY', 'Simulated conflicting device state.');
    return true;
  }
  if (header === 'rate-limit') {
    await sendError(res, 429, 'RATE_LIMIT_EXCEEDED', 'Simulated rate limit exceeded.');
    return true;
  }
  if (!UNSTABLE_MODE) {
    return false;
  }
  const routePath = `${req.baseUrl}${req.path}`;
  if (DEVICE_ROUTE_PREFIXES.some((prefix) => routePath.startsWith(`${API_PREFIX}${prefix}`))) {
    if (Math.random() < 0.1) {
      await sendError(res, 504, 'AUDIO_DEVICE_TIMEOUT', 'Upstream device timed out.');
      return true;
    }
  }
  return false;
}

function buildFleetOverview() {
  const audioDeviceList = Array.from(audioDevices.values());
  const zigbeeDeviceList = Array.from(zigbeeDevices.values());
  const cameraDeviceList = cameraSummary.cameras;

  // Calculate totals across all device types
  const totalDevices = audioDeviceList.length + zigbeeDeviceList.length + cameraDeviceList.length + 1; // +1 for TV
  const onlineDevices =
    audioDeviceList.filter(d => d.online).length +
    zigbeeDeviceList.filter(d => d.state !== 'offline').length +
    cameraDeviceList.filter(d => d.online).length +
    (tvStatus.online ? 1 : 0);
  const offlineDevices = totalDevices - onlineDevices;

  return {
    totals: {
      devices: totalDevices,
      online: onlineDevices,
      offline: offlineDevices,
      degraded: 0 // No degraded state in current mock data
    },
    modules: [
      {
        id: 'audio',
        label: 'Audio Players',
        online: audioDeviceList.filter(d => d.online).length,
        offline: audioDeviceList.filter(d => !d.online).length,
        degraded: 0
      },
      {
        id: 'video',
        label: 'Video',
        online: tvStatus.online ? 1 : 0,
        offline: tvStatus.online ? 0 : 1,
        degraded: 0
      },
      {
        id: 'zigbee',
        label: 'Zigbee',
        online: zigbeeDeviceList.filter(d => d.state !== 'offline').length,
        offline: zigbeeDeviceList.filter(d => d.state === 'offline').length,
        degraded: 0
      },
      {
        id: 'camera',
        label: 'Cameras',
        online: cameraDeviceList.filter(d => d.online).length,
        offline: cameraDeviceList.filter(d => !d.online).length,
        degraded: 0
      }
    ],
    devices: [
      ...audioDeviceList.map(d => ({
        id: d.id,
        name: d.displayName,
        role: 'audio-player',
        module: 'audio',
        status: d.online ? 'online' : 'offline',
        location: null,
        lastSeen: d.lastSeen,
        uptime: '24h',
        ipAddress: '192.168.1.100',
        version: '1.0.0',
        groups: [],
        tags: [],
        capabilities: ['play', 'stop', 'volume']
      })),
      {
        id: tvStatus.id,
        name: tvStatus.displayName,
        role: 'hdmi-media',
        module: 'video',
        status: tvStatus.online ? 'online' : 'offline',
        location: null,
        lastSeen: tvStatus.lastSeen,
        uptime: '72h',
        ipAddress: '192.168.1.101',
        version: '1.0.0',
        groups: [],
        tags: [],
        capabilities: ['power', 'input', 'volume']
      },
      ...zigbeeDeviceList.map((d, index) => ({
        id: d.id,
        name: d.displayName,
        role: 'zigbee-device',
        module: 'zigbee',
        status: d.state === 'offline' ? 'offline' : 'online',
        location: null,
        lastSeen: d.lastSeen || new Date().toISOString(),
        uptime: '48h',
        ipAddress: `192.168.1.${120 + index}`,
        version: '1.0.0',
        groups: [],
        tags: [],
        capabilities: ['toggle', 'scene']
      })),
      ...cameraDeviceList.map((d, index) => ({
        id: d.id,
        name: d.displayName,
        role: 'camera',
        module: 'camera',
        status: d.online ? 'online' : 'offline',
        location: null,
        lastSeen: new Date().toISOString(),
        uptime: '96h',
        ipAddress: `192.168.1.${200 + index}`,
        version: '1.0.0',
        groups: [],
        tags: [],
        capabilities: ['live-preview', 'events']
      }))
    ],
    updatedAt: new Date().toISOString()
  };
}

function buildFleetState() {
  const state = clone(stateTemplate) as any;
  state.generatedAt = new Date().toISOString();
  state.audio = state.audio ?? {};
  state.audio.devices = Array.from(audioDevices.values()).map((device) => clone(device));
  state.video = state.video ?? {};
  state.video.tv = clone(tvStatus);
  state.zigbee = state.zigbee ?? {};
  state.zigbee.totalDevices = zigbeeDevices.size;
  state.zigbee.devicesOnline = Array.from(zigbeeDevices.values()).filter(
    (device) => device.state !== 'offline'
  ).length;
  state.camera = state.camera ?? {};
  state.camera.totalCameras = cameraSummary.cameras.length;
  state.camera.onlineCameras = cameraSummary.cameras.filter((camera) => camera.online).length;
  state.camera.recordingCameras = cameraSummary.cameras.filter((camera) => camera.recording).length;
  const latestEvent = cameraEvents[0];
  state.camera.lastEventAt = latestEvent ? latestEvent.timestamp : null;
  const today = new Date();
  const startOfDay = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  state.camera.motionEventsToday = cameraEvents.filter(
    (evt) => evt.type === 'motion' && new Date(evt.timestamp).getTime() >= startOfDay.getTime()
  ).length;
  return state;
}

function buildHealthSummary(): HealthSummary {
  const summary = clone(healthTemplate);
  summary.updatedAt = new Date().toISOString();
  const audioModule = summary.modules.find((module) => module.id === 'audio');
  if (audioModule) {
    const offline = Array.from(audioDevices.values()).filter((device) => !device.online);
    if (offline.length > 0) {
      audioModule.status = 'degraded';
      const ids = offline.map((device) => device.id).join(', ');
      audioModule.message = `${offline.length} device${offline.length > 1 ? 's' : ''} offline (${ids})`;
    } else {
      audioModule.status = 'healthy';
      audioModule.message = null;
    }
  }
  const videoModule = summary.modules.find((module) => module.id === 'video');
  if (videoModule) {
    if (!tvStatus.online) {
      videoModule.status = 'degraded';
      videoModule.message = 'TV connection lost';
    } else {
      videoModule.status = 'healthy';
      videoModule.message = null;
    }
  }
  const cameraModule = summary.modules.find((module) => module.id === 'camera');
  if (cameraModule) {
    const offline = cameraSummary.cameras.filter((camera) => !camera.online);
    if (offline.length > 0) {
      cameraModule.status = 'degraded';
      cameraModule.message = `${offline.length} camera${offline.length > 1 ? 's' : ''} offline`;
    } else {
      cameraModule.status = 'healthy';
      cameraModule.message = null;
    }
  }
  const zigbeeModule = summary.modules.find((module) => module.id === 'zigbee');
  if (zigbeeModule) {
    const offline = Array.from(zigbeeDevices.values()).filter(
      (device) => device.state === 'offline'
    );
    if (offline.length > 0) {
      zigbeeModule.status = 'degraded';
      zigbeeModule.message = `${offline.length} device${offline.length > 1 ? 's' : ''} offline`;
    } else {
      zigbeeModule.status = 'healthy';
      zigbeeModule.message = null;
    }
  }
  summary.status = summary.modules.every((module) => module.status === 'healthy')
    ? 'healthy'
    : 'degraded';
  return summary;
}
