import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmojiCache } from '../src/emoji.js';

function fakeClient(responses) {
  const client = { calls: 0, emoji: { list: async () => {
    client.calls += 1;
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { emoji: next };
  } } };
  return client;
}

test('concurrent lookups share one emoji.list call', async () => {
  const client = fakeClient([{ parrot: 'https://e/p.gif' }]);
  const lookup = createEmojiCache(client);
  const results = await Promise.all([lookup('parrot'), lookup('parrot'), lookup('parrot')]);
  assert.equal(client.calls, 1);
  for (const r of results) assert.equal(r.url, 'https://e/p.gif');
});

test('first failure throws and does not retry immediately', async () => {
  const client = fakeClient([new Error('ratelimited')]);
  const lookup = createEmojiCache(client);
  await assert.rejects(lookup('parrot'));
  await assert.rejects(lookup('parrot'));
  assert.equal(client.calls, 1);
});

test('stale list is kept when refresh fails', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const client = fakeClient([{ parrot: 'https://e/p.gif' }, new Error('ratelimited')]);
  const lookup = createEmojiCache(client);
  assert.equal((await lookup('parrot')).url, 'https://e/p.gif');
  t.mock.timers.tick(11 * 60 * 1000);
  assert.equal((await lookup('parrot')).url, 'https://e/p.gif');
  assert.equal((await lookup('parrot')).url, 'https://e/p.gif');
  assert.equal(client.calls, 2);
});
