import test from "node:test";
import assert from "node:assert/strict";
import { matchAtsumaru, atsuChapters, atsuPages } from "../server/atsumaru.mjs";
import { dubUrl } from "../server/dub-delivery.mjs";
test("matching prefers exact comic title over novels and sequel aliases", () => {
  const original = { id: "abc", title: "A Story", medium: "Comic", year: 2020 };
  assert.equal(
    matchAtsumaru({ title: { english: "A Story" }, year: 2020 }, [
      original,
      { ...original, id: "novel", medium: "Novel" },
      {
        ...original,
        id: "sequel",
        title: "A Story 2",
        otherNames: ["A Story"],
      },
    ]),
    original,
  );
  assert.equal(
    matchAtsumaru({ title: { english: "A Story" } }, [
      original,
      { ...original, id: "duplicate" },
    ]),
    null,
  );
});
test("chapter editions are retained without inflating the chapter list", () => {
  const list = atsuChapters("abc", [
    { id: "a", number: 1, pageCount: 20 },
    { id: "b", number: 1, pageCount: 21 },
    { id: "c", number: 2, pageCount: 0 },
    { id: "d", number: 3.5, pageCount: 20 },
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].alternatives[0].id, "at_abc_b");
  assert.equal(list[1].number, "3.5");
});
test("new observed video CDN is allowed but lookalike hosts are rejected", () => {
  assert.equal(
    dubUrl("https://prx-vi-a-1.vmpx.online/hls2/04/master.m3u8").hostname,
    "prx-vi-a-1.vmpx.online",
  );
  assert.throws(() =>
    dubUrl("https://prx-vi-a-1.vmpx.online.evil.test/hls2/04/master.m3u8"),
  );
});
test("malformed provider chapter IDs fail without network requests", async () => {
  await assert.rejects(() => atsuPages("at_../../private"), /Invalid chapter/);
});
