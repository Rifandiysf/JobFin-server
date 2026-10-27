function createTtlCache({ maxEntries, defaultTtlMs, now = Date.now }) {
  const entries = new Map();

  function get(key) {
    const entry = entries.get(key);

    if (!entry) return undefined;

    if (entry.expiresAt <= now()) {
      entries.delete(key);
      return undefined;
    }

    entries.delete(key);
    entries.set(key, entry);

    return entry.value;
  }

  function set(key, value, ttlMs = defaultTtlMs) {
    entries.delete(key);
    entries.set(key, { value, expiresAt: now() + ttlMs });

    while (entries.size > maxEntries) {
      const leastRecentlyUsedKey = entries.keys().next().value;
      entries.delete(leastRecentlyUsedKey);
    }
  }

  function clear() {
    entries.clear();
  }

  return {
    get,
    set,
    clear,
    get size() {
      return entries.size;
    },
  };
}

export { createTtlCache };
