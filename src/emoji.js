const CACHE_MS = 10 * 60 * 1000;
const MIN_REFRESH_MS = 30 * 1000;

export const MAX_EMOJIS = 4;

// `:a: :b:`, `:a::b:`, `a, b` 를 모두 받는다. 피부색 수식자(`::skin-tone-2:`)는 버린다.
export function parseEmojiNames(text) {
  const names = text
    .split(/[\s,:]+/)
    .filter((part) => part && !/^skin-tone-\d$/.test(part))
    .map((part) => part.toLowerCase());
  return names.length ? names : null;
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
  let list = null;
  let nextRefreshAt = 0;
  let lastAttemptAt = 0;
  let pending = null;

  // 동시에 들어온 요청은 진행 중인 emoji.list 하나를 같이 기다린다.
  // 실패하면 이전 목록을 그대로 쓰고, MIN_REFRESH_MS 뒤에야 다시 시도한다.
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

  return async function lookup(name) {
    if (!list || Date.now() >= nextRefreshAt) {
      if (!list && Date.now() < nextRefreshAt) throw new Error('emoji.list 재시도 대기 중');
      await refresh();
    }
    let found = resolveEmoji(list, name);
    if (!found && Date.now() - lastAttemptAt > MIN_REFRESH_MS) {
      await refresh();
      found = resolveEmoji(list, name);
    }
    return found;
  };
}
