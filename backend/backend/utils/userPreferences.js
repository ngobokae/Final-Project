import { getSetting, setSetting } from './systemSettings.js';

const DEFAULT_PREFS = {
  email_notifications: true,
  alert_uploads: true,
  alert_inventory: true,
  alert_forecast_failures: true,
  digest: 'instant',
  avatar_color: 'slate',
  sessions: [],
};

const prefsKey = (userId) => `user_prefs_${userId}`;

export async function getUserPreferences(userId) {
  const stored = await getSetting(prefsKey(userId), null);
  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_PREFS };
  }
  return { ...DEFAULT_PREFS, ...stored, sessions: Array.isArray(stored.sessions) ? stored.sessions : [] };
}

export async function saveUserPreferences(userId, partial) {
  const current = await getUserPreferences(userId);
  const next = { ...current, ...partial };
  if (partial && !partial.sessions) {
    next.sessions = current.sessions;
  }
  await setSetting(prefsKey(userId), next, userId);
  return next;
}

export function parseUserAgent(ua) {
  if (!ua) return 'Unknown device';
  const s = String(ua);
  if (/Edg\//i.test(s)) return 'Microsoft Edge';
  if (/Chrome\//i.test(s) && !/Edg/i.test(s)) return 'Chrome';
  if (/Firefox\//i.test(s)) return 'Firefox';
  if (/Safari\//i.test(s) && !/Chrome/i.test(s)) return 'Safari';
  return 'Web browser';
}

export async function registerUserSession(userId, req) {
  const prefs = await getUserPreferences(userId);
  const ip = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || null;
  const userAgent = req?.headers['user-agent'] || null;
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const entry = {
    id: sessionId,
    device: parseUserAgent(userAgent),
    ip: typeof ip === 'string' ? ip.replace('::ffff:', '') : ip,
    userAgent,
    lastActive: new Date().toISOString(),
    current: true,
  };
  const sessions = (prefs.sessions || [])
    .map((s) => ({ ...s, current: false }))
    .filter((s) => s.id !== sessionId);
  sessions.unshift(entry);
  await saveUserPreferences(userId, { sessions: sessions.slice(0, 8) });
  return sessionId;
}
