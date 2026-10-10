import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSubBackup } from "../server/sub-backup.mjs";
import { resolveMedia } from "../server/api.mjs";

const episode = (number, extra = {}) => ({
  number,
  available: { sub: true, subHard: true },
  embed: { sub: `https://ani.pm/embed/ani/101922/${number}/sub` },
  ...extra,
});
const title = (rows) => ({
  malId: 38000,
  anilistId: 101922,
  episodeList: rows,
});
test("English backup resolves when the original dub provider has no episode", async () => {
  const originalFetch = globalThis.fetch;
  const previous = process.env.HINDI_PROVIDER;
  process.env.HINDI_PROVIDER = "none";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        data: title([
          episode(1, {
            available: { sub: true, dub: true },
            embed: {
              sub: "https://ani.pm/embed/ani/101922/1/sub",
              dub: "https://ani.pm/embed/ani/101922/1/dub",
            },
          }),
        ]),
      }),
      { status: 200 },
    );
  try {
    const result = await resolveMedia("38000", 1, "dub");
    assert.equal(result.media.audio, "dub");
    assert.equal(result.media.servers.length, 1);
    assert.match(result.media.servers[0].url, /\/1\/dub\?/);
    assert.deepEqual(result.media.sources, []);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.HINDI_PROVIDER;
    else process.env.HINDI_PROVIDER = previous;
  }
});
test("English backup uses only verified dub availability and exact dub paths", () => {
  const result = normalizeSubBackup(
    title([
      episode(1, {
        available: { dub: true },
        embed: { dub: "https://ani.pm/embed/ani/101922/1/dub" },
      }),
      episode(2, {
        available: { dub: true },
        embed: { dub: "https://ani.pm/embed/ani/101922/2/sub" },
      }),
      episode(3),
    ]),
    "38000",
    "dub",
  );
  assert.deepEqual(
    result.episodes.map((e) => e.number),
    [1],
  );
  assert.deepEqual(result.episodes[0].availableLanguages, ["dub"]);
  assert.match(result.episodes[0].backupServers[0].name, /English DUB/);
  assert.match(result.episodes[0].backupServers[0].url, /\/1\/dub\?/);
});
test("SUB backups require exact title and episode and expose only available variants", () => {
  const result = normalizeSubBackup(
    title([
      episode(2),
      episode(1),
      episode(1),
      episode(3, { available: { dub: true } }),
    ]),
    "38000",
  );
  assert.deepEqual(
    result.episodes.map((e) => e.number),
    [1, 2],
  );
  assert.equal(result.episodes[0].backupServers.length, 2);
  assert.match(result.episodes[0].backupServers[1].url, /hardsub=1/);
  assert.throws(
    () => normalizeSubBackup(title([]), "38001"),
    /different title/,
  );
  assert.equal(
    normalizeSubBackup(title([episode(1)]), "al101922").episodes.length,
    1,
  );
});
test("SUB backups reject foreign URLs and mismatched episode paths", () => {
  const rows = [
    episode(1, {
      embed: { sub: "https://example.com/embed/ani/101922/1/sub" },
    }),
    episode(2, { embed: { sub: "https://ani.pm/embed/ani/101922/3/sub" } }),
    episode(4, { available: { sub: true } }),
  ];
  const result = normalizeSubBackup(title(rows), "38000");
  assert.deepEqual(
    result.episodes.map((e) => e.number),
    [4],
  );
  assert.equal(result.episodes[0].backupServers.length, 1);
});
