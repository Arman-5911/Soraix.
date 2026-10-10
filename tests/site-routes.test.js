import test from "node:test";
import assert from "node:assert/strict";
import { isSiteRoute } from "../server/site-routes.mjs";
import { pageDescription } from "../src/pageMetadata.js";

test("SPA routes preserve deep links without swallowing unknown paths", () => {
  for (const value of ["/", "/movies", "/genre/action", "/anime/one-piece-21", "/watch/one-piece-21", "/media/123", "/read/123/chapter-1", "/read-listen", "/terms/"]) assert.equal(isSiteRoute(value), true, value);
  for (const value of ["/missing-page", "/movies/missing", "/watch/a/b", "/read/123", "/api/missing", "/assets/missing.js"]) assert.equal(isSiteRoute(value), false, value);
});
test("genre and mode metadata are distinct rather than a shared description", () => {
  assert.notEqual(pageDescription("/genre/action"), pageDescription("/genre/comedy"));
  assert.match(pageDescription("/", "manhwa"), /manhwa/);
  assert.notEqual(pageDescription("/tv"), pageDescription("/movies"));
});
