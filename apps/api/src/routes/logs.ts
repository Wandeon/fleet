import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../middleware/logging';
import { createLogExportJob, isLogExportAuthorized } from '../services/logExport.js';
import { logsExportRequestSchema } from '../util/schema/logs.js';

const router = Router();

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: Record<string, unknown>;
}

let logBuffer: LogEntry[] = [];
const MAX_BUFFER_SIZE = 1000;

const originalLogInfo = logger.info.bind(logger);
const originalLogError = logger.error.bind(logger);
const originalLogWarn = logger.warn.bind(logger);
const originalLogDebug = logger.debug.bind(logger);

function captureLog(level: string, obj: any) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: typeof obj === 'string' ? obj : obj.msg || JSON.stringify(obj),
    meta: typeof obj === 'object' && obj !== null ? obj : undefined,
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer = logBuffer.slice(-MAX_BUFFER_SIZE);
  }

  logEventCallbacks.forEach((callback) => {
    try {
      callback(entry);
    } catch {
      // Ignore callback errors to prevent infinite loops
    }
  });
}

logger.info = function (obj: any, ...args: any[]) {
  captureLog('info', obj);
  return originalLogInfo(obj, ...args);
};

logger.error = function (obj: any, ...args: any[]) {
  captureLog('error', obj);
  return originalLogError(obj, ...args);
};

logger.warn = function (obj: any, ...args: any[]) {
  captureLog('warn', obj);
  return originalLogWarn(obj, ...args);
};

logger.debug = function (obj: any, ...args: any[]) {
  captureLog('debug', obj);
  return originalLogDebug(obj, ...args);
};

const logEventCallbacks: Set<(entry: LogEntry) => void> = new Set();

router.get('/stream', (req: Request, res: Response) => {
  res.locals.routePath = '/logs/stream';

  const level = (req.query.level as string) || 'info';
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);

  const acceptsEventStream = req.headers.accept?.includes('text/event-stream');

  if (acceptsEventStream) {
    // Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };
    const minLevel = levelPriority[level as keyof typeof levelPriority] || 1;

    // Send existing logs
    const filteredLogs = logBuffer
      .filter(
        (entry) => (levelPriority[entry.level as keyof typeof levelPriority] || 1) >= minLevel
      )
      .slice(-limit);

    filteredLogs.forEach((entry) => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    });

    // Set up real-time streaming
    const callback = (entry: LogEntry) => {
      if ((levelPriority[entry.level as keyof typeof levelPriority] || 1) >= minLevel) {
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
      }
    };

    logEventCallbacks.add(callback);

    // Cleanup on disconnect
    req.on('close', () => {
      logEventCallbacks.delete(callback);
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });
  } else {
    // JSON fallback
    const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };
    const minLevel = levelPriority[level as keyof typeof levelPriority] || 1;

    const filteredLogs = logBuffer
      .filter(
        (entry) => (levelPriority[entry.level as keyof typeof levelPriority] || 1) >= minLevel
      )
      .slice(-limit);

    res.json({
      logs: filteredLogs,
      totalCount: filteredLogs.length,
      level: level,
      generatedAt: new Date().toISOString(),
    });
  }
});

const logQuerySchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
  deviceId: z.string().optional(),
  correlationId: z.string().optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

function parseDelimitedHeader(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

router.get('/query', (req, res, next) => {
  res.locals.routePath = '/logs/query';
  try {
    const params = logQuerySchema.parse(req.query);
    const levelPriority = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 } as const;
    const minLevel = params.level ? levelPriority[params.level] : 0;

    const startTime = params.start ? new Date(params.start) : null;
    const endTime = params.end ? new Date(params.end) : null;

    const items = logBuffer
      .filter((entry) => {
        const entryLevel = levelPriority[entry.level as keyof typeof levelPriority] ?? 0;
        if (entryLevel < minLevel) {
          return false;
        }
        if (params.deviceId && entry.meta?.deviceId !== params.deviceId) {
          return false;
        }
        if (params.correlationId && entry.meta?.correlationId !== params.correlationId) {
          return false;
        }

        // Time range filtering
        const entryTime = new Date(entry.timestamp);
        if (startTime && entryTime < startTime) {
          return false;
        }
        if (endTime && entryTime > endTime) {
          return false;
        }

        return true;
      })
      .slice(-params.limit);
    res.json({ items, total: items.length, fetchedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.post('/export', (req, res, next) => {
  res.locals.routePath = '/logs/export';
  try {
    const payload = logsExportRequestSchema.parse(req.body ?? {});
    const rolesHeader = parseDelimitedHeader(req.headers['x-operator-roles']);
    const singleRoleHeader = parseDelimitedHeader(req.headers['x-operator-role']);
    const genericRoleHeader = parseDelimitedHeader(req.headers['x-roles']);
    const roles = Array.from(new Set([...rolesHeader, ...singleRoleHeader, ...genericRoleHeader]));
    const scopeHeader = parseDelimitedHeader(req.headers['x-operator-scopes']);
    const singleScopeHeader = parseDelimitedHeader(req.headers['x-operator-scope']);
    const genericScopeHeader = parseDelimitedHeader(req.headers['x-scopes']);
    const authContext = res.locals.auth;
    const baseScopes = Array.isArray(authContext?.scopes)
      ? [...(authContext?.scopes as string[])]
      : [];
    const scopes = Array.from(
      new Set([...baseScopes, ...scopeHeader, ...singleScopeHeader, ...genericScopeHeader])
    );

    if (!isLogExportAuthorized(roles, scopes)) {
      res.status(403).json({
        code: 'forbidden',
        message: 'Log export requires a privileged role or scope.',
      });
      return;
    }

    const job = createLogExportJob(
      {
        deviceId: payload.deviceId,
        level: payload.level,
        start: payload.start ? new Date(payload.start) : undefined,
        end: payload.end ? new Date(payload.end) : undefined,
      },
      payload.format,
      req.correlationId
    );

    res.status(202).json(job);
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:id', (req, res, next) => {
  res.locals.routePath = '/logs/jobs/:id';
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      res.status(400).json({
        code: 'invalid_request',
        message: 'Export job ID is required.',
        correlationId: req.correlationId,
      });
      return;
    }

    // For now, return a mock response since job storage isn't implemented yet
    // TODO: Implement persistent job storage and status tracking
    const mockJob = {
      exportId: id,
      status: 'completed' as const,
      format: 'json' as const,
      filters: {
        deviceId: null,
        level: null,
        start: null,
        end: null,
      },
      requestedAt: new Date(Date.now() - 30000).toISOString(),
      estimatedReadyAt: new Date().toISOString(),
      downloadUrl: `https://logs.example/exports/${id}.json`,
      correlationId: req.correlationId,
    };

    res.json(mockJob);
  } catch (error) {
    next(error);
  }
});

// Simple endpoint to check if logs service is working
router.get('/', (req, res) => {
  res.locals.routePath = '/logs';
  res.json({
    message: 'Logs API endpoint',
    status: 'active',
    bufferSize: logBuffer.length,
    maxBufferSize: MAX_BUFFER_SIZE,
    endpoints: {
      stream: '/logs/stream?level=info&limit=100',
    },
    timestamp: new Date().toISOString(),
  });
});

export const logsRouter = router;
