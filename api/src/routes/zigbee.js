import { Router } from 'express';
import { getDevice, readDevices } from '../utils/deviceRegistry.js';
import { ensureKind } from '../utils/deviceHttp.js';
import {
  permitJoin,
  listEndpoints,
  removeEndpoint,
  getEndpointStatus,
} from '../utils/zigbee.js';

const router = Router();

function isHub(device) {
  return ensureKind(device, ['zigbee', 'video', 'hdmi-media']);
}

function findHub(id) {
  if (!id) return null;
  const device = getDevice(id);
  if (!device) return null;
  return isHub(device) ? device : null;
}

function defaultHub() {
  return readDevices().find((device) => isHub(device)) || null;
}

function hubOrDefault(id) {
  return findHub(id) || defaultHub();
}

function respondOk(res, payload) {
  res.json({ ok: true, ...payload });
}

function respondError(res, error, code) {
  const detail = error instanceof Error ? error.message : String(error);
  const status = detail === 'zigbee_host_unset' ? 400 : 502;
  res.status(status).json({ error: code, detail });
}

router.post('/hubs/:hubId/permit-join', async (req, res) => {
  const { hubId } = req.params;
  const hub = findHub(hubId);
  if (!hub) {
    return res.status(404).json({ error: 'hub_not_found' });
  }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    const response = await permitJoin(hub, body);
    const success = Boolean(
      response && typeof response === 'object'
        ? response.success ?? response.value ?? (response.status === 'ok')
        : response
    );
    respondOk(res, { hub: hub.id, success, response });
  } catch (err) {
    respondError(res, err, 'zigbee_permit_join_failed');
  }
});

router.get('/hubs/:hubId/endpoints', async (req, res) => {
  const { hubId } = req.params;
  const hub = findHub(hubId);
  if (!hub) {
    return res.status(404).json({ error: 'hub_not_found' });
  }
  try {
    const endpoints = await listEndpoints(hub);
    respondOk(res, { hub: hub.id, endpoints });
  } catch (err) {
    respondError(res, err, 'zigbee_list_failed');
  }
});

router.delete('/endpoints/:endpointId', async (req, res) => {
  const { endpointId } = req.params;
  const hub = hubOrDefault(req.query.hubId);
  if (!hub) {
    return res.status(404).json({ error: 'hub_not_found' });
  }
  if (!endpointId) {
    return res.status(400).json({ error: 'endpoint_required' });
  }
  try {
    const response = await removeEndpoint(hub, endpointId);
    respondOk(res, { hub: hub.id, endpoint: endpointId, response });
  } catch (err) {
    respondError(res, err, 'zigbee_remove_failed');
  }
});

router.get('/endpoints/:endpointId/status', async (req, res) => {
  const { endpointId } = req.params;
  const hub = hubOrDefault(req.query.hubId);
  if (!hub) {
    return res.status(404).json({ error: 'hub_not_found' });
  }
  if (!endpointId) {
    return res.status(400).json({ error: 'endpoint_required' });
  }
  try {
    const status = await getEndpointStatus(hub, endpointId);
    respondOk(res, { hub: hub.id, endpoint: endpointId, status });
  } catch (err) {
    respondError(res, err, 'zigbee_status_failed');
  }
});

export default router;
