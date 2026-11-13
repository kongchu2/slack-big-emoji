import { resolveBuiltinEmoji } from './builtin.js';

const CACHE_MS = 10 * 60 * 1000;
const MIN_REFRESH_MS = 30 * 1000;

const EMOJI_CHARACTERS = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u;
const SKIN_TONE = /^skin-tone-([2-6])$/;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

// Accepts `:a: :b:`, `:a::b:`, `a, b` and emoji characters (`👍`, split per emoji when run together).
// `:skin-tone-N:` after an emoji is its skin tone; on its own it is the swatch emoji of that name.
export function parseEmoji(text) {
  const names = [];
  let skinTone = null;
  for (const part of text.split(/[\s,:]+/)) {
    if (!part) continue;
    if (EMOJI_CHARACTERS.test(part)) {
      // Not lowercased: Ⓜ has a lowercase form that is no longer an emoji.
      names.push(...Array.from(graphemes.segment(part), ({ segment }) => segment));
      continue;
    }
    const name = part.toLowerCase();
    const tone = SKIN_TONE.exec(name);
    if (tone && names.length) skinTone ??= Number(tone[1]);
    else names.push(name);
  }
  return names.length ? { names, skinTone } : null;
}

// How a parsed name is shown back to the user: `:name:`, or the character itself.
export const displayName = (name) => (EMOJI_CHARACTERS.test(name) ? name : `:${name}:`);

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
    try {
      if (!list || Date.now() >= nextRefreshAt) {
        if (!list && Date.now() < nextRefreshAt) throw new Error('emoji.list retry pending');
        await refresh();
      }
      // Refresh before falling back to a built-in emoji, so a newly added custom emoji
      // with the same name is not shadowed until the cache expires.
      if (!resolveEmoji(list, name) && Date.now() - lastAttemptAt > MIN_REFRESH_MS) await refresh();
    } catch (error) {
      // Built-in emoji do not need the list.
      const found = builtin(name);
      if (found) return found;
      throw error;
    }
    return resolveEmoji(list, name, builtin);
  };
}
