import { Router } from 'express';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import {
  getDevice as getRegistryDevice,
  buildAuthHeaders,
  resolveDeviceUrl,
} from '../utils/deviceRegistry.js';
import { queueDeviceCommand } from '../services/commandService.js';
import { getDevice as getDeviceRecord } from '../services/deviceService.js';
import { ValidationError } from '../utils/errors.js';

const r = Router();

r.post('/:deviceId/:operationId', async (req, res, next) => {
  const { deviceId, operationId } = req.params;
  try {
    const deviceDef = getRegistryDevice(deviceId);
    if (!deviceDef) {
      return res.status(404).json({ error: 'device_not_found' });
    }
    const operation = deviceDef.operations.find((op) => op.id === operationId);
    if (!operation) {
      return res.status(404).json({ error: 'operation_not_found' });
    }

    const deviceRecord = await getDeviceRecord(deviceId);

    const method = operation.method || 'POST';
    const url = resolveDeviceUrl(deviceDef, operation.path);
    if (!url) {
      throw new ValidationError('operation_url_unset');
    }

    const headers = {
      Accept: 'application/json, text/plain;q=0.8',
      ...buildAuthHeaders(deviceDef),
    };

    let body = operation.body && typeof operation.body === 'object' ? { ...operation.body } : undefined;
    const hasRequestBody = req.body && Object.keys(req.body || {}).length > 0;
    if (hasRequestBody) {
      body = { ...(body || {}), ...req.body };
    }

    const commandName = `operation.${operationId}`;
    const requestDefinition = {
      url,
      method,
      headers,
      body,
      timeout: 5000,
      accept: 'application/json, text/plain;q=0.8',
    };

    const payloadFingerprint = body ? JSON.stringify(body) : '';
    const dedupeKey = `${deviceId}:${commandName}:${createHash('sha1').update(payloadFingerprint).digest('hex')}`;
    const correlationId = nanoid(12);
    const { jobId, correlationId: jobCorrelationId } = await queueDeviceCommand(deviceRecord, {
      command: commandName,
      payload: body || {},
      request: requestDefinition,
      successEvent: `${commandName}.success`,
      errorEvent: `${commandName}.error`,
      dedupeKey,
      correlationId,
    });

    res.status(202).json({ accepted: true, job_id: jobId, correlation_id: jobCorrelationId, device: deviceId, operation: operationId });
  } catch (err) {
    next(err);
  }
});

export default r;
