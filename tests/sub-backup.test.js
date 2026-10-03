import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSubBackup } from "../server/sub-backup.mjs";

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
