import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function createTokenStore(path) {
  let tokens = {};
  try {
    tokens = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let writing = Promise.resolve();

  function save() {
    writing = writing.then(async () => {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const temp = `${path}.tmp`;
      await writeFile(temp, JSON.stringify(tokens, null, 2), { mode: 0o600 });
      await rename(temp, path);
    });
    return writing;
  }

  const key = (teamId, userId) => `${teamId}:${userId}`;

  return {
    get: (teamId, userId) => tokens[key(teamId, userId)],
    async set(teamId, userId, token) {
      tokens[key(teamId, userId)] = token;
      await save();
    },
    async remove(teamId, userId) {
      delete tokens[key(teamId, userId)];
      await save();
    },
  };
}
