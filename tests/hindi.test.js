import test from "node:test";
import assert from "node:assert/strict";
import {
  extractVidmoly,
  hindiLibrary,
  resolveHindi,
} from "../server/hindi.mjs";

test("Hindi embed discovery only accepts the supported HTTPS host", () => {
  const embed = (url) =>
    `data-embed-id="name:${Buffer.from(url).toString("base64")}"`;
  assert.equal(
    extractVidmoly(embed("https://vidmoly.org/embed-abc123.html")),
    "https://vidmoly.org/embed-abc123.html",
  );
  assert.equal(
    extractVidmoly(embed("https://vidmoly.org.evil.test/embed-abc123.html")),
    null,
  );
  assert.equal(extractVidmoly(embed("javascript:alert(1)")), null);
});
test("Hindi discovery can be disabled without upstream requests", async () => {
  const old = process.env.HINDI_PROVIDER;
  process.env.HINDI_PROVIDER = "none";
  try {
    assert.deepEqual(await hindiLibrary(52991), { episodes: [] });
    await assert.rejects(() => resolveHindi(52991, 1), /unavailable/);
  } finally {
    if (old === undefined) delete process.env.HINDI_PROVIDER;
    else process.env.HINDI_PROVIDER = old;
  }
});
