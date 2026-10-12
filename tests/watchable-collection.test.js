import test from "node:test";
import assert from "node:assert/strict";
import { collectWatchable } from "../server/watchable-collection.mjs";

test("watchable checks keep catalogue order while checking several providers concurrently", async () => {
  let active = 0, peak = 0;
  const titles = Array.from({ length: 12 }, (_, id) => ({ id }));
  const result = await collectWatchable(titles, async title => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, (12 - title.id) * 2));
    active--;
    return title.id % 3 ? title : null;
  }, { concurrency: 4, budgetMs: 500 });
  assert.equal(peak, 4);
  assert.deepEqual(result.items.map(item => item.id), [1, 2, 4, 5, 7, 8, 10, 11]);
  assert.equal(result.partial, false);
});

test("watchable checks stop waiting for slow providers and report partial results", async () => {
  const started = performance.now();
  const result = await collectWatchable([1, 2], async id => {
    if (id === 2) await new Promise(() => {});
    await new Promise(resolve => setTimeout(resolve, 3));
    return { id };
  }, { concurrency: 2, budgetMs: 25 });
  assert.deepEqual(result.items, [{ id: 1 }]);
  assert.equal(result.partial, true);
  assert.ok(performance.now() - started < 500);
});
