import { Router } from 'express';
import {
  authenticate,
  createSession,
  extractTokenFromRequest,
  resolveSession,
  invalidateSession,
  isAuthConfigured,
  isFallbackMode,
  listUsers,
} from '../utils/auth.js';

const router = Router();
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'session';

function allowCookies(res) {
  return typeof res.cookie === 'function' && typeof res.clearCookie === 'function';
}

function secureCookie() {
  const flag = (process.env.AUTH_COOKIE_SECURE ?? '').toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

function setSessionCookie(res, session) {
  if (!allowCookies(res)) return;
  res.cookie(COOKIE_NAME, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie(),
    maxAge: session.ttlSeconds * 1000,
    path: '/',
  });
}

function clearSessionCookie(res) {
  if (!allowCookies(res)) return;
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'username_required' });
  }
  const user = authenticate(username.trim(), password ?? '');
  if (!user) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const session = createSession(user);
  setSessionCookie(res, session);
  res.json({
    ok: true,
    session,
    configured: isAuthConfigured(),
    fallback: isFallbackMode(),
  });
});

router.post('/logout', (req, res) => {
  const token = extractTokenFromRequest(req);
  if (token) {
    invalidateSession(token);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  const token = extractTokenFromRequest(req);
  const session = token ? resolveSession(token) : null;
  if (!session) {
    if (token) {
      invalidateSession(token);
    }
    clearSessionCookie(res);
    return res.json({
      authenticated: false,
      configured: isAuthConfigured(),
      fallback: isFallbackMode(),
      session: null,
    });
  }
  setSessionCookie(res, session);
  res.json({
    authenticated: true,
    configured: isAuthConfigured(),
    fallback: isFallbackMode(),
    session,
    users: isAuthConfigured() ? listUsers() : [],
  });
});

export default router;
