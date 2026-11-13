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

test('a name not found anywhere waits for a refresh', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const client = fakeClient([{ parrot: 'https://e/p.gif' }, { parrot: 'https://e/p.gif', party_cat: 'https://e/c.gif' }]);
  const lookup = createEmojiCache(client);
  await lookup('parrot');
  // At most once every 30 seconds.
  assert.equal(await lookup('party_cat'), null);
  assert.equal(client.calls, 1);
  t.mock.timers.tick(31 * 1000);
  assert.equal((await lookup('party_cat')).url, 'https://e/c.gif');
  assert.equal(client.calls, 2);
});

test('built-in emoji do not wait for emoji.list, which refreshes in the background', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  let release;
  const client = { calls: 0, emoji: { list: async () => {
    client.calls += 1;
    if (client.calls === 1) return { emoji: { parrot: 'https://e/p.gif', yes: 'alias:thumbsup' } };
    await new Promise((resolve) => { release = resolve; });
    return { emoji: { parrot: 'https://e/p.gif', yes: 'alias:thumbsup', smile: 'https://e/s.png' } };
  } } };
  const lookup = createEmojiCache(client);
  await lookup('parrot');
  assert.match((await lookup('smile')).url, /1f604\.png$/);
  assert.match((await lookup('yes')).url, /1f44d\.png$/);
  assert.equal(client.calls, 1);

  // Answered while the refresh is still pending.
  t.mock.timers.tick(31 * 1000);
  assert.match((await lookup('smile')).url, /1f604\.png$/);
  assert.match((await lookup('yes')).url, /1f44d\.png$/);
  assert.equal(client.calls, 2);

  // A custom emoji of the same name wins once the refresh is done.
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await lookup('smile')).url, 'https://e/s.png');
});

test('a failed background refresh keeps a fresh list for its full 10 minutes', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const client = fakeClient([{ parrot: 'https://e/p.gif' }, new Error('ratelimited')]);
  const lookup = createEmojiCache(client);
  await lookup('parrot');
  t.mock.timers.tick(31 * 1000);
  await lookup('smile');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.calls, 2);
  // Past the 30-second retry wait, but well within the list's 10 minutes.
  t.mock.timers.tick(60 * 1000);
  assert.equal((await lookup('parrot')).url, 'https://e/p.gif');
  assert.equal(client.calls, 2);
});

test('emoji characters never refresh the list', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const client = fakeClient([{ parrot: 'https://e/p.gif' }]);
  const lookup = createEmojiCache(client);
  await lookup('parrot');
  t.mock.timers.tick(31 * 1000);
  assert.match((await lookup('👍')).url, /1f44d\.png$/);
  assert.equal(await lookup('😄hi'), null);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.calls, 1);
});
