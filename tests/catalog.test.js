import test from "node:test";
import assert from "node:assert/strict";
import {
  normalize,
  browseVariables,
  parseAnimeId,
  safeUrl,
  graphql,
} from "../server/anilist.mjs";
import { mediaLibrary, apiHandler } from "../server/api.mjs";
import { mkdtemp, writeFile, rm, rmdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("normalization preserves unknown episode and language counts", () => {
  const a = normalize({
    id: 42,
    title: { romaji: "New Story" },
    format: "TV",
    startDate: { year: 2027 },
    status: "NOT_YET_RELEASED",
  });
  assert.equal(a.id, "al42");
  assert.equal(a.totalEpisodes, null);
  assert.equal(a.subEpisodes, null);
  assert.equal(a.dubEpisodes, null);
  assert.deepEqual(a.streamingEpisodes, []);
  assert.equal(a.status, "Upcoming");
  assert.equal(a.poster, "/fallback.svg");
});
test("provider episodes are real supplied links, not generated episode placeholders", () => {
  const a = normalize({
    id: 3,
    idMal: 52991,
    title: { english: "Frieren" },
    episodes: 28,
    streamingEpisodes: [
      {
        title: "Episode 12 - A Real Hero",
        site: "Crunchyroll",
        url: "http://www.crunchyroll.com/watch/real",
      },
      { title: "Bad", url: "javascript:alert(1)" },
    ],
    externalLinks: [
      {
        type: "STREAMING",
        site: "Netflix",
        url: "https://netflix.com/title/123",
      },
      { type: "INFO", site: "Wiki", url: "https://example.com" },
    ],
  });
  assert.equal(a.streamingEpisodes.length, 1);
  assert.equal(a.streamingEpisodes[0].number, 12);
  assert.equal(
    a.streamingEpisodes[0].url,
    "https://www.crunchyroll.com/watch/real",
  );
  assert.equal(a.externalLinks.length, 1);
});
test("safe media URLs reject executable schemes and credentials", () => {
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("data:text/html,test"), null);
  assert.equal(safeUrl("https://user:secret@example.com/video.mp4"), null);
  assert.equal(
    safeUrl("http://example.com/video.mp4"),
    "https://example.com/video.mp4",
  );
});
test("combined remote filters map to validated provider enums and score bounds", () => {
  const v = browseVariables(
    new URLSearchParams({
      type: "Movie",
      status: "Finished",
      season: "Winter",
      year: "2024",
      rating: "8",
      genres: "Action,Fantasy",
      sort: "Score",
      page: "2",
    }),
  );
  assert.equal(v.format, "MOVIE");
  assert.equal(v.status, "FINISHED");
  assert.equal(v.season, "WINTER");
  assert.equal(v.year, 2024);
  assert.equal(v.minScore, 79);
  assert.equal(v.page, 2);
  assert.deepEqual(v.genres, ["Action", "Fantasy"]);
  assert.deepEqual(v.sort, ["SCORE_DESC"]);
});
test("invalid identifiers and unsupported genres do not reach the provider", () => {
  assert.deepEqual(parseAnimeId("frieren-52991"), { mal: 52991 });
  assert.deepEqual(parseAnimeId("new-show-al42"), { id: 42 });
  assert.throws(() => parseAnimeId("anything"), /Invalid/);
  assert.throws(() => parseAnimeId("99999999999"), /Invalid/);
  assert.throws(
    () => browseVariables(new URLSearchParams({ genres: "fakegenre" })),
    /supported/,
  );
  const v = browseVariables(
    new URLSearchParams({
      type: "INVALID",
      status: "BAD",
      year: "NaN",
      rating: "90",
      page: "-1",
    }),
  );
  assert.equal(v.page, 1);
  assert.equal(v.format, undefined);
  assert.equal(v.minScore, undefined);
});
test("provider cache deduplicates concurrent requests", async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200,
    });
  };
  try {
    const values = await Promise.all([
      graphql("query CacheTest {}"),
      graphql("query CacheTest {}"),
    ]);
    assert.equal(calls, 1);
    assert.equal(values[0].ok, true);
    await graphql("query CacheTest {}");
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});
test("missing media configuration never supplies a sample video", async () => {
  const original = process.env.VIDEO_LIBRARY_PATH;
  delete process.env.VIDEO_LIBRARY_PATH;
  try {
    assert.deepEqual(await mediaLibrary(52991), {
      episodes: [],
      configured: false,
    });
  } finally {
    if (original) process.env.VIDEO_LIBRARY_PATH = original;
  }
});
test("configured library returns only valid per-episode sources", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "soraix-media-"));
  const file = path.join(dir, "library.json");
  const original = process.env.VIDEO_LIBRARY_PATH;
  try {
    await writeFile(
      file,
      JSON.stringify({
        52991: {
          episodes: [
            {
              number: 1,
              title: "First",
              sources: [
                { url: "https://cdn.example.com/one.mp4", quality: "1080p" },
              ],
            },
            { number: 2, sources: [{ url: "javascript:alert(1)" }] },
          ],
        },
      }),
    );
    process.env.VIDEO_LIBRARY_PATH = file;
    const result = await mediaLibrary(52991);
    assert.equal(result.episodes.length, 1);
    assert.equal(result.episodes[0].number, 1);
    assert.equal(result.episodes[0].sources[0].quality, "1080p");
    assert.deepEqual((await mediaLibrary(1)).episodes, []);
  } finally {
    if (original) process.env.VIDEO_LIBRARY_PATH = original;
    else delete process.env.VIDEO_LIBRARY_PATH;
    await rm(file);
    await rmdir(dir);
  }
});
test("API rejects unsupported methods and routes with JSON errors", async () => {
  const make = () => ({
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    writeHead(n) {
      this.statusCode = n;
    },
    end(s) {
      this.body = s;
    },
  });
  const post = make();
  await apiHandler({ url: "/api/home", method: "POST" }, post);
  assert.equal(post.statusCode, 405);
  const missing = make();
  await apiHandler({ url: "/api/does-not-exist", method: "GET" }, missing);
  assert.equal(missing.statusCode, 404);
  assert.ok(JSON.parse(missing.body).error);
});
