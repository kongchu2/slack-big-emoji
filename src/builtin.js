import data from 'emoji-datasource/emoji.json' with { type: 'json' };
import pkg from 'emoji-datasource/package.json' with { type: 'json' };

// Slack's own short names come from this dataset. The npm package only ships 64px images,
// so the 160px Apple set is served from the matching tag of the dataset's repository.
// The dependency is pinned to an exact version because that tag has to exist.
const IMAGE_BASE = `https://cdn.jsdelivr.net/gh/iamcal/emoji-data@v${pkg.version}/img-apple-160/`;
const SKIN_TONES = { 2: '1F3FB', 3: '1F3FC', 4: '1F3FD', 5: '1F3FE', 6: '1F3FF' };
// What follows `skin-tone-` in a Slack name, by variation key. Emoji of two people use the pair form:
// `1F3FC-1F3FC` is `3-3` and `1F3FB-1F3FF` is `2-6` (`:women_holding_hands::skin-tone-2-6:`).
const SUFFIX_BY_KEY = new Map();
for (const [first, firstCode] of Object.entries(SKIN_TONES)) {
  SUFFIX_BY_KEY.set(firstCode, first);
  for (const [second, secondCode] of Object.entries(SKIN_TONES)) {
    SUFFIX_BY_KEY.set(`${firstCode}-${secondCode}`, `${first}-${second}`);
  }
}

// The variation keys a skin tone (`3`, `3-3` or `2-6`) can match, in order. One tone for everyone
// is `1F3FC`, or `1F3FC-1F3FC` on emoji that only have pair keys (people_holding_hands).
function variationKeys(skinTone) {
  const [first, second = first] = String(skinTone).split('-');
  const firstCode = SKIN_TONES[first];
  const secondCode = SKIN_TONES[second];
  if (!firstCode || !secondCode) return [];
  const pair = `${firstCode}-${secondCode}`;
  return first === second ? [firstCode, pair] : [pair];
}

const byName = new Map();
const byUnified = new Map();
for (const entry of data) {
  if (!entry.has_img_apple) continue;
  for (const name of entry.short_names) byName.set(name, entry);
  for (const code of [entry.unified, entry.non_qualified]) {
    if (code) byUnified.set(code, { entry, key: null });
  }
  for (const [key, variation] of Object.entries(entry.skin_variations ?? {})) {
    for (const code of [variation.unified, variation.non_qualified]) {
      if (code) byUnified.set(code, { entry, key });
    }
  }
}

function fromCharacters(text) {
  const codes = [...text].map((char) => char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
  return (
    byUnified.get(codes.join('-')) ??
    // Clients differ on whether they send the variation selector.
    byUnified.get(codes.filter((code) => code !== 'FE0F').join('-')) ??
    null
  );
}

// `name` is a Slack short name (`thumbsup`) or the emoji character itself (`👍`).
// `skinTone` is what follows `skin-tone-` (`3`, or `2-6` for two people) and is ignored for emoji
// that have no such variation. A character that already carries a skin tone keeps it.
export function resolveBuiltinEmoji(name, skinTone = null) {
  let entry = byName.get(name);
  let key = null;
  if (!entry) {
    const found = fromCharacters(name);
    if (!found) return null;
    ({ entry, key } = found);
  }
  key ??= variationKeys(skinTone).find((candidate) => entry.skin_variations?.[candidate]) ?? null;
  const variation = key && entry.skin_variations[key];
  if (!variation?.has_img_apple) return { name: entry.short_name, url: IMAGE_BASE + entry.image };
  return {
    // Wrapped in colons by the caller, so this yields `:+1::skin-tone-2:`.
    name: `${entry.short_name}::skin-tone-${SUFFIX_BY_KEY.get(key)}`,
    url: IMAGE_BASE + variation.image,
  };
}
