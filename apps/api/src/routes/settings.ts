import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const router = Router();

const operatorRoleSchema = z.enum(['admin', 'automation', 'viewer', 'incident', 'security']);
const proxySchema = z.object({
  upstreamUrl: z.string().url().optional(),
  authMode: z.enum(['none', 'basic', 'token']).optional(),
  heartbeatIntervalSeconds: z.coerce.number().int().min(5).max(3600).optional(),
});

const allowedOriginsSchema = z.object({
  origins: z.array(z.string().min(1)).min(1),
});

const pairingStartSchema = z.object({
  networkRole: z.enum(['audio', 'video', 'lighting', 'sensor']),
  expiresInSeconds: z.coerce.number().int().min(60).max(3600),
});

const pairingClaimSchema = z.object({
  alias: z.string().optional(),
  location: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  roles: z.array(operatorRoleSchema).default(['viewer']),
});

const operatorUpdateSchema = z
  .object({
    roles: z.array(operatorRoleSchema).min(1).optional(),
    status: z.enum(['pending', 'active', 'suspended']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

const alertChannelSchema = z.enum(['slack', 'email', 'sms']);

const securityUpdateSchema = z
  .object({
    nightMode: z
      .object({
        escalationEnabled: z.boolean().optional(),
        alertChannels: z.array(alertChannelSchema).min(1).optional(),
      })
      .optional(),
  })
  .refine((value) => value.nightMode && Object.keys(value.nightMode).length > 0, {
    message: 'nightMode update is required.',
  });

const operatorState: {
  proxy: {
    upstreamUrl: string;
    authMode: 'none' | 'basic' | 'token';
    heartbeatIntervalSeconds: number;
  };
  allowedOrigins: string[];
  operators: {
    id: string;
    email: string;
    roles: z.infer<typeof operatorRoleSchema>[];
    invitedAt: string;
    status: 'pending' | 'active' | 'suspended';
    lastUpdatedAt: string;
  }[];
  pairing: {
    active: boolean;
    expiresAt: string | null;
    ticketId: string | null;
    candidates: { id: string; model: string; signal: number }[];
  };
  apiTokenPreview: string;
  security: {
    nightMode: {
      escalationEnabled: boolean;
      alertChannels: z.infer<typeof alertChannelSchema>[];
      updatedAt: string;
    };
  };
} = {
  proxy: {
    upstreamUrl: 'https://proxy.example.internal',
    authMode: 'token',
    heartbeatIntervalSeconds: 60,
  },
  allowedOrigins: ['https://ui.fleet.local'],
  operators: [
    {
      id: 'op-1',
      email: 'alice@example.com',
      roles: ['admin'],
      invitedAt: new Date().toISOString(),
      status: 'active',
      lastUpdatedAt: new Date().toISOString(),
    },
  ],
  pairing: {
    active: false,
    expiresAt: null,
    ticketId: null,
    candidates: [],
  },
  apiTokenPreview: 'tok-live-****',
  security: {
    nightMode: {
      escalationEnabled: true,
      alertChannels: ['slack'],
      updatedAt: new Date().toISOString(),
    },
  },
};

router.get('/', (_req, res) => {
  res.locals.routePath = '/settings';
  res.json({
    proxy: operatorState.proxy,
    allowedOrigins: operatorState.allowedOrigins,
    operators: operatorState.operators,
    pairing: operatorState.pairing,
    apiTokenPreview: operatorState.apiTokenPreview,
    security: operatorState.security,
    updatedAt: new Date().toISOString(),
  });
});

router.patch('/proxy', (req, res, next) => {
  res.locals.routePath = '/settings/proxy';
  try {
    const payload = proxySchema.parse(req.body);
    operatorState.proxy = { ...operatorState.proxy, ...payload };
    res.status(202).json({ proxy: operatorState.proxy, updatedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.post('/api-token', (_req, res) => {
  res.locals.routePath = '/settings/api-token';
  const newToken = `tok-${randomUUID()}`;
  operatorState.apiTokenPreview = `${newToken.slice(0, 8)}****`;
  res.status(202).json({
    status: 'rotating',
    tokenPreview: operatorState.apiTokenPreview,
    rotatedAt: new Date().toISOString(),
  });
});

router.put('/allowed-origins', (req, res, next) => {
  res.locals.routePath = '/settings/allowed-origins';
  try {
    const payload = allowedOriginsSchema.parse(req.body);
    operatorState.allowedOrigins = payload.origins;
    res
      .status(202)
      .json({ allowedOrigins: operatorState.allowedOrigins, updatedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.post('/pairing/start', (req, res, next) => {
  res.locals.routePath = '/settings/pairing/start';
  try {
    const payload = pairingStartSchema.parse(req.body);
    const expiresAt = new Date(Date.now() + payload.expiresInSeconds * 1000).toISOString();
    const ticketId = randomUUID();
    operatorState.pairing = {
      active: true,
      expiresAt,
      ticketId,
      candidates: [
        { id: `cand-${ticketId.slice(0, 6)}`, model: `${payload.networkRole}-sensor`, signal: -45 },
      ],
    };
    res.status(202).json(operatorState.pairing);
  } catch (error) {
    next(error);
  }
});

router.post('/pairing/cancel', (_req, res) => {
  res.locals.routePath = '/settings/pairing/cancel';
  operatorState.pairing = { active: false, expiresAt: null, ticketId: null, candidates: [] };
  res.status(202).json({ cancelled: true, updatedAt: new Date().toISOString() });
});

router.post('/pairing/:candidateId/claim', (req, res, next) => {
  res.locals.routePath = '/settings/pairing/:candidateId/claim';
  try {
    const payload = pairingClaimSchema.parse(req.body ?? {});
    const { candidateId } = req.params;
    operatorState.pairing.candidates = operatorState.pairing.candidates.filter(
      (candidate) => candidate.id !== candidateId
    );
    res.status(202).json({
      accepted: true,
      candidateId,
      metadata: payload,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/operators', (req, res, next) => {
  res.locals.routePath = '/settings/operators';
  try {
    const payload = inviteSchema.parse(req.body);
    const existing = operatorState.operators.find((operator) => operator.email === payload.email);
    if (existing) {
      res.status(409).json({ code: 'conflict', message: 'Operator already exists' });
      return;
    }
    const now = new Date().toISOString();
    const operator = {
      id: randomUUID(),
      email: payload.email,
      roles: Array.from(new Set(payload.roles)),
      invitedAt: now,
      status: 'pending' as const,
      lastUpdatedAt: now,
    };
    operatorState.operators.push(operator);
    res.status(201).json(operator);
  } catch (error) {
    next(error);
  }
});

router.get('/operators', (_req, res) => {
  res.locals.routePath = '/settings/operators';
  res.json({
    items: operatorState.operators,
    total: operatorState.operators.length,
    updatedAt: new Date().toISOString(),
  });
});

router.put('/operators/:operatorId', (req, res, next) => {
  res.locals.routePath = '/settings/operators/:operatorId';
  try {
    const payload = operatorUpdateSchema.parse(req.body ?? {});
    const operator = operatorState.operators.find((item) => item.id === req.params.operatorId);
    if (!operator) {
      res.status(404).json({ code: 'not_found', message: 'Operator not found' });
      return;
    }
    if (payload.roles) {
      operator.roles = Array.from(new Set(payload.roles));
    }
    if (payload.status) {
      operator.status = payload.status;
    }
    operator.lastUpdatedAt = new Date().toISOString();
    res.json(operator);
  } catch (error) {
    next(error);
  }
});

router.delete('/operators/:operatorId', (req, res) => {
  res.locals.routePath = '/settings/operators/:operatorId';
  const { operatorId } = req.params;
  operatorState.operators = operatorState.operators.filter(
    (operator) => operator.id !== operatorId
  );
  res.status(202).json({ removed: true, operatorId, updatedAt: new Date().toISOString() });
});

router.get('/security', (_req, res) => {
  res.locals.routePath = '/settings/security';
  res.json({ ...operatorState.security, retrievedAt: new Date().toISOString() });
});

router.patch('/security', (req, res, next) => {
  res.locals.routePath = '/settings/security';
  try {
    const payload = securityUpdateSchema.parse(req.body ?? {});
    const now = new Date().toISOString();
    if (payload.nightMode?.escalationEnabled !== undefined) {
      operatorState.security.nightMode.escalationEnabled = payload.nightMode.escalationEnabled;
    }
    if (payload.nightMode?.alertChannels) {
      operatorState.security.nightMode.alertChannels = Array.from(
        new Set(payload.nightMode.alertChannels)
      );
    }
    operatorState.security.nightMode.updatedAt = now;
    res.json({ nightMode: operatorState.security.nightMode, updatedAt: now });
  } catch (error) {
    next(error);
  }
});

export const settingsRouter = router;
