import { Router } from 'express';
import type { Request, Response } from 'express';
import { logger } from '../middleware/logging';

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
    message: typeof obj === 'string' ? obj : (obj.msg || JSON.stringify(obj)),
    meta: typeof obj === 'object' && obj !== null ? obj : undefined
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer = logBuffer.slice(-MAX_BUFFER_SIZE);
  }

  logEventCallbacks.forEach(callback => {
    try {
      callback(entry);
    } catch (err) {
      // Ignore callback errors to prevent infinite loops
    }
  });
}

logger.info = function(obj: any, ...args: any[]) {
  captureLog('info', obj);
  return originalLogInfo(obj, ...args);
};

logger.error = function(obj: any, ...args: any[]) {
  captureLog('error', obj);
  return originalLogError(obj, ...args);
};

logger.warn = function(obj: any, ...args: any[]) {
  captureLog('warn', obj);
  return originalLogWarn(obj, ...args);
};

logger.debug = function(obj: any, ...args: any[]) {
  captureLog('debug', obj);
  return originalLogDebug(obj, ...args);
};

const logEventCallbacks: Set<(entry: LogEntry) => void> = new Set();

router.get('/stream', (req: Request, res: Response) => {
  res.locals.routePath = '/logs/stream';

  const level = req.query.level as string || 'info';
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);

  const acceptsEventStream = req.headers.accept?.includes('text/event-stream');

  if (acceptsEventStream) {
    // Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };
    const minLevel = levelPriority[level as keyof typeof levelPriority] || 1;

    // Send existing logs
    const filteredLogs = logBuffer
      .filter(entry => (levelPriority[entry.level as keyof typeof levelPriority] || 1) >= minLevel)
      .slice(-limit);

    filteredLogs.forEach(entry => {
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
      .filter(entry => (levelPriority[entry.level as keyof typeof levelPriority] || 1) >= minLevel)
      .slice(-limit);

    res.json({
      logs: filteredLogs,
      totalCount: filteredLogs.length,
      level: level,
      generatedAt: new Date().toISOString()
    });
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
      stream: '/logs/stream?level=info&limit=100'
    },
    timestamp: new Date().toISOString()
  });
});

export const logsRouter = router;