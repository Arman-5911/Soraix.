import { load } from "cheerio";
import { ApiError, detail } from "./anilist.mjs";

export const HINDI_ORIGIN = "https://www.desidubanime.me";
const cache = new Map(),
  pending = new Map();
const key = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export async function readHindi(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error();
    return await response.text();
  } catch {
    throw new ApiError("Hindi server is temporarily unavailable.", 502);
  }
}
async function cached(name, ttl, get) {
  const old = cache.get(name);
  if (old?.expires > Date.now()) return old.value;
  if (pending.has(name)) return pending.get(name);
  const task = get()
    .then((value) => {
      if (cache.size >= 400) cache.delete(cache.keys().next().value);
      cache.set(name, { value, expires: Date.now() + ttl });
      return value;
    })
    .finally(() => pending.delete(name));
  pending.set(name, task);
  return task;
}
export function providerUrl(value, section) {
  try {
    const url = new URL(value, HINDI_ORIGIN);
    return url.origin === HINDI_ORIGIN &&
      new RegExp(`^/${section}/[a-z0-9-]+/$`).test(url.pathname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function searchCandidates(html, anime) {
  const $ = load(html),
    matches = new Set();
  const names = new Set(
    [...Object.values(anime.title || {}), ...(anime.synonyms || [])]
      .filter(Boolean)
      .map(key),
  );
  $("a[href]").each((_, element) => {
    const a = $(element),
      url = providerUrl(a.attr("href"), "anime");
    const labels = [
      a.attr("title"),
      a.find("h3").text().trim(),
      a.find("h2").text().trim(),
      a.find("img").attr("alt"),
      a.text().trim(),
      ...a
        .find("h3 span")
        .map((_, el) => $(el).text())
        .get(),
    ];
    if (url && labels.some((value) => value && names.has(key(value))))
      matches.add(url);
  });
  return [...matches];
}
export function titleMatches(html, anime, language = "hi") {
  const $ = load(html);
  const names = new Set(
    [...Object.values(anime.title || {}), ...(anime.synonyms || [])]
      .filter(Boolean)
      .map(key),
  );
  const actual = $("h1 span")
    .map((_, e) => key($(e).text()))
    .get();
  if (!actual.length) actual.push(key($("h1").text()));
  const year = Number($('a[href*="/premiered/"]').first().text().trim());
  const hindi = $('meta[property="article:tag"]')
    .toArray()
    .some((e) =>
      (language === "any"
        ? ["hindi", "english"]
        : [language === "dub" ? "english" : "hindi"]
      ).includes($(e).attr("content")?.toLowerCase()),
    );
  return (
    hindi &&
    actual.some((name) => names.has(name)) &&
    (!year || !anime.year || year === Number(anime.year))
  );
}
export function parseHindiEpisodes(html) {
  const $ = load(html),
    entries = new Map();
  $("a.episode-list-item").each((_, el) => {
    const a = $(el),
      url = providerUrl(a.attr("href"), "watch");
    const number = Number(a.find(".episode-list-item-number").text().trim());
    if (url && Number.isFinite(number) && number > 0 && !entries.has(number))
      entries.set(number, {
        number,
        title:
          a.find(".episode-list-item-title").text().trim() ||
          `Episode ${number}`,
        provider: "audio",
        availableLanguages: ["hi"],
        hindiPage: url,
      });
  });
  return [...entries.values()].sort((a, b) => a.number - b.number);
}
async function search(anime, language = "hi") {
  const nonce = await cached("search-nonce", 300000, async () => {
    const html = await readHindi(HINDI_ORIGIN + "/");
    const value = html.match(/"search_actions"\s*:\s*"([a-z0-9]+)"/)?.[1];
    if (!value)
      throw new ApiError("Hindi search is temporarily unavailable.", 502);
    return value;
  });
  for (const name of hindiSearchTitles(anime)) {
    const body = await readHindi(
      `${HINDI_ORIGIN}/wp-admin/admin-ajax.php?${new URLSearchParams({ action: "instant_search", query: name, nonce })}`,
    );
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw new ApiError("Hindi search returned an invalid response.", 502);
    }
    if (!data.success || typeof data.data?.html !== "string") {
      cache.delete("search-nonce");
      throw new ApiError(
        "Hindi search is temporarily unavailable. Retry shortly.",
        502,
      );
    }
    const candidates = searchCandidates(data.data.html, anime);
    const verified = [];
    for (const url of candidates.slice(0, 3)) {
      const html = await readHindi(url);
      if (titleMatches(html, anime, language)) verified.push({ url, html });
    }
    if (verified.length === 1) return verified[0];
    if (verified.length > 1) return null;
  }
  return null;
}
export function hindiSearchTitles(anime) {
  return [
    ...new Set(
      [
        anime.title?.romaji,
        anime.title?.english,
        ...(anime.synonyms || []),
      ].filter(Boolean),
    ),
  ].slice(0, 4);
}
async function discoverDubs(id, knownAnime) {
  if (process.env.HINDI_PROVIDER === "none") return { episodes: [] };
  return cached(`title:${id}`, 300000, async () => {
    const anime = knownAnime || (await detail(String(id))).anime;
    const result = await search(anime, "any");
    if (!result) return { episodes: [] };
    const $ = load(result.html);
    const hasHindi = $('meta[property="article:tag"]')
      .toArray()
      .some((e) => $(e).attr("content")?.toLowerCase() === "hindi");
    const hasEnglish = $('meta[property="article:tag"]')
      .toArray()
      .some((e) => $(e).attr("content")?.toLowerCase() === "english");
    const watch = $("a[href]")
      .map((_, el) => providerUrl($(el).attr("href"), "watch"))
      .get()
      .filter(Boolean)[0];
    if (!watch) return { episodes: [] };
    const page = await readHindi(watch);
    let episodes = parseHindiEpisodes(page);
    // A single movie can use a watch page without a numbered episode list.
    if (
      !episodes.length &&
      anime.type === "Movie" &&
      page.includes("data-embed-id=")
    )
      episodes = [
        {
          number: 1,
          title: anime.title.english,
          provider: "audio",
          availableLanguages: ["hi"],
          hindiPage: watch,
        },
      ];
    episodes = episodes.map((e) => ({
      ...e,
      availableLanguages: [
        ...(hasHindi ? ["hi"] : []),
        ...(hasEnglish ? ["dub"] : []),
      ],
    }));
    return {
      episodes,
      provider: "DesiDubAnime",
      discoveredAt: new Date().toISOString(),
    };
  });
}

export async function discoverHindi(id, knownAnime) {
  const library = await discoverDubs(id, knownAnime);
  return {
    ...library,
    episodes: library.episodes.filter((e) =>
      e.availableLanguages.includes("hi"),
    ),
  };
}
export async function discoverEnglish(id, knownAnime) {
  const library = await discoverDubs(id, knownAnime);
  return {
    ...library,
    episodes: library.episodes.filter((e) =>
      e.availableLanguages.includes("dub"),
    ),
  };
}
