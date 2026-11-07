import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { createScaler, upscale } from '../src/scale.js';

test('upscale doubles a static image as png', async () => {
  const source = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#f00' } }).png().toBuffer();
  const { buffer, ext } = await upscale(source, 2);
  const meta = await sharp(buffer).metadata();
  assert.equal(ext, 'png');
  assert.equal(meta.width, 128);
  assert.equal(meta.height, 128);
});

test('serve only answers generated file names', async () => {
  const scaler = createScaler({ dir: 'test/does-not-exist', publicUrl: 'https://example.com/' });
  for (const file of ['../.env', 'abc.png', `${'a'.repeat(32)}.png`]) {
    let status;
    await scaler.serve({ params: { file } }, { writeHead: (code) => (status = code), end: () => {} });
    assert.equal(status, 404, file);
  }
});
