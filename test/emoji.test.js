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
  // Before the emoji, too.
  assert.deepEqual(parseEmoji(':skin-tone-2::thumbsup:'), { names: ['thumbsup'], skinTone: 2 });
  // The first tone wins, and tone 1 is the default.
  assert.equal(parseEmoji(':a::skin-tone-4::skin-tone-5:').skinTone, 4);
  assert.deepEqual(parseEmoji(':a::skin-tone-1:'), { names: ['a'], skinTone: null });
  // Not a tone: other names or out of range.
  assert.deepEqual(parseEmoji(':a: :my-skin-tone-2:'), { names: ['a', 'my-skin-tone-2'], skinTone: null });
  assert.deepEqual(parseEmoji(':a::skin-tone-7:'), { names: ['a', 'skin-tone-7'], skinTone: null });
  // On its own, a tone is the swatch emoji.
  assert.deepEqual(parseEmoji(':skin-tone-2:'), { names: ['skin-tone-2'], skinTone: null });
});

test('parseEmoji skin tones of two people', () => {
  assert.deepEqual(parseEmoji(':people_holding_hands::skin-tone-3-3:'), { names: ['people_holding_hands'], skinTone: 3 });
  assert.deepEqual(parseEmoji(':women_holding_hands::skin-tone-2-6:'), { names: ['women_holding_hands'], skinTone: '2-6' });
  assert.deepEqual(parseEmoji(':a::skin-tone-1-1:'), { names: ['a'], skinTone: null });
  assert.deepEqual(parseEmoji(':a::skin-tone-2-7:'), { names: ['a', 'skin-tone-2-7'], skinTone: null });
});

test('parseEmoji skin tone characters', () => {
  assert.deepEqual(parseEmoji('👍 🏻'), { names: ['👍'], skinTone: 2 });
  assert.deepEqual(parseEmoji('🏿👍'), { names: ['👍'], skinTone: 6 });
  assert.deepEqual(parseEmoji(':thumbsup: 🏼'), { names: ['thumbsup'], skinTone: 3 });
  assert.deepEqual(parseEmoji('🏻'), { names: ['🏻'], skinTone: null });
  assert.equal(displayName('🏻'), '🏻');
});

test('parseEmoji emoji characters', () => {
  assert.deepEqual(names('😄'), ['😄']);
  assert.deepEqual(names('😄😄'), ['😄', '😄']);
  assert.deepEqual(names('👍🏻'), ['👍🏻']);
  assert.deepEqual(names('🇰🇷'), ['🇰🇷']);
  assert.deepEqual(names('\u24c2\ufe0f'), ['\u24c2\ufe0f']);
  // Emoji mixed with other text stay one name, which is then not found.
  assert.deepEqual(names('😄hi'), ['😄hi']);
  assert.deepEqual(names('Hi😄 :b:'), ['Hi😄', 'b']);
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
