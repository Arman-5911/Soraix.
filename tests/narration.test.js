import test from "node:test";
import assert from "node:assert/strict";
import { speechChunks, explainImage } from "../src/narration.js";
test("speech chunks preserve multilingual text and bound utterance length", () => {
  const text = "यह कहानी है। This is a story! " + "長".repeat(420);
  const parts = speechChunks(text);
  assert.ok(parts.every((p) => p.length <= 185));
  assert.equal(parts.join("").replace(/\s/g, ""), text.replace(/\s/g, ""));
  assert.deepEqual(speechChunks("   "), []);
});
test("AI explanation requires credentials before reading or sending a page", async () => {
  await assert.rejects(
    explainImage(new Blob(["image"]), { key: " ", language: "hi" }),
    /API key/,
  );
});
