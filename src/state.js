import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_MS = 10 * 60 * 1000;

function sign(secret, body) {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function createState(secret, payload, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: now + TTL_MS })).toString('base64url');
  return `${body}.${sign(secret, body)}`;
}

export function readState(secret, state, now = Date.now()) {
  if (typeof state !== 'string') return null;
  const [body, mac] = state.split('.');
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(secret, body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;
  return payload;
}
