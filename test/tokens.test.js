import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { test } from 'node:test';
import { createTokenStore } from '../src/tokens.js';

async function tempDir(t) {
  const dir = await mkdtemp(join(tmpdir(), 'big-emoji-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

const read = async (path) => JSON.parse(await readFile(path, 'utf8'));

test('set and remove persist and reload', async (t) => {
  const path = join(await tempDir(t), 'data', 'tokens.json');
  const tokens = await createTokenStore(path);
  await tokens.set('T1', 'U1', 'xoxp-1');
  await tokens.set('T1', 'U2', 'xoxp-2');
  await tokens.remove('T1', 'U1');
  assert.deepEqual(await read(path), { 'T1:U2': 'xoxp-2' });
  assert.equal((await createTokenStore(path)).get('T1', 'U2'), 'xoxp-2');
});

test('a failed save is reported, kept in memory and retried', async (t) => {
  const dir = await tempDir(t);
  const path = join(dir, 'store', 'tokens.json');
  const errors = [];
  const tokens = await createTokenStore(path, { onSaveError: (error) => errors.push(error), retryMs: 20 });

  // A plain file where the directory should be makes the save fail.
  await writeFile(join(dir, 'store'), '');
  await tokens.set('T1', 'U1', 'xoxp-1');
  assert.equal(errors.length, 1);
  assert.equal(tokens.get('T1', 'U1'), 'xoxp-1');

  await rm(join(dir, 'store'));
  for (let i = 0; i < 50; i += 1) {
    if (await read(path).catch(() => null)) break;
    await sleep(20);
  }
  assert.deepEqual(await read(path), { 'T1:U1': 'xoxp-1' });
});
