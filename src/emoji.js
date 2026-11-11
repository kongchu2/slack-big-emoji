import { resolveBuiltinEmoji } from './builtin.js';

const CACHE_MS = 10 * 60 * 1000;
const MIN_REFRESH_MS = 30 * 1000;

// Accepts `:a: :b:`, `:a::b:` and `a, b`. Skin tone modifiers (`::skin-tone-2:`) are dropped
// here and read separately by parseSkinTone.
export function parseEmojiNames(text) {
  const names = text
    .split(/[\s,:]+/)
    .filter((part) => part && !/^skin-tone-\d$/.test(part))
    .map((part) => part.toLowerCase());
  return names.length ? names : null;
}

export function parseSkinTone(text) {
  const match = /(?:^|[\s,:])skin-tone-([2-6])(?=$|[\s,:])/i.exec(text);
  return match ? Number(match[1]) : null;
}

// Names that are not custom emoji, including aliases that point at a built-in one, go to `builtin`.
export function resolveEmoji(list, name, builtin = () => null) {
  let current = name;
  for (let depth = 0; depth < 5; depth += 1) {
    // Own properties only: names like `constructor` must not hit Object.prototype.
    const value = Object.hasOwn(list, current) ? list[current] : undefined;
    if (typeof value !== 'string') return builtin(current);
    if (!value.startsWith('alias:')) return { name: current, url: value };
    current = value.slice('alias:'.length);
  }
  return null;
}

export function createEmojiCache(client) {
  let list = null;
  let nextRefreshAt = 0;
  let lastAttemptAt = 0;
  let pending = null;

  // Concurrent lookups share one in-flight emoji.list call.
  // On failure the previous list is kept, and the next retry waits MIN_REFRESH_MS.
  function refresh() {
    pending ??= client.emoji
      .list()
      .then((result) => {
        list = result.emoji ?? {};
        nextRefreshAt = Date.now() + CACHE_MS;
      })
      .catch((error) => {
        nextRefreshAt = Date.now() + MIN_REFRESH_MS;
        if (!list) throw error;
      })
      .finally(() => {
        lastAttemptAt = Date.now();
        pending = null;
      });
    return pending;
  }

  return async function lookup(name, skinTone = null) {
    const builtin = (builtinName) => resolveBuiltinEmoji(builtinName, skinTone);
    if (!list || Date.now() >= nextRefreshAt) {
      if (!list && Date.now() < nextRefreshAt) throw new Error('emoji.list retry pending');
      await refresh();
    }
    let found = resolveEmoji(list, name, builtin);
    if (!found && Date.now() - lastAttemptAt > MIN_REFRESH_MS) {
      await refresh();
      found = resolveEmoji(list, name, builtin);
    }
    return found;
  };
}
