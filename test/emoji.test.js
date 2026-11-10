import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEmojiNames, resolveEmoji } from '../src/emoji.js';

test('parseEmojiNames', () => {
  assert.deepEqual(parseEmojiNames(':party_parrot:'), ['party_parrot']);
  assert.deepEqual(parseEmojiNames('  party_parrot '), ['party_parrot']);
  assert.deepEqual(parseEmojiNames(':thumbsup::skin-tone-2:'), ['thumbsup']);
  assert.deepEqual(parseEmojiNames(':Big-Cat:'), ['big-cat']);
  assert.deepEqual(parseEmojiNames(':Café_Wink:'), ['café_wink']);
  assert.equal(parseEmojiNames(''), null);
  assert.equal(parseEmojiNames('  :: , '), null);
  assert.deepEqual(parseEmojiNames(':a: :b:'), ['a', 'b']);
  assert.deepEqual(parseEmojiNames(':a::b:'), ['a', 'b']);
  assert.deepEqual(parseEmojiNames('emoji_1, emoji_2'), ['emoji_1', 'emoji_2']);
  assert.deepEqual(parseEmojiNames(':a::skin-tone-3: :b:'), ['a', 'b']);
});

test('resolveEmoji follows aliases', () => {
  const list = { parrot: 'https://e/p.gif', pp: 'alias:parrot', loop: 'alias:loop' };
  assert.deepEqual(resolveEmoji(list, 'parrot'), { name: 'parrot', url: 'https://e/p.gif' });
  assert.deepEqual(resolveEmoji(list, 'pp'), { name: 'parrot', url: 'https://e/p.gif' });
  assert.equal(resolveEmoji(list, 'loop'), null);
  assert.equal(resolveEmoji(list, 'nope'), null);
});

test('resolveEmoji ignores names inherited from Object.prototype', () => {
  const list = { parrot: 'https://e/p.gif' };
  assert.equal(resolveEmoji(list, 'constructor'), null);
  assert.equal(resolveEmoji(list, '__proto__'), null);
});
