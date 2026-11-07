import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEmojiName, resolveEmoji } from '../src/emoji.js';

test('parseEmojiName', () => {
  assert.equal(parseEmojiName(':party_parrot:'), 'party_parrot');
  assert.equal(parseEmojiName('  party_parrot '), 'party_parrot');
  assert.equal(parseEmojiName(':thumbsup::skin-tone-2:'), 'thumbsup');
  assert.equal(parseEmojiName(':Big-Cat:'), 'big-cat');
  assert.equal(parseEmojiName(''), null);
  assert.equal(parseEmojiName(':a: :b:'), null);
});

test('resolveEmoji follows aliases', () => {
  const list = { parrot: 'https://e/p.gif', pp: 'alias:parrot', loop: 'alias:loop' };
  assert.deepEqual(resolveEmoji(list, 'parrot'), { name: 'parrot', url: 'https://e/p.gif' });
  assert.deepEqual(resolveEmoji(list, 'pp'), { name: 'parrot', url: 'https://e/p.gif' });
  assert.equal(resolveEmoji(list, 'loop'), null);
  assert.equal(resolveEmoji(list, 'nope'), null);
});
