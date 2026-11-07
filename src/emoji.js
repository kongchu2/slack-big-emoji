const CACHE_MS = 10 * 60 * 1000;
const MIN_REFRESH_MS = 30 * 1000;

export function parseEmojiName(text) {
  const match = text.trim().match(/^:?([^:\s]+?)(?:::skin-tone-\d)?:?$/);
  return match ? match[1].toLowerCase() : null;
}

export function parseCommand(text) {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  let scale = 1;
  const rest = parts.filter((part) => {
    if (/^(x2|2x)$/i.test(part)) {
      scale = 2;
      return false;
    }
    return true;
  });
  if (rest.length !== 1) return null;
  const name = parseEmojiName(rest[0]);
  return name ? { name, scale } : null;
}

export function resolveEmoji(list, name) {
  let current = name;
  for (let depth = 0; depth < 5; depth += 1) {
    const value = list[current];
    if (value === undefined) return null;
    if (!value.startsWith('alias:')) return { name: current, url: value };
    current = value.slice('alias:'.length);
  }
  return null;
}

export function createEmojiCache(client) {
  let list = {};
  let fetchedAt = 0;

  async function refresh() {
    const result = await client.emoji.list();
    list = result.emoji ?? {};
    fetchedAt = Date.now();
  }

  return async function lookup(name) {
    const age = Date.now() - fetchedAt;
    if (age > CACHE_MS) await refresh();
    let found = resolveEmoji(list, name);
    if (!found && Date.now() - fetchedAt > MIN_REFRESH_MS) {
      await refresh();
      found = resolveEmoji(list, name);
    }
    return found;
  };
}
