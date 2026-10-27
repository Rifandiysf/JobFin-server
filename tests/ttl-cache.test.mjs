import assert from "node:assert/strict";
import { test } from "node:test";
import { createTtlCache } from "../src/utils/ttl-cache.mjs";

test("returns undefined after an entry expires", () => {
  let currentTime = 1000;
  const cache = createTtlCache({ maxEntries: 5, defaultTtlMs: 100, now: () => currentTime });

  cache.set("address", { lat: 1 });
  assert.deepEqual(cache.get("address"), { lat: 1 });

  currentTime += 101;
  assert.equal(cache.get("address"), undefined);
});

test("distinguishes a cached null from a cache miss", () => {
  const cache = createTtlCache({ maxEntries: 5, defaultTtlMs: 100 });

  cache.set("unknown address", null);

  assert.equal(cache.get("unknown address"), null);
  assert.equal(cache.get("never stored"), undefined);
});

test("evicts the least recently used entry when full", () => {
  const cache = createTtlCache({ maxEntries: 2, defaultTtlMs: 1000 });

  cache.set("first", 1);
  cache.set("second", 2);
  cache.get("first"); // "second" is now the least recently used entry
  cache.set("third", 3);

  assert.equal(cache.get("second"), undefined);
  assert.equal(cache.get("first"), 1);
  assert.equal(cache.get("third"), 3);
  assert.equal(cache.size, 2);
});
