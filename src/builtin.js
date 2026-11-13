import data from 'emoji-datasource/emoji.json' with { type: 'json' };
import pkg from 'emoji-datasource/package.json' with { type: 'json' };

// Slack's own short names come from this dataset. The npm package only ships 64px images,
// so the 160px Apple set is served from the matching tag of the dataset's repository.
// The dependency is pinned to an exact version because that tag has to exist.
const IMAGE_BASE = `https://cdn.jsdelivr.net/gh/iamcal/emoji-data@v${pkg.version}/img-apple-160/`;
const SKIN_TONES = { 2: '1F3FB', 3: '1F3FC', 4: '1F3FD', 5: '1F3FE', 6: '1F3FF' };
// Some emoji of two people (people_holding_hands) key one tone for both as `1F3FC-1F3FC`.
const toneKeys = (code) => [code, `${code}-${code}`];
const TONE_BY_MODIFIER = Object.fromEntries(
  Object.entries(SKIN_TONES).flatMap(([tone, code]) => toneKeys(code).map((key) => [key, Number(tone)])),
);

const byName = new Map();
const byUnified = new Map();
for (const entry of data) {
  if (!entry.has_img_apple) continue;
  for (const name of entry.short_names) byName.set(name, entry);
  for (const code of [entry.unified, entry.non_qualified]) {
    if (code) byUnified.set(code, { entry, tone: null });
  }
  for (const [modifier, variation] of Object.entries(entry.skin_variations ?? {})) {
    // Mixed-tone variations (`1F3FB-1F3FC`) have no single `:skin-tone-N:` and keep tone null.
    const found = { entry, tone: TONE_BY_MODIFIER[modifier] ?? null, variation };
    for (const code of [variation.unified, variation.non_qualified]) {
      if (code) byUnified.set(code, found);
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
// `skinTone` is the N of `:skin-tone-N:` and is ignored for emoji that have no such variation.
// A character that already carries a skin tone keeps it.
export function resolveBuiltinEmoji(name, skinTone = null) {
  let entry = byName.get(name);
  let tone = skinTone;
  let variation;
  if (!entry) {
    const found = fromCharacters(name);
    if (!found) return null;
    ({ entry, variation } = found);
    if (variation) tone = found.tone;
  }
  if (!variation && SKIN_TONES[tone] && entry.skin_variations) {
    variation = toneKeys(SKIN_TONES[tone]).map((key) => entry.skin_variations[key]).find(Boolean);
  }
  if (!variation?.has_img_apple) variation = null;
  return {
    // Wrapped in colons by the caller, so this yields `:+1::skin-tone-2:`.
    name: variation && tone ? `${entry.short_name}::skin-tone-${tone}` : entry.short_name,
    url: IMAGE_BASE + (variation ?? entry).image,
  };
}
