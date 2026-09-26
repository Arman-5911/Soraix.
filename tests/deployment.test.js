import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/index.js";
import { resolveMedia } from "../server/api.mjs";

async function request(url) {
  const res = {
    statusCode: 200,
    setHeader() {},
    end(body) {
      this.body = JSON.parse(body);
    },
  };
  await handler({ url, method: "GET" }, res);
  return res;
}
test("Vercel rewritten and original URLs both reach the API", async () => {
  for (const path of [
    "/api/health",
    "/api/index?route=health",
    "/api?route=health",
  ]) {
    const res = await request(path);
    assert.equal(res.body.ok, true);
  }
});
test("Vercel nested rewrite preserves audio query and JSON errors", async () => {
  const res = await request(
    "/api/index?route=stream%2F52991%2F1&language=invalid",
  );
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Invalid audio selection.");
});
test("cloud configured Hindi sources retain servers and isolate audio", async () => {
  const old = process.env.VIDEO_LIBRARY_JSON;
  process.env.VIDEO_LIBRARY_JSON = JSON.stringify({
    52991: {
      episodes: [
        {
          number: 1,
          sources: [
            {
              url: "https://media.example/hi.m3u8",
              audio: "hi",
              server: "Hindi primary",
            },
            {
              url: "https://media.example/backup.m3u8",
              audio: "hi",
              server: "Hindi backup",
            },
            { url: "https://media.example/en.m3u8", audio: "dub" },
          ],
        },
      ],
    },
  });
  try {
    const result = await resolveMedia("52991", 1, "hi");
    assert.equal(result.media.sources.length, 2);
    assert.deepEqual(
      result.media.sources.map((s) => s.server),
      ["Hindi primary", "Hindi backup"],
    );
    assert.ok(result.media.sources.every((s) => s.audio === "hi"));
  } finally {
    if (old === undefined) delete process.env.VIDEO_LIBRARY_JSON;
    else process.env.VIDEO_LIBRARY_JSON = old;
  }
});
