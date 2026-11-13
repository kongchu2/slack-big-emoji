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
  // A name that is not a built-in emoji either, so nothing can answer without the list.
  await assert.rejects(lookup('party_parrot'));
  await assert.rejects(lookup('party_parrot'));
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

test('built-in emoji resolve even when emoji.list fails', async () => {
  const client = fakeClient([new Error('missing_scope')]);
  const lookup = createEmojiCache(client);
  assert.match((await lookup('smile')).url, /1f604\.png$/);
  assert.match((await lookup('smile')).url, /1f604\.png$/);
  await assert.rejects(lookup('not_an_emoji'));
  assert.equal(client.calls, 1);
});

test('a new custom emoji is not shadowed by a built-in one of the same name', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const client = fakeClient([{ parrot: 'https://e/p.gif' }, { parrot: 'https://e/p.gif', smile: 'https://e/s.png' }]);
  const lookup = createEmojiCache(client);
  await lookup('parrot');
  t.mock.timers.tick(31 * 1000);
  assert.equal((await lookup('smile')).url, 'https://e/s.png');
  assert.equal(client.calls, 2);
});
