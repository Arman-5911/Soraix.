import test from "node:test";
import assert from "node:assert/strict";
import {
  matchTitle,
  normalizeEpisodes,
  normalizeStream,
  directLibrary,
  resolveEpisode,
} from "../server/streaming.mjs";
import {
  apiHandler,
  availableMedia,
  resolveMedia,
  mergeAudioLibraries,
} from "../server/api.mjs";
import { mkdtemp, writeFile, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

test("dub sources merge by episode without claiming dub for all episodes", () => {
  const result = mergeAudioLibraries(
    {
      episodes: [
        { number: 1, availableLanguages: ["sub"] },
        { number: 2, availableLanguages: ["sub"] },
      ],
    },
    {
      episodes: [
        { number: 1, provider: "audio", availableLanguages: ["dub"] },
        { number: 3, provider: "audio", availableLanguages: ["dub"] },
      ],
    },
  );
  assert.deepEqual(
    result.episodes.map((e) => e.availableLanguages),
    [["sub", "dub"], ["sub"], ["dub"]],
  );
});
test("configured dubbed streams resolve separately from sub and retain correct captions", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "soraix-dub-"));
  const oldPath = process.env.VIDEO_LIBRARY_PATH,
    oldProvider = process.env.STREAMING_PROVIDER,
    oldHindiProvider = process.env.HINDI_PROVIDER;
  try {
    const file = path.join(dir, "library.json");
    await writeFile(
      file,
      JSON.stringify({
        52991: {
          episodes: [
            {
              number: 1,
              sources: [
                {
                  url: "https://cdn.example/ja.m3u8",
                  audio: "sub",
                  language: "Japanese",
                },
                {
                  url: "https://cdn.example/en.m3u8",
                  audio: "dub",
                  language: "English",
                },
                {
                  url: "https://cdn.example/en-720.mp4",
                  audio: "dub",
                  quality: "720p",
                  language: "English",
                },
              ],
              captions: [
                { url: "https://cdn.example/sub.vtt", audio: "sub" },
                { url: "https://cdn.example/dub.vtt", audio: "dub" },
              ],
            },
          ],
        },
      }),
    );
    process.env.VIDEO_LIBRARY_PATH = file;
    process.env.STREAMING_PROVIDER = "none";
    process.env.HINDI_PROVIDER = "none";
    const library = await availableMedia(52991);
    assert.deepEqual(library.episodes[0].availableLanguages, ["sub", "dub"]);
    const dub = await resolveMedia(52991, 1, "dub");
    assert.equal(dub.media.audio, "dub");
    assert.equal(dub.media.sources.length, 2);
    assert.ok(dub.media.sources.every((s) => s.audio === "dub"));
    assert.equal(dub.media.captions[0].url, "https://cdn.example/dub.vtt");
    const sub = await resolveMedia(52991, 1, "sub");
    assert.equal(sub.media.sources[0].url, "https://cdn.example/ja.m3u8");
    await assert.rejects(resolveMedia(52991, 2, "dub"), /not available/);
    await assert.rejects(resolveMedia(52991, 1, "invalid"), /Invalid audio/);
  } finally {
    if (oldPath === undefined) delete process.env.VIDEO_LIBRARY_PATH;
    else process.env.VIDEO_LIBRARY_PATH = oldPath;
    if (oldProvider === undefined) delete process.env.STREAMING_PROVIDER;
    else process.env.STREAMING_PROVIDER = oldProvider;
    if (oldHindiProvider === undefined) delete process.env.HINDI_PROVIDER;
    else process.env.HINDI_PROVIDER = oldHindiProvider;
    await rm(path.join(dir, "library.json"));
    await rmdir(dir);
  }
});

const anime = {
  id: 1234567,
  title: {
    english: "Frieren: Beyond Journey's End",
    romaji: "Sousou no Frieren",
  },
  year: 2023,
};
const main = {
  _id: "main-series",
  title: "Sousou no Frieren",
  alternativeTitle: { english: "Frieren: Beyond Journey’s End" },
  animeSeason: { year: 2023 },
};
test("title matching excludes sequels, mini-series, remakes and ambiguous results", () => {
  const sequel = {
    ...main,
    _id: "sequel",
    title: "Sousou no Frieren 2nd Season",
    alternativeTitle: { english: "Frieren: Beyond Journey's End Season 2" },
    animeSeason: { year: 2026 },
  };
  const mini = {
    ...main,
    title: "Sousou no Frieren Mini Anime",
    alternativeTitle: {},
  };
  assert.equal(matchTitle(anime, [sequel, mini, main]), main);
  assert.equal(matchTitle(anime, [sequel, mini]), null);
  assert.equal(matchTitle(anime, [main, { ...main, _id: "duplicate" }]), null);
  assert.equal(
    matchTitle(anime, [{ ...main, animeSeason: { year: 2003 } }]),
    null,
  );
});
test("episode lists preserve provider gaps and decimals, reject unsafe ids and never invent dub", () => {
  const result = normalizeEpisodes(
    [
      { uid: "ep3", number: 3 },
      { uid: "special", number: 1.5 },
      { uid: "ep1", number: 1 },
      { uid: "dupe", number: 1 },
      { uid: "../bad", number: 2 },
      { uid: "invalid", number: "NaN" },
    ],
    "show",
  );
  assert.deepEqual(
    result.map((e) => e.number),
    [1, 1.5, 3],
  );
  assert.ok(
    result.every(
      (e) => e.provider === "direct" && e.availableLanguages.join() === "sub",
    ),
  );
  assert.throws(() => normalizeEpisodes({}, "show"), /invalid episode list/);
});
test("stream normalization uses the fixed CDN and supported caption URLs", () => {
  const stream = normalizeStream({
    streamLink: "token&x=1",
    subData: [
      {
        src: "https://stream.animeparadise.moe/captions?url=123",
        label: "English",
        type: "vtt",
      },
      { src: "javascript:alert(1)", label: "Bad" },
      { src: "https://attacker.example/track", label: "Bad" },
      { src: "drive-file-id", label: "English", type: "ass" },
    ],
  });
  assert.equal(
    stream.sources[0].url,
    "https://stream.animeparadise.moe/m3u8?url=token%26x%3D1",
  );
  assert.equal(stream.sources[0].type, "hls");
  assert.equal(stream.captions.length, 1);
  assert.equal(stream.captions[0].language, "en");
  assert.throws(() => normalizeStream({}), /No playable video/);
});
test("provider integration deduplicates episode lookup, refreshes streams and rejects absent episodes/audio", async () => {
  const original = global.fetch;
  const calls = [];
  let resolved = 0;
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("/search?"))
      return Response.json({ success: true, data: [main] });
    if (String(url).includes("/anime/main-series/episode"))
      return Response.json({
        success: true,
        data: [{ number: 1, uid: "episode-one", title: "The Journey's End" }],
      });
    if (String(url).includes("/ep/episode-one?"))
      return Response.json({
        success: true,
        data: { episode: { streamLink: "fresh-" + ++resolved, subData: [] } },
      });
    throw new Error("Unexpected network request");
  };
  try {
    const [one, two] = await Promise.all([
      directLibrary(anime.id, anime),
      directLibrary(anime.id, anime),
    ]);
    assert.deepEqual(one, two);
    assert.equal(calls.length, 2);
    const s1 = await resolveEpisode(anime.id, 1, "sub"),
      s2 = await resolveEpisode(anime.id, 1, "sub");
    assert.notEqual(s1.media.sources[0].url, s2.media.sources[0].url);
    await assert.rejects(resolveEpisode(anime.id, 2, "sub"), /not available/);
    await assert.rejects(resolveEpisode(anime.id, 1, "dub"), /audio version/);
    await assert.rejects(
      resolveEpisode(anime.id, 1, "invalid"),
      /Invalid audio/,
    );
    assert.equal(resolved, 2);
  } finally {
    global.fetch = original;
  }
});
test("provider errors are surfaced, not cached as empty playable libraries", async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => new Response("Rate limited", { status: 429 });
    await assert.rejects(
      directLibrary(1234568, { ...anime, id: 1234568 }),
      (e) => e.status === 429,
    );
    global.fetch = async () => Response.json({ success: true, data: [] });
    const retry = await directLibrary(1234568, { ...anime, id: 1234568 });
    assert.deepEqual(retry.episodes, []);
  } finally {
    global.fetch = original;
  }
});
test("stream API rejects invalid audio before contacting any upstream", async () => {
  const res = {
    statusCode: 200,
    setHeader() {},
    end(body) {
      this.body = JSON.parse(body);
    },
  };
  await apiHandler(
    { method: "GET", url: "/api/stream/52991/1?language=invalid" },
    res,
  );
  assert.equal(res.statusCode, 400);
});
