import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://localhost:5173";
async function get(path) {
  const r = await fetch(base + "/api" + path, {
    signal: AbortSignal.timeout(45000),
  });
  const data = await r.json();
  assert.equal(r.status, 200, JSON.stringify(data));
  return data;
}
const home = await get("/home");
assert.ok(home.trending.length > 0);
assert.ok(home.fetchedAt);
console.log("PASS: live home with", home.trending.length, "trending titles");
const search = await get("/catalog?q=Cowboy%20Bebop");
assert.ok(search.items.some((a) => a.title.english.includes("Cowboy Bebop")));
console.log("PASS: full-catalogue search");
const movies = await get("/catalog?type=Movie&sort=Score&page=2");
assert.equal(movies.pageInfo.currentPage, 2);
assert.ok(movies.items.every((a) => a.type === "Movie"));
console.log("PASS: server-side filtering and pagination");
const detail = await get("/anime/52991");
assert.equal(detail.anime.id, 52991);
assert.ok(
  detail.anime.streamingEpisodes.some(
    (e) => e.site === "Crunchyroll" && e.number === 1,
  ),
);
assert.ok(detail.anime.externalLinks.length);
console.log(
  "PASS: live details and official episode links:",
  detail.anime.streamingEpisodes.length,
);
const start = new Date();
start.setHours(0, 0, 0, 0);
const end = new Date(start);
end.setDate(end.getDate() + 1);
const schedule = await get(
  `/schedule?from=${Math.floor(+start / 1000)}&to=${Math.floor(+end / 1000)}`,
);
assert.ok(
  schedule.items.every(
    (x) => x.airingAt * 1000 >= +start && x.airingAt * 1000 < +end,
  ),
);
console.log("PASS: timestamp-based airing schedule:", schedule.items.length);
const media = await get("/media/52991");
assert.ok(Array.isArray(media.episodes));
assert.ok(!JSON.stringify(media).includes("bunny"));
console.log("PASS: no sample-video fallback");
assert.equal(media.episodes.length, 28);
assert.equal(media.episodes[0].provider, "direct");
const stream = await get("/stream/52991/1?language=sub");
assert.equal(stream.media.sources[0].type, "hls");
assert.ok(stream.media.captions.some((c) => c.language === "en"));
const manifest = await fetch(stream.media.sources[0].url, {
  signal: AbortSignal.timeout(15000),
});
assert.equal(manifest.status, 200);
assert.ok((await manifest.text()).startsWith("#EXTM3U"));
console.log("PASS: fresh direct HLS manifest and English subtitles");
const unavailable = await fetch(base + "/api/stream/52991/1?language=dub");
assert.equal(unavailable.status, 404);
console.log("PASS: unavailable audio is not silently substituted");
const watchable = await get("/watchable");
assert.ok(
  watchable.items.some((a) => a.id === 52991 && a.playableEpisodes === 28),
);
console.log(
  "PASS: featured titles have actual episode lists:",
  watchable.items.length,
);
console.log("All live integration checks passed.");
