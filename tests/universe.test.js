import test from "node:test";
import assert from "node:assert/strict";
import {
  contentMode,
  matchBook,
  universe,
  chapterPages,
  readableChapters,
  sourceBook,
  chapters,
} from "../server/universe.mjs";

test("source-native books do not require an AniList mapping and fetch every chapter feed page", async () => {
  const original = global.fetch;
  const uuid = "11111111-1111-4111-8111-111111111111";
  const book = {
    id: uuid,
    attributes: {
      title: { en: "Unmapped story" },
      originalLanguage: "ko",
      description: { en: "Story" },
      tags: [],
    },
    relationships: [],
  };
  assert.equal(sourceBook(book).anilistId, `md-${uuid}`);
  assert.equal(sourceBook(book).mode, "manhwa");
  const offsets = [];
  global.fetch = async (value) => {
    const url = new URL(value);
    assert.equal(url.hostname, "api.mangadex.org");
    if (!url.pathname.endsWith("/feed"))
      return Response.json({ result: "ok", data: book });
    const offset = Number(url.searchParams.get("offset"));
    offsets.push(offset);
    const count = offset === 0 ? 500 : 1;
    return Response.json({
      result: "ok",
      total: 501,
      data: Array.from({ length: count }, (_, i) => ({
        id: `chapter-${offset + i}`,
        attributes: {
          chapter: String(offset + i + 1),
          pages: 10,
          externalUrl: null,
        },
      })),
    });
  };
  try {
    const result = await chapters(`md-${uuid}`, "en", undefined, "mangadex");
    assert.equal(result.chapters.length, 501);
    assert.deepEqual(offsets, [0, 500]);
  } finally {
    global.fetch = original;
  }
});

test("chapter lists exclude unavailable, external and empty uploads and deduplicate translations", () => {
  const row = (id, attributes = {}) => ({
    id,
    attributes: {
      volume: "1",
      chapter: "1",
      pages: 10,
      externalUrl: null,
      ...attributes,
    },
  });
  const result = readableChapters([
    row("a"),
    row("duplicate"),
    row("external", { chapter: "2", externalUrl: "https://example.com" }),
    row("unavailable", { chapter: "3", isUnavailable: true }),
    row("empty", { chapter: "4", pages: 0 }),
    row("next", { chapter: "5", title: "The journey" }),
  ]);
  assert.deepEqual(
    result.map((c) => c.id),
    ["a", "next"],
  );
  assert.equal(result[1].title, "Chapter 5 · The journey");
});
test("content modes distinguish format and country", () => {
  assert.equal(
    contentMode({ type: "ANIME", countryOfOrigin: "CN" }),
    "donghua",
  );
  assert.equal(contentMode({ type: "MANGA", countryOfOrigin: "KR" }), "manhwa");
  assert.equal(contentMode({ type: "MANGA", countryOfOrigin: "CN" }), "manhua");
  assert.equal(contentMode({ type: "MANGA", countryOfOrigin: "JP" }), "manga");
});
test("chapter matching rejects sequels, conflicting IDs and ambiguous titles", () => {
  const item = {
    anilistId: 10,
    title: { english: "A Story" },
    mode: "manga",
    year: 2020,
  };
  const book = {
    attributes: {
      title: { en: "A Story" },
      originalLanguage: "ja",
      year: 2020,
    },
  };
  assert.equal(matchBook(item, [book]), book);
  assert.equal(matchBook(item, [book, { ...book }]), null);
  assert.equal(
    matchBook(item, [
      { attributes: { ...book.attributes, links: { al: "11" } } },
    ]),
    null,
  );
  assert.equal(
    matchBook(item, [
      { attributes: { ...book.attributes, title: { en: "A Story 2" } } },
    ]),
    null,
  );
});
test("invalid content mode and chapter identifiers are rejected before upstream calls", async () => {
  await assert.rejects(
    () => universe(new URLSearchParams({ mode: "unknown" })),
    /Unknown content mode/,
  );
  await assert.rejects(
    () => chapterPages("../../private"),
    /Invalid chapter ID/,
  );
});
