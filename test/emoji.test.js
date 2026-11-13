import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displayName, parseEmoji, resolveEmoji } from '../src/emoji.js';

const names = (text) => parseEmoji(text)?.names ?? null;

test('parseEmoji names', () => {
  assert.deepEqual(names(':party_parrot:'), ['party_parrot']);
  assert.deepEqual(names('  party_parrot '), ['party_parrot']);
  assert.deepEqual(names(':thumbsup::skin-tone-2:'), ['thumbsup']);
  assert.deepEqual(names(':Big-Cat:'), ['big-cat']);
  assert.deepEqual(names(':Café_Wink:'), ['café_wink']);
  assert.equal(names(''), null);
  assert.equal(names('  :: , '), null);
  assert.deepEqual(names(':a: :b:'), ['a', 'b']);
  assert.deepEqual(names(':a::b:'), ['a', 'b']);
  assert.deepEqual(names('emoji_1, emoji_2'), ['emoji_1', 'emoji_2']);
  assert.deepEqual(names(':a::skin-tone-3: :b:'), ['a', 'b']);
});

test('parseEmoji skin tones', () => {
  assert.equal(parseEmoji(':thumbsup::skin-tone-2:').skinTone, 2);
  assert.equal(parseEmoji(':thumbsup: :skin-tone-6:').skinTone, 6);
  assert.equal(parseEmoji(':thumbsup:').skinTone, null);
  assert.deepEqual(parseEmoji(':THUMBSUP::SKIN-TONE-2:'), { names: ['thumbsup'], skinTone: 2 });
  assert.deepEqual(parseEmoji('👍 :skin-tone-3:'), { names: ['👍'], skinTone: 3 });
  assert.deepEqual(parseEmoji('👍:skin-tone-3:'), { names: ['👍'], skinTone: 3 });
  // Not a tone: other names, out of range, or nothing before it to modify.
  assert.deepEqual(parseEmoji(':a: :my-skin-tone-2:'), { names: ['a', 'my-skin-tone-2'], skinTone: null });
  assert.deepEqual(parseEmoji(':a::skin-tone-7:'), { names: ['a', 'skin-tone-7'], skinTone: null });
  assert.deepEqual(parseEmoji(':skin-tone-2:'), { names: ['skin-tone-2'], skinTone: null });
});

test('parseEmoji emoji characters', () => {
  assert.deepEqual(names('😄'), ['😄']);
  assert.deepEqual(names('😄😄'), ['😄', '😄']);
  assert.deepEqual(names('👍🏻'), ['👍🏻']);
  assert.deepEqual(names('🇰🇷'), ['🇰🇷']);
  assert.deepEqual(names('\u24c2\ufe0f'), ['\u24c2\ufe0f']);
  assert.equal(displayName('😄'), '😄');
  assert.equal(displayName('smile'), ':smile:');
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

test('resolveEmoji hands non-custom names and built-in aliases to the fallback', () => {
  const list = { parrot: 'https://e/p.gif', yes: 'alias:thumbsup' };
  const builtin = (name) => ({ name, url: `builtin:${name}` });
  assert.deepEqual(resolveEmoji(list, 'parrot', builtin), { name: 'parrot', url: 'https://e/p.gif' });
  assert.deepEqual(resolveEmoji(list, 'smile', builtin), { name: 'smile', url: 'builtin:smile' });
  assert.deepEqual(resolveEmoji(list, 'yes', builtin), { name: 'thumbsup', url: 'builtin:thumbsup' });
});
