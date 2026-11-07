import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createState, readState } from '../src/state.js';

test('state round-trips and rejects tampering and expiry', () => {
  const state = createState('secret', { user: 'U1', team: 'T1' }, 0);
  assert.equal(readState('secret', state, 1000).user, 'U1');
  assert.equal(readState('other', state, 1000), null);
  assert.equal(readState('secret', state, 11 * 60 * 1000), null);
  const [body, mac] = state.split('.');
  const forged = Buffer.from(JSON.stringify({ user: 'U2', team: 'T1', exp: 1e15 })).toString('base64url');
  assert.equal(readState('secret', `${forged}.${mac}`, 1000), null);
  assert.equal(readState('secret', body, 1000), null);
  assert.equal(readState('secret', undefined), null);
});
