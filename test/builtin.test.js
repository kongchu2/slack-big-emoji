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

test('resolves emoji characters', () => {
  assert.equal(resolveBuiltinEmoji('😄').name, 'smile');
  assert.equal(resolveBuiltinEmoji('👍🏻').name, '+1::skin-tone-2');
  assert.equal(image(resolveBuiltinEmoji('👍🏻')), '1f44d-1f3fb.png');
  // With and without the variation selector.
  assert.equal(resolveBuiltinEmoji('❤️').name, 'heart');
  assert.equal(resolveBuiltinEmoji('❤').name, 'heart');
  assert.equal(resolveBuiltinEmoji('🇰🇷').name, 'kr');
});
