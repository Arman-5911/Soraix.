import test from "node:test";
import assert from "node:assert/strict";
import {
  searchCandidates,
  titleMatches,
  parseHindiEpisodes,
  discoverHindi,
} from "../server/hindi-discovery.mjs";

const anime = {
  title: {
    english: "Frieren: Beyond Journey's End",
    romaji: "Sousou no Frieren",
  },
  year: 2023,
};
test("Hindi matching excludes sequels and requires the correct year and Hindi tag", () => {
  const card = (slug, title) =>
    `<a href="https://www.desidubanime.me/anime/${slug}/" title="${title}"></a>`;
  assert.deepEqual(
    searchCandidates(
      card("frieren", "Sousou no Frieren") +
        card("frieren-2", "Sousou no Frieren 2nd Season"),
      anime,
    ),
    ["https://www.desidubanime.me/anime/frieren/"],
  );
  const html =
    '<h1><span>Frieren: Beyond Journey&#039;s End</span></h1><a href="/premiered/2023/">2023</a><meta property="article:tag" content="Hindi">';
  assert.equal(titleMatches(html, anime), true);
  assert.equal(titleMatches(html.replaceAll("2023", "2024"), anime), false);
  assert.equal(
    titleMatches(html.replace('content="Hindi"', 'content="Japanese"'), anime),
    false,
  );
});
test("episode discovery retains actual URLs and gaps, excludes unrelated links and unsafe hosts", () => {
  const row = (n, url) =>
    `<a class="episode-list-item" href="${url}"><span class="episode-list-item-number">${n}</span><span class="episode-list-item-title">A &amp; B</span></a>`;
  const episodes = parseHindiEpisodes(
    row(3, "/watch/real-episode-3/") +
      row(1, "/watch/real-episode-1/") +
      row(1, "/watch/real-episode-1/") +
      row(2, "https://evil.test/watch/real-episode-2/") +
      '<a href="/watch/unrelated/">4</a>',
  );
  assert.deepEqual(
    episodes.map((e) => e.number),
    [1, 3],
  );
  assert.equal(episodes[0].title, "A & B");
  assert.equal(
    episodes[0].hindiPage,
    "https://www.desidubanime.me/watch/real-episode-1/",
  );
});
test("new titles are automatically discovered with deduplicated requests and no invented episode URLs", async () => {
  const original = global.fetch;
  const requests = [];
  global.fetch = async (url) => {
    requests.push(String(url));
    let html;
    if (String(url).includes("admin-ajax"))
      html = JSON.stringify({
        success: true,
        data: {
          html: '<a href="https://www.desidubanime.me/anime/test-world/" title="Test World"></a>',
        },
      });
    else if (String(url).includes("/anime/"))
      html =
        '<h1><span>Test World</span></h1><meta property="article:tag" content="Hindi"><a href="/watch/special-first/">Watch</a>';
    else if (String(url).includes("/watch/"))
      html =
        '<a class="episode-list-item" href="/watch/special-first/"><span class="episode-list-item-number">1</span></a>';
    else html = '{"search_actions":"abc123"}';
    return new Response(html);
  };
  try {
    const metadata = {
      title: { english: "Test World", romaji: "Test World" },
      year: 2024,
    };
    const [a, b] = await Promise.all([
      discoverHindi("test-new", metadata),
      discoverHindi("test-new", metadata),
    ]);
    assert.equal(a.episodes.length, 1);
    assert.equal(
      a.episodes[0].hindiPage,
      "https://www.desidubanime.me/watch/special-first/",
    );
    assert.deepEqual(a, b);
    assert.equal(requests.length, 4);
  } finally {
    global.fetch = original;
  }
});
