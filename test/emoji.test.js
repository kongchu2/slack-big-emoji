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

test('parseCommand reads an optional x2', async () => {
  const { parseCommand } = await import('../src/emoji.js');
  assert.deepEqual(parseCommand(':parrot:'), { name: 'parrot', scale: 1 });
  assert.deepEqual(parseCommand(':parrot: x2'), { name: 'parrot', scale: 2 });
  assert.deepEqual(parseCommand('2X :parrot:'), { name: 'parrot', scale: 2 });
  assert.deepEqual(parseCommand(':고양이콘_윙크: x2'), { name: '고양이콘_윙크', scale: 2 });
  assert.equal(parseCommand('x2'), null);
  assert.equal(parseCommand(':a: :b:'), null);
  assert.equal(parseCommand(':a: x3'), null);
});
