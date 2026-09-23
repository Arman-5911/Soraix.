import { ApiError, detail, safeUrl } from "./anilist.mjs";

// Public provider API endpoints documented by anime-sdk's AnimeParadiseProvider:
// https://github.com/hexxt-git/anime-sdk/blob/master/src/providers/AnimeParadiseProvider.ts
// Streams are delivered directly by the provider. No arbitrary URL proxy,
// credential forwarding, cookie collection, or access-control bypass.
const API = "https://api.animeparadise.moe";
const CDN = "https://stream.animeparadise.moe";
const cache = new Map(),
  pending = new Map();
const nameKey = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
const titles = (a) =>
  [a.title, ...Object.values(a.alternativeTitle || {})].filter(
    (x) => typeof x === "string",
  );

export function matchTitle(anime, candidates) {
  const names = new Set(
    [...Object.values(anime.title || {}), ...(anime.synonyms || [])]
      .filter(Boolean)
      .map(nameKey),
  );
  const matches = candidates.filter((candidate) => {
    const year = Number(
      candidate.animeSeason?.year ||
        String(candidate.startDate || "").slice(0, 4),
    );
    if (year && anime.year && Math.abs(year - anime.year) > 1) return false;
    // Never fuzzy-match a sequel, compilation or mini-series to the main show.
    return titles(candidate).some((t) => names.has(nameKey(t)));
  });
  return matches.length === 1 ? matches[0] : null;
}

async function providerJson(path) {
  let response;
  try {
    response = await fetch(API + path, {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError(
      "The episode provider is unreachable. Please retry shortly.",
      503,
    );
  }
  if (!response.ok)
    throw new ApiError(
      "The episode provider is temporarily unavailable.",
      response.status === 429 ? 429 : 502,
    );
  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      "The episode provider returned an invalid response.",
      502,
    );
  }
  if (body.error || body.success === false)
    throw new ApiError("The episode provider could not load this title.", 502);
  return body.data;
}

export function normalizeEpisodes(rows, providerId) {
  if (!Array.isArray(rows))
    throw new ApiError(
      "The episode provider returned an invalid episode list.",
      502,
    );
  const seen = new Set();
  return rows
    .filter((e) => {
      const number = Number(e.number);
      if (
        !Number.isFinite(number) ||
        number <= 0 ||
        !/^[\w-]{1,100}$/.test(e.uid || "") ||
        seen.has(number)
      )
        return false;
      seen.add(number);
      return true;
    })
    .map((e) => ({
      number: Number(e.number),
      title: String(e.title || `Episode ${e.number}`),
      provider: "direct",
      providerId,
      uid: e.uid,
      availableLanguages: ["sub"],
    }))
    .sort((a, b) => a.number - b.number);
}

export async function directLibrary(id, knownAnime) {
  if (process.env.STREAMING_PROVIDER === "none")
    return { episodes: [], provider: null };
  if (
    process.env.STREAMING_PROVIDER &&
    process.env.STREAMING_PROVIDER !== "animeparadise"
  )
    throw new ApiError(
      "The configured streaming provider is not supported.",
      503,
    );
  const old = cache.get(String(id));
  if (old && Date.now() < old.expires) return old.value;
  if (pending.has(String(id))) return pending.get(String(id));
  const job = (async () => {
    const anime = knownAnime || (await detail(id)).anime;
    let matched;
    const queries = [
      ...new Set([anime.title.romaji, anime.title.english].filter(Boolean)),
    ];
    for (const query of queries) {
      const candidates = await providerJson(
        `/search?q=${encodeURIComponent(query)}&limit=20`,
      );
      if (!Array.isArray(candidates))
        throw new ApiError(
          "The episode provider returned invalid search results.",
          502,
        );
      matched = matchTitle(anime, candidates);
      if (matched) break;
    }
    let episodes = [];
    if (matched && /^[\w-]{1,100}$/.test(matched._id)) {
      episodes = normalizeEpisodes(
        await providerJson(`/anime/${matched._id}/episode`),
        matched._id,
      );
    }
    const value = {
      episodes,
      provider: episodes.length ? "AnimeParadise" : null,
      configured: false,
      checkedAt: new Date().toISOString(),
    };
    cache.set(String(id), {
      value,
      expires: Date.now() + (episodes.length ? 600000 : 60000),
    });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return value;
  })();
  pending.set(String(id), job);
  try {
    return await job;
  } finally {
    pending.delete(String(id));
  }
}

export function normalizeStream(episode, language = "sub") {
  if (
    !episode?.streamLink ||
    typeof episode.streamLink !== "string" ||
    episode.streamLink.length > 8000
  )
    throw new ApiError("No playable video was returned for this episode.", 404);
  const rawTracks = Array.isArray(episode.subData) ? episode.subData : [];
  const captions = rawTracks
    .map((t) => ({
      url: safeUrl(t.src || t.file || t.url),
      label: String(t.label || t.language || "Subtitles"),
      language: String(
        t.lang ||
          t.srclang ||
          t.language ||
          {
            English: "en",
            Italian: "it",
            Spanish: "es",
            Portuguese: "pt",
            French: "fr",
            German: "de",
            Arabic: "ar",
            Japanese: "ja",
          }[t.label] ||
          "und",
      ),
    }))
    .filter((t) => {
      if (!t.url) return false;
      const url = new URL(t.url);
      return url.origin === CDN && url.pathname === "/captions";
    });
  return {
    provider: "direct",
    introEnd: 0,
    sources: [
      {
        url: `${CDN}/m3u8?url=${encodeURIComponent(episode.streamLink)}`,
        type: "hls",
        quality: "Auto",
        language: language.toUpperCase(),
      },
    ],
    captions,
  };
}

export async function resolveEpisode(id, number, language) {
  if (!Number.isFinite(number) || number <= 0)
    throw new ApiError("Invalid episode number.", 400);
  if (!["sub", "dub", "raw"].includes(language))
    throw new ApiError("Invalid audio selection.", 400);
  const library = await directLibrary(id);
  const entry = library.episodes.find((e) => e.number === number);
  if (!entry)
    throw new ApiError("This episode is not available from the provider.", 404);
  if (!entry.availableLanguages.includes(language))
    throw new ApiError(
      "This audio version is not available for this episode.",
      404,
    );
  const data = await providerJson(
    `/ep/${encodeURIComponent(entry.uid)}?origin=${encodeURIComponent(entry.providerId)}`,
  );
  return {
    media: normalizeStream(data?.episode, language),
    episode: number,
    provider: library.provider,
    resolvedAt: new Date().toISOString(),
  };
}
