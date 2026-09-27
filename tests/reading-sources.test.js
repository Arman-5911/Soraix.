import test from "node:test";
import assert from "node:assert/strict";
import {
  matchingSeries,
  sourceChapters,
  alternativePages,
  readerImage,
  searchTitles,
} from "../server/reading-sources.mjs";
import { mergeChapterSources } from "../server/universe.mjs";

test("combined list fills chapter gaps and preserves alternative editions and specials", () => {
  const results = [
    {
      source: "mangadex",
      chapters: [
        { id: "a", number: "1" },
        { id: "c", number: "3" },
        { id: "special", number: null },
      ],
    },
    {
      source: "weebcentral",
      chapters: [
        { id: "b", number: "2" },
        { id: "alt", number: "3.0" },
        { id: "extra", number: "3.5" },
      ],
    },
  ];
  const merged = mergeChapterSources(results);
  assert.deepEqual(
    merged.map((c) => c.id),
    ["special", "a", "b", "c", "extra"],
  );
  assert.equal(merged.find((c) => c.id === "c").alternatives[0].id, "alt");
  assert.equal(merged.find((c) => c.id === "b").source, "weebcentral");
});
test("volume numbering resets are not collapsed into one chapter", () => {
  const merged = mergeChapterSources([
    {
      source: "mangadex",
      chapters: [
        { id: "v1", number: "1" },
        { id: "v2", number: "1" },
      ],
    },
    { source: "weebcentral", chapters: [{ id: "other", number: "1" }] },
  ]);
  assert.equal(merged.length, 3);
});
test("source lookup searches alternate titles with a bounded request count", () => {
  assert.deepEqual(
    searchTitles({
      title: { english: "Story", romaji: "Story" },
      synonyms: ["Another name"],
    }),
    ["Story", "Another name"],
  );
  assert.equal(
    searchTitles({
      title: {},
      synonyms: Array.from({ length: 20 }, (_, i) => String(i)),
    }).length,
    6,
  );
});

const a = "01J76XYXYZGGRVGEGATYQWFTD8";
const b = "01J76XZ666GREP4DQDKEP1YDZG";
test("chapter pages accept both observed provider CDNs and discard unrelated hosts", async () => {
  const original = global.fetch;
  global.fetch = async () =>
    new Response(
      '<img src="https://official.lowee.us/manga/story/1.png"><img src="https://hot.planeptune.us/manga/story/2.png"><img src="https://example.com/tracker.png"><img src="https://official.lowee.us:444/private">',
    );
  try {
    const result = await alternativePages(
      "wc_01J76XZ666GREP4DQDKEP1YDZ0",
      true,
    );
    assert.deepEqual(result.pages, [
      "https://official.lowee.us/manga/story/1.png",
      "https://hot.planeptune.us/manga/story/2.png",
    ]);
  } finally {
    global.fetch = original;
  }
});
test("alternate source matching rejects ambiguous titles, sequels and foreign hosts", () => {
  const item = { title: { english: "A Story" } };
  const link = (id, title, host = "https://weebcentral.com") =>
    `<a href="${host}/series/${id}/A-Story">${title}</a>`;
  assert.equal(matchingSeries(link(a, "A Story 2"), item, "weebcentral"), null);
  assert.equal(
    matchingSeries(
      link(a, "A Story", "https://example.com"),
      item,
      "weebcentral",
    ),
    null,
  );
  assert.equal(
    matchingSeries(
      link(a, "A Story") + link(b, "A Story"),
      item,
      "weebcentral",
    ),
    null,
  );
  assert.equal(
    matchingSeries(link(a, "A Story"), item, "weebcentral"),
    `https://weebcentral.com/series/${a}/A-Story`,
  );
});
test("full chapter parsing preserves gaps and decimals and rejects unrelated links", () => {
  const html = `<a href="/chapters/${a}">Chapter 10.5</a><a href="/chapters/${b}">Chapter 0</a><a href="/chapters/${a}">Chapter 10.5</a><a href="https://example.com/chapters/${b}">Chapter 3</a>`;
  assert.deepEqual(
    sourceChapters(html, "weebcentral").map((c) => [c.id, c.number]),
    [
      [`wc_${b}`, "0"],
      [`wc_${a}`, "10.5"],
    ],
  );
});
test("page delivery rejects arbitrary URLs and invalid indexes before fetching", async () => {
  await assert.rejects(
    () => alternativePages("https://example.com/image"),
    /Invalid chapter/,
  );
  await assert.rejects(
    () => readerImage(`wc_${a}`, -1),
    /Invalid chapter page/,
  );
});
