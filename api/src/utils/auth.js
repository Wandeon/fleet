import { nanoid } from 'nanoid';

const SESSION_TTL_SECONDS = parseInt(process.env.AUTH_SESSION_TTL ?? '43200', 10);

function parseKeyValueUsers(raw) {
  if (!raw || typeof raw !== 'string') {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(':');
      const username = parts[0]?.trim();
      const password = parts[1] ?? '';
      const displayName = parts[2]?.trim();
      if (!username) return null;
      return { username, password, displayName };
    })
    .filter(Boolean);
}

function parseJsonUsers(raw) {
  if (!raw || typeof raw !== 'string') {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const { username, password = '', displayName } = item;
        if (!username) return null;
        return {
          username: String(username),
          password: String(password),
          displayName: displayName ? String(displayName) : undefined,
        };
      })
      .filter(Boolean);
  } catch (err) {
    return [];
  }
}

const envUsers = parseKeyValueUsers(process.env.AUTH_USERS);
const jsonUsers = parseJsonUsers(process.env.AUTH_USERS_JSON);
const usersByName = new Map();
for (const entry of [...envUsers, ...jsonUsers]) {
  if (!usersByName.has(entry.username)) {
    usersByName.set(entry.username, entry);
  }
}

const USERS = Array.from(usersByName.values());
const ALLOW_FALLBACK = (() => {
  const flag = (process.env.AUTH_ALLOW_FALLBACK ?? '').toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return USERS.length === 0 && process.env.NODE_ENV !== 'production';
})();

const sessions = new Map();

function ttlSeconds(ttl) {
  const value = parseInt(ttl, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return SESSION_TTL_SECONDS;
  }
  return value;
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function toPublicUser(user) {
  return {
    username: user.username,
    displayName: user.displayName || user.username,
  };
}

export function isAuthConfigured() {
  return USERS.length > 0;
}

export function isFallbackMode() {
  return !isAuthConfigured() && ALLOW_FALLBACK;
}

export function authenticate(username, password) {
  cleanExpiredSessions();
  if (!username) {
    return null;
  }
  if (isAuthConfigured()) {
    const record = USERS.find((user) => user.username === username);
    if (!record) return null;
    if (record.password !== String(password ?? '')) return null;
    return toPublicUser(record);
  }
  if (!ALLOW_FALLBACK) {
    return null;
  }
  return toPublicUser({ username, displayName: username });
}

export function createSession(user, options = {}) {
  cleanExpiredSessions();
  const ttl = ttlSeconds(options.ttlSeconds ?? SESSION_TTL_SECONDS);
  const now = Date.now();
  const expiresAt = now + ttl * 1000;
  const token = nanoid(48);
  sessions.set(token, {
    username: user.username,
    issuedAt: now,
    expiresAt,
  });
  return {
    token,
    user,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    ttlSeconds: ttl,
  };
}

export function resolveSession(token) {
  if (!token) return null;
  cleanExpiredSessions();
  const record = sessions.get(token);
  if (!record) return null;
  return {
    token,
    user: toPublicUser({ username: record.username }),
    issuedAt: new Date(record.issuedAt).toISOString(),
    expiresAt: new Date(record.expiresAt).toISOString(),
  };
}

export function invalidateSession(token) {
  if (!token) return;
  sessions.delete(token);
}

function parseCookies(header) {
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    const value = rest.join('=');
    try {
      acc[key] = decodeURIComponent(value || '');
    } catch (err) {
      acc[key] = value || '';
    }
    return acc;
  }, {});
}

export function extractTokenFromRequest(req) {
  if (!req || typeof req !== 'object') return null;
  cleanExpiredSessions();
  const authHeader = typeof req.get === 'function' ? req.get('Authorization') : req.headers?.authorization;
  if (authHeader && typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(\S+)/i);
    if (match) {
      return match[1];
    }
  }
  const headerToken = typeof req.get === 'function'
    ? req.get('X-Session-Token') || req.get('X-Auth-Token')
    : req.headers?.['x-session-token'] || req.headers?.['x-auth-token'];
  if (headerToken) {
    return headerToken.trim();
  }
  const cookies = parseCookies(req.headers?.cookie || '');
  if (cookies.session) {
    return cookies.session;
  }
  return null;
}

export function listUsers() {
  return USERS.map(toPublicUser);
}
