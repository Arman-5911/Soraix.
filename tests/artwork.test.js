import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { artworkRequest, optimizedArtwork } from "../server/artwork.mjs";
const url = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/test.png";
test("artwork accepts only known CDN paths and bounded output widths", () => {
  assert.equal(artworkRequest(url, 320).hostname, "s4.anilist.co");
  for (const input of ["http://127.0.0.1/a.png", url + "?redirect=x", url.replace("s4.anilist.co", "s4.anilist.co.evil.test"), url.replace("/anime/", "/private/"), url.replace("https://", "https://user:password@")]) assert.throws(() => artworkRequest(input, 320));
  assert.throws(() => artworkRequest(url, 10000));
});
test("artwork converts actual image bytes and shares concurrent transforms", async () => {
  const original = globalThis.fetch;
  const input = await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#a38acb" } }).png().toBuffer();
  let calls = 0;
  globalThis.fetch = async (_, options) => { calls++; assert.equal(options.redirect, "error"); return new Response(input, { headers: { "content-type": "image/png" } }); };
  try {
    const [a,b] = await Promise.all([optimizedArtwork(url,320), optimizedArtwork(url,320)]);
    assert.equal(calls,1); assert.deepEqual(a,b);
    const metadata = await sharp(a).metadata();
    assert.equal(metadata.format,"webp"); assert.equal(metadata.width,320); assert.equal(metadata.height,400);
  } finally { globalThis.fetch = original; }
});
