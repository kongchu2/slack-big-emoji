import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const RETRY_MS = 30 * 1000;

// Memory is the source of truth. `set` and `remove` change it right away and never reject:
// a failed write is reported through `onSaveError` and retried until it succeeds.
export async function createTokenStore(path, { onSaveError = () => {}, retryMs = RETRY_MS } = {}) {
  let tokens = {};
  try {
    tokens = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let dirty = false;
  let flushing = null;
  let retryTimer = null;

  async function write() {
    const temp = `${path}.tmp`;
    try {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(temp, JSON.stringify(tokens, null, 2), { mode: 0o600 });
      await rename(temp, path);
    } catch (error) {
      await rm(temp, { force: true }).catch(() => {});
      throw error;
    }
  }

  async function flush() {
    try {
      while (dirty) {
        dirty = false;
        await write();
      }
    } catch (error) {
      dirty = true;
      onSaveError(error);
      retryTimer = setTimeout(save, retryMs);
      retryTimer.unref();
    } finally {
      flushing = null;
    }
  }

  // Resolves once the current state is on disk, or once a write has failed and a retry is scheduled.
  function save() {
    clearTimeout(retryTimer);
    dirty = true;
    flushing ??= flush();
    return flushing;
  }

  const key = (teamId, userId) => `${teamId}:${userId}`;

  return {
    get: (teamId, userId) => tokens[key(teamId, userId)],
    set(teamId, userId, token) {
      tokens[key(teamId, userId)] = token;
      return save();
    },
    remove(teamId, userId) {
      delete tokens[key(teamId, userId)];
      return save();
    },
  };
}
