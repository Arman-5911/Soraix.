import test from "node:test";
import assert from "node:assert/strict";
import {
  matchingEnglishFile,
  externalSubtitles,
} from "../server/subtitles.mjs";

const file = (name, extra = {}) => ({
  name,
  size: 150,
  url: "https://jimaku.cc/subtitle/test.srt",
  ...extra,
});
test("external captions require explicit English, episode, supported format and trusted host", () => {
  assert.equal(matchingEnglishFile(file("Anime - 01 English.srt"), 1), true);
  assert.equal(matchingEnglishFile(file("Anime EP02.en.vtt"), 2), true);
  for (const f of [
    file("Anime - 02 English.srt"),
    file("Anime - 01 Japanese.srt"),
    file("Anime 1080 English.srt"),
    file("Anime - 01-02 English.srt"),
    file("Anime - 01 English.zip"),
    file("Anime - 01 English.srt", { url: "https://evil.example/a.srt" }),
  ]) {
    assert.equal(matchingEnglishFile(f, 1), false, f.name);
  }
});
test("external search matches AniList ID and downloads without leaking API credentials", async () => {
  const old = process.env.JIMAKU_API_KEY,
    original = globalThis.fetch;
  process.env.JIMAKU_API_KEY = "test-only";
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url, options]);
    if (url.includes("entries/search"))
      return Response.json([{ id: 8, anilist_id: 101922 }]);
    if (url.includes("/files"))
      return Response.json([file("Anime - 01 English.srt")]);
    return new Response("1\n00:00:01,000 --> 00:00:02,000\nHello\n");
  };
  try {
    const result = await externalSubtitles("al101922", 1);
    assert.equal(result.status, "found");
    assert.match(result.captions[0].vtt, /^WEBVTT/);
    assert.equal(calls[0][1].headers.Authorization, "test-only");
    assert.equal(calls[2][1].headers, undefined);
    delete process.env.JIMAKU_API_KEY;
    assert.equal(
      (await externalSubtitles("al101922", 1)).status,
      "not_configured",
    );
  } finally {
    globalThis.fetch = original;
    if (old === undefined) delete process.env.JIMAKU_API_KEY;
    else process.env.JIMAKU_API_KEY = old;
  }
});
