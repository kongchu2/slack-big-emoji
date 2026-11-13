import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveBuiltinEmoji } from '../src/builtin.js';

const image = (emoji) => emoji.url.split('/').pop();

test('resolves short names and their aliases', () => {
  assert.equal(image(resolveBuiltinEmoji('smile')), '1f604.png');
  assert.deepEqual(resolveBuiltinEmoji('thumbsup'), resolveBuiltinEmoji('+1'));
  assert.equal(resolveBuiltinEmoji('+1').name, '+1');
  assert.match(resolveBuiltinEmoji('smile').url, /^https:\/\/cdn\.jsdelivr\.net\/gh\/iamcal\/emoji-data@v[\d.]+\/img-apple-160\//);
  assert.equal(resolveBuiltinEmoji('not_an_emoji'), null);
  assert.equal(resolveBuiltinEmoji('constructor'), null);
});

test('applies skin tones only where a variation exists', () => {
  const toned = resolveBuiltinEmoji('+1', 2);
  assert.equal(image(toned), '1f44d-1f3fb.png');
  assert.equal(toned.name, '+1::skin-tone-2');
  assert.deepEqual(resolveBuiltinEmoji('smile', 2), resolveBuiltinEmoji('smile'));
});

test('applies skin tones to both people of a two-person emoji', () => {
  // people_holding_hands only has pair keys (`1F3FC-1F3FC`), which Slack names `skin-tone-3-3`.
  const holding = resolveBuiltinEmoji('people_holding_hands', 3);
  assert.equal(image(holding), '1f9d1-1f3fc-200d-1f91d-200d-1f9d1-1f3fc.png');
  assert.equal(holding.name, 'people_holding_hands::skin-tone-3-3');
  assert.deepEqual(resolveBuiltinEmoji('people_holding_hands', '3-3'), holding);
  // handshake also has the single key `1F3FC`.
  const handshake = resolveBuiltinEmoji('handshake', 3);
  assert.equal(image(handshake), '1f91d-1f3fc.png');
  assert.equal(handshake.name, 'handshake::skin-tone-3');

  // Different tones, as in `:skin-tone-2-6:`.
  const mixedHolding = resolveBuiltinEmoji('people_holding_hands', '2-6');
  assert.equal(image(mixedHolding), '1f9d1-1f3fb-200d-1f91d-200d-1f9d1-1f3ff.png');
  assert.equal(mixedHolding.name, 'people_holding_hands::skin-tone-2-6');
  assert.equal(image(resolveBuiltinEmoji('handshake', '2-3')), '1faf1-1f3fb-200d-1faf2-1f3fc.png');
  // An emoji of one person has no pair variation.
  assert.deepEqual(resolveBuiltinEmoji('+1', '2-6'), resolveBuiltinEmoji('+1'));

  // The same emoji as characters keep their tones in the name.
  const character = String.fromCodePoint(0x1f9d1, 0x1f3fc, 0x200d, 0x1f91d, 0x200d, 0x1f9d1, 0x1f3fc);
  assert.deepEqual(resolveBuiltinEmoji(character), holding);
  const mixed = String.fromCodePoint(0x1f9d1, 0x1f3fb, 0x200d, 0x1f91d, 0x200d, 0x1f9d1, 0x1f3fc);
  assert.equal(resolveBuiltinEmoji(mixed).name, 'people_holding_hands::skin-tone-2-3');
});

test('resolves the skin tone swatches', () => {
  assert.equal(resolveBuiltinEmoji('skin-tone-2').name, 'skin-tone-2');
  assert.equal(resolveBuiltinEmoji('🏻').name, 'skin-tone-2');
});

test('resolves emoji characters', () => {
  assert.equal(resolveBuiltinEmoji('😄').name, 'smile');
  assert.equal(resolveBuiltinEmoji('👍🏻').name, '+1::skin-tone-2');
  assert.equal(image(resolveBuiltinEmoji('👍🏻')), '1f44d-1f3fb.png');
  // With and without the variation selector.
  assert.equal(resolveBuiltinEmoji('❤️').name, 'heart');
  assert.equal(resolveBuiltinEmoji('❤').name, 'heart');
  assert.equal(resolveBuiltinEmoji('🇰🇷').name, 'kr');
  assert.equal(resolveBuiltinEmoji('\u24c2\ufe0f').name, 'm');
});

test('applies a separate skin tone to an emoji character', () => {
  assert.deepEqual(resolveBuiltinEmoji('👍', 3), resolveBuiltinEmoji('+1', 3));
  // A tone carried by the character wins.
  assert.equal(resolveBuiltinEmoji('👍🏻', 3).name, '+1::skin-tone-2');
  assert.deepEqual(resolveBuiltinEmoji('😄', 3), resolveBuiltinEmoji('smile'));
});
