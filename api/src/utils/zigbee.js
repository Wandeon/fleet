import mqtt from 'mqtt';

const DEFAULT_TIMEOUT = parseInt(process.env.ZIGBEE_MQTT_TIMEOUT ?? '5000', 10);
const GLOBAL_URL = process.env.ZIGBEE_MQTT_URL || null;
const GLOBAL_USERNAME = process.env.ZIGBEE_MQTT_USER || null;
const GLOBAL_PASSWORD = process.env.ZIGBEE_MQTT_PASSWORD || null;
const GLOBAL_BASE_TOPIC = process.env.ZIGBEE_MQTT_BASE_TOPIC || 'zigbee2mqtt';
const GLOBAL_PORT = process.env.ZIGBEE_MQTT_PORT || null;
const GLOBAL_TLS = (process.env.ZIGBEE_MQTT_USE_TLS || '').toLowerCase() === 'true';

function parseHostFromDevice(device) {
  if (!device || typeof device !== 'object') return null;
  if (device.management?.host) return device.management.host;
  const baseUrl = device.api?.base_url;
  if (!baseUrl) return null;
  try {
    const parsed = new URL(baseUrl);
    return parsed.hostname;
  } catch (err) {
    return null;
  }
}

function buildUrl(device) {
  if (GLOBAL_URL) return GLOBAL_URL;
  const host = parseHostFromDevice(device);
  if (!host) {
    throw new Error('zigbee_host_unset');
  }
  const port = GLOBAL_PORT || '1883';
  const protocol = GLOBAL_TLS ? 'mqtts' : 'mqtt';
  return `${protocol}://${host}:${port}`;
}

function buildOptions(device, overrides = {}) {
  const url = overrides.url || buildUrl(device);
  const timeout = overrides.timeout ?? DEFAULT_TIMEOUT;
  const baseTopic = overrides.baseTopic || GLOBAL_BASE_TOPIC;
  const username = overrides.username ?? GLOBAL_USERNAME ?? undefined;
  const password = overrides.password ?? GLOBAL_PASSWORD ?? undefined;
  return {
    url,
    username,
    password,
    timeout,
    baseTopic,
  };
}

function parseMessage(payload) {
  if (!payload) return null;
  const text = payload.toString('utf8');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}

function withClient(device, options, handler) {
  const connection = buildOptions(device, options);
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(connection.url, {
      username: connection.username,
      password: connection.password,
      connectTimeout: connection.timeout,
      reconnectPeriod: 0,
      keepalive: 30,
      clientId: `fleet-api-${Math.random().toString(16).slice(2, 10)}`,
    });

    let settled = false;

    const finalize = (err, value) => {
      if (settled) return;
      settled = true;
      client.end(true, () => {
        if (err) reject(err);
        else resolve(value);
      });
    };

    client.once('error', (err) => finalize(err));
    client.once('connect', () => {
      Promise.resolve(handler(client, connection))
        .then((value) => finalize(null, value))
        .catch((err) => finalize(err));
    });
  });
}


function requestResponse(client, requestTopic, payload, responseTopic, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('zigbee_response_timeout'));
    }, timeout ?? DEFAULT_TIMEOUT);

    const cleanup = () => {
      clearTimeout(timer);
      client.removeListener('message', onMessage);
      client.unsubscribe(responseTopic, () => {});
    };

    const onMessage = (incomingTopic, msg) => {
      if (incomingTopic !== responseTopic) return;
      const data = parseMessage(msg);
      cleanup();
      resolve(data);
    };

    client.subscribe(responseTopic, (err) => {
      if (err) {
        cleanup();
        reject(err);
        return;
      }
      const buffer = payload == null
        ? ''
        : typeof payload === 'string'
          ? payload
          : JSON.stringify(payload);
      client.publish(requestTopic, buffer, { qos: 0 }, (pubErr) => {
        if (pubErr) {
          cleanup();
          reject(pubErr);
        }
      });
    });

    client.on('message', onMessage);
  });
}

export function deriveZigbeeOptions(device, overrides = {}) {
  return buildOptions(device, overrides);
}

export async function permitJoin(device, params = {}, overrides = {}) {
  return withClient(device, overrides, async (client, options) => {
    const payload = {};
    const enable = params.enable ?? params.value ?? params.state;
    if (enable === undefined) {
      payload.value = true;
    } else {
      payload.value = Boolean(enable);
    }
    const duration = params.duration ?? params.time ?? params.seconds;
    if (duration !== undefined) {
      const numeric = Number(duration);
      if (Number.isFinite(numeric) && numeric > 0) {
        payload.time = Math.round(numeric);
      }
    }
    const response = await requestResponse(
      client,
      `${options.baseTopic}/bridge/request/permit_join`,
      payload,
      `${options.baseTopic}/bridge/response/permit_join`,
      options.timeout,
    );
    return response;
  });
}

function normalizeListResponse(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && Array.isArray(data.data)) {
    return data.data;
  }
  return [];
}

export async function listEndpoints(device, overrides = {}) {
  return withClient(device, overrides, async (client, options) => {
    const devicesTopic = `${options.baseTopic}/bridge/devices`;
    const responseTopic = `${options.baseTopic}/bridge/response/devices`;

    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('zigbee_devices_timeout'));
      }, options.timeout ?? DEFAULT_TIMEOUT);

      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        client.removeListener('message', onMessage);
        client.unsubscribe([devicesTopic, responseTopic], () => {});
      };

      const onMessage = (incomingTopic, payload) => {
        if (incomingTopic !== devicesTopic && incomingTopic !== responseTopic) {
          return;
        }
        if (settled) return;
        settled = true;
        cleanup();
        const data = parseMessage(payload);
        resolve(normalizeListResponse(data));
      };

      client.subscribe([devicesTopic, responseTopic], (err) => {
        if (err) {
          cleanup();
          reject(err);
          return;
        }
        const requestPayload = JSON.stringify({});
        client.publish(`${options.baseTopic}/bridge/request/devices`, requestPayload, { qos: 0 });
        client.publish(`${options.baseTopic}/bridge/request/devices/get`, requestPayload, { qos: 0 });
      });

      client.on('message', onMessage);
    });

    return result;
  });
}

export async function removeEndpoint(device, endpointId, overrides = {}) {
  if (!endpointId) {
    throw new Error('zigbee_endpoint_required');
  }
  return withClient(device, overrides, async (client, options) => {
    const response = await requestResponse(
      client,
      `${options.baseTopic}/bridge/request/device/remove`,
      { id: endpointId },
      `${options.baseTopic}/bridge/response/device/remove`,
      options.timeout,
    );
    return response;
  });
}

export async function getEndpointStatus(device, endpointId, overrides = {}) {
  if (!endpointId) {
    throw new Error('zigbee_endpoint_required');
  }
  return withClient(device, overrides, async (client, options) => {
    const response = await requestResponse(
      client,
      `${options.baseTopic}/bridge/request/device/get`,
      { id: endpointId },
      `${options.baseTopic}/bridge/response/device/get`,
      options.timeout,
    );
    if (response && typeof response === 'object') {
      if (response.data && typeof response.data === 'object') {
        return response.data;
      }
      return response;
    }
    return null;
  });
}
