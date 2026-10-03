import test from "node:test";
import assert from "node:assert/strict";
import {
  extractVidmoly,
  hindiLibrary,
  resolveHindi,
  extractDubServers,
} from "../server/hindi.mjs";

test("dub servers retain published options but reject unrelated and unsafe hosts", () => {
  const option = (url) =>
    `<button data-embed-id="dub:${Buffer.from(url).toString("base64")}">Server</button>`;
  const urls = [
    "https://filesforever.link/embed/a",
    "https://desidubanime.p2pplay.pro/#a",
    "https://player.abyssplayer.com/a",
    "https://vidmoly.org/embed-a.html",
  ];
  assert.deepEqual(
    extractDubServers(
      urls.map(option).join("") +
        option("https://evil.test/embed/a") +
        option("https://user:pass@vidmoly.org/embed-a.html"),
    ).map((s) => s.url),
    urls,
  );
});

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
    await assert.rejects(() => resolveHindi(52991, 1), /not available/);
  } finally {
    if (old === undefined) delete process.env.HINDI_PROVIDER;
    else process.env.HINDI_PROVIDER = old;
  }
});

test("dub server discovery handles iframe payloads and current Abyss host", () => {
  const option = (name, value) =>
    `<span data-embed-id="dub:${Buffer.from(value).toString("base64")}">${name}</span>`;
  const html =
    option(
      "Streamp2p",
      "<iframe src='https://desidubanime.p2pplay.pro/#episode'></iframe>",
    ) +
    option("Abyss", "https://play.abyssplayer.com/episode") +
    option("English backup", "https://vidmoly.org/embed-english.html") +
    option(
      "Unsafe",
      "<iframe src='https://play.abyssplayer.com.evil.test/a'></iframe>",
    );
  assert.deepEqual(
    extractDubServers(html).map((s) => s.name),
    ["Streamp2p", "Abyss"],
  );
  assert.deepEqual(
    extractDubServers(html, "dub").map((s) => s.name),
    ["English backup"],
  );
});

test("generic dub server labels are usable only with English-only title evidence", () => {
  const url = "https://filesforever.link/embed/english";
  const html = `<span data-embed-id="dub:${Buffer.from(url).toString("base64")}">Mirror</span>`;
  assert.equal(extractDubServers(html, "dub").length, 0);
  assert.equal(extractDubServers(html, "dub", true)[0].url, url);
});
