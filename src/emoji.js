import { resolveBuiltinEmoji } from './builtin.js';

const CACHE_MS = 10 * 60 * 1000;
const MIN_REFRESH_MS = 30 * 1000;

const EMOJI_CHARACTERS = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u20e3]/u;
const SKIN_TONE_NAME = /^skin-tone-([1-6])$/;
const SKIN_TONE_CHARACTER = /^[\u{1f3fb}-\u{1f3ff}]$/u;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

// The N of `:skin-tone-N:`, or of a modifier character (🏻-🏿 are tones 2-6). Null for anything else.
function skinToneOf(token) {
  if (SKIN_TONE_CHARACTER.test(token)) return token.codePointAt(0) - 0x1f3fb + 2;
  const match = SKIN_TONE_NAME.exec(token);
  return match ? Number(match[1]) : null;
}

// Emoji run together (`👍😄`) are split per emoji; a part that mixes emoji and other text stays whole.
// Emoji characters are not lowercased: Ⓜ has a lowercase form that is no longer an emoji.
function splitPart(part) {
  if (!EMOJI_CHARACTERS.test(part)) return [part.toLowerCase()];
  const segments = Array.from(graphemes.segment(part), ({ segment }) => segment);
  return segments.every((segment) => EMOJI_CHARACTERS.test(segment)) ? segments : [part];
}

// Accepts `:a: :b:`, `:a::b:`, `a, b` and emoji characters.
// A skin tone (`:skin-tone-N:` or 🏻-🏿) before or after an emoji is its skin tone, and the first one wins.
// `:skin-tone-1:` is the default tone. A skin tone on its own is the swatch emoji of that name.
export function parseEmoji(text) {
  const names = [];
  const tones = [];
  for (const part of text.split(/[\s,:]+/)) {
    if (!part) continue;
    for (const token of splitPart(part)) (skinToneOf(token) ? tones : names).push(token);
  }
  if (!names.length) return tones.length ? { names: tones, skinTone: null } : null;
  const skinTone = tones.length ? skinToneOf(tones[0]) : null;
  return { names, skinTone: skinTone > 1 ? skinTone : null };
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
  // On failure the previous list is kept, and the next retry waits at least MIN_REFRESH_MS.
  function refresh() {
    pending ??= client.emoji
      .list()
      .then((result) => {
        list = result.emoji ?? {};
        nextRefreshAt = Date.now() + CACHE_MS;
      })
      .catch((error) => {
        // A failed background refresh does not cut short a list that is still fresh.
        nextRefreshAt = Math.max(nextRefreshAt, Date.now() + MIN_REFRESH_MS);
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
    } catch (error) {
      // Built-in emoji do not need the list.
      const found = builtin(name);
      if (found) return found;
      throw error;
    }

    const custom = resolveEmoji(list, name);
    if (custom) return custom;
    // Custom emoji cannot be named with emoji characters, so a new list cannot change those.
    const canRefresh = !EMOJI_CHARACTERS.test(name) && Date.now() - lastAttemptAt > MIN_REFRESH_MS;
    const found = resolveEmoji(list, name, builtin);
    if (found) {
      // A custom emoji of the same name may have been added since the last fetch. Waiting for
      // emoji.list here would slow down every built-in lookup, so the list is refreshed in the
      // background and the next lookup sees it. refresh() keeps the old list on failure, so this
      // does not reject.
      if (canRefresh) refresh();
      return found;
    }
    // Not found anywhere: it may be a custom emoji added since the last fetch.
    if (!canRefresh) return null;
    await refresh();
    return resolveEmoji(list, name, builtin);
  };
}
