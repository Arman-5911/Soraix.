import test from "node:test";
import assert from "node:assert/strict";
import {
  dubUrl,
  deliveryUrl,
  rewriteManifest,
  deliverDub,
} from "../server/dub-delivery.mjs";
test("delivery rejects arbitrary hosts, credentials, ports and paths", () => {
  for (const url of [
    "http://box.vmeas.cloud/hls2/a.ts",
    "https://vmeas.cloud.evil.test/hls2/a.ts",
    "https://127.0.0.1/hls2/a.ts",
    "https://box.vmeas.cloud:444/hls2/a.ts",
    "https://a:b@box.vmeas.cloud/hls2/a.ts",
    "https://box.vmeas.cloud/private",
  ])
    assert.throws(() => dubUrl(url));
});
test("rewrites audio, video, keys and relative segments through same-origin delivery", () => {
  const base = "https://box.vmeas.cloud/hls2/a/master.m3u8?t=signed";
  const manifest =
    '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,URI="audio.m3u8?t=1"\nvideo.m3u8?t=2\n#EXT-X-KEY:METHOD=AES-128,URI="key.key"\nseg-1.ts?t=3';
  const output = rewriteManifest(manifest, base);
  assert.ok(
    output.includes(
      deliveryUrl("https://box.vmeas.cloud/hls2/a/audio.m3u8?t=1"),
    ),
  );
  assert.equal((output.match(/\/api\/dub-media/g) || []).length, 4);
  assert.throws(() =>
    rewriteManifest("#EXTM3U\nhttps://evil.test/segment.ts", base),
  );
});
test("upstream denial remains an error and redirects are disabled", async () => {
  const original = global.fetch;
  global.fetch = async (url, opts) => {
    assert.equal(opts.redirect, "error");
    return new Response("denied", { status: 403 });
  };
  try {
    await assert.rejects(
      () =>
        deliverDub(
          Buffer.from("https://box.vmeas.cloud/hls2/a.ts").toString(
            "base64url",
          ),
        ),
      /rejected playback/,
    );
  } finally {
    global.fetch = original;
  }
});
