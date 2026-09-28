import { directLibrary, resolveEpisode } from "./streaming.mjs";
import { readerImage } from "./reading-sources.mjs";
import { deliverDub } from "./dub-delivery.mjs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import {
  universe,
  universeDetail,
  chapters,
  chapterPages,
  readyToRead,
} from "./universe.mjs";
import { hindiLibrary, resolveHindi } from "./hindi.mjs";
import fs from "node:fs/promises";
import {
  ApiError,
  graphql,
  mediaFields,
  normalize,
  home,
  browse,
  detail,
  schedule,
  genres,
  safeUrl,
} from "./anilist.mjs";
export async function mediaLibrary(id) {
  if (!process.env.VIDEO_LIBRARY_PATH && !process.env.VIDEO_LIBRARY_JSON)
    return { episodes: [], configured: false };
  let library;
  try {
    library = JSON.parse(
      process.env.VIDEO_LIBRARY_JSON ||
        (await fs.readFile(process.env.VIDEO_LIBRARY_PATH, "utf8")),
    );
  } catch {
    throw new ApiError("The video library is temporarily unavailable.", 503);
  }
  const episodes = (library[String(id)]?.episodes || [])
    .filter((e) => Number.isInteger(e.number) && e.number > 0)
    .map((e) => ({
      number: e.number,
      title: String(e.title || `Episode ${e.number}`),
      introEnd: Number(e.introEnd) || 0,
      sources: (e.sources || [])
        .map((s) => ({
          url: safeUrl(s.url),
          quality: String(s.quality || "Original"),
          language: String(s.language || "Original"),
          server: String(s.server || "Primary"),
          audio: ["sub", "dub", "hi"].includes(s.audio) ? s.audio : null,
          type:
            s.type === "hls" || /\.m3u8(?:\?|$)/i.test(s.url || "")
              ? "hls"
              : "file",
        }))
        .filter((s) => s.url),
      captions: (e.captions || [])
        .map((c) => ({
          url: safeUrl(c.url),
          language: String(c.language || "en"),
          label: String(c.label || "Captions"),
          audio: ["sub", "dub", "hi"].includes(c.audio) ? c.audio : null,
        }))
        .filter((c) => c.url),
    }))
    .filter((e) => e.sources.length)
    .map((e) => ({
      ...e,
      availableLanguages: [
        ...new Set(e.sources.map((s) => s.audio).filter(Boolean)),
      ],
      ...(e.sources.some((s) => s.audio) ? { provider: "audio" } : {}),
    }));
  return {
    episodes: episodes.sort((a, b) => a.number - b.number),
    configured: true,
  };
}
export async function availableMedia(id, anime) {
  const [base, hindi] = await Promise.allSettled([
    baseMedia(id, anime),
    hindiLibrary(id, anime),
  ]);
  if (
    base.status === "rejected" &&
    !(hindi.status === "fulfilled" && hindi.value.episodes.length)
  )
    throw base.reason;
  const media = base.status === "fulfilled" ? base.value : { episodes: [] };
  if (hindi.status === "fulfilled" && hindi.value.episodes.length) {
    return {
      ...media,
      ...mergeAudioLibraries(hindi.value, media),
      provider: "SoraiX sources",
    };
  }
  return media;
}
async function baseMedia(id, anime) {
  const local = await mediaLibrary(id);
  if (local.episodes.length) {
    if (!local.episodes.some((e) => e.availableLanguages.length)) return local;
    let remote;
    try {
      remote = await directLibrary(id, anime);
    } catch {
      remote = { episodes: [] };
    }
    return {
      ...local,
      ...mergeAudioLibraries(remote, local),
      provider: "SoraiX sources",
    };
  }
  return directLibrary(id, anime);
}
export function mergeAudioLibraries(remote, local) {
  const entries = new Map(remote.episodes.map((e) => [e.number, e]));
  for (const e of local.episodes) {
    const original = entries.get(e.number);
    entries.set(e.number, {
      ...e,
      availableLanguages: [
        ...new Set([
          ...(original?.availableLanguages || []),
          ...(e.availableLanguages || []),
        ]),
      ],
    });
  }
  return {
    episodes: [...entries.values()].sort((a, b) => a.number - b.number),
  };
}
export async function resolveMedia(id, number, language) {
  if (!["sub", "dub", "hi", "raw"].includes(language))
    throw new ApiError("Invalid audio selection.", 400);
  if (!Number.isFinite(number) || number <= 0)
    throw new ApiError("Invalid episode number.", 400);
  const local = await mediaLibrary(id);
  const episode = local.episodes.find((e) => e.number === number);
  const sources = episode?.sources.filter((s) => s.audio === language) || [];
  if (sources.length)
    return {
      episode: number,
      provider: "Configured video library",
      resolvedAt: new Date().toISOString(),
      media: {
        ...episode,
        provider: "hosted",
        audio: language,
        sources,
        captions: episode.captions.filter(
          (c) => !c.audio || c.audio === language,
        ),
      },
    };
  if (language === "hi") return resolveHindi(id, number);
  if (language === "dub") {
    try {
      return await resolveEpisode(id, number, language);
    } catch (originalError) {
      try {
        return await resolveHindi(id, number, "dub");
      } catch {
        throw originalError;
      }
    }
  }
  return resolveEpisode(id, number, language);
}
export async function apiHandler(req, res, next) {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/")) {
    next?.();
    return false;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.writeHead(405, { Allow: "GET" });
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return true;
  }
  try {
    let value;
    if (url.pathname === "/api/dub-media") {
      const media = await deliverDub(url.searchParams.get("token"));
      res.setHeader("Content-Type", media.type);
      if (media.stream) {
        // Stream binary segments rather than buffering them into a function payload.
        try {
          await pipeline(Readable.from(media.stream), res);
        } catch {
          if (!res.destroyed) res.destroy();
        }
        return true;
      }
      res.end(media.data);
      return true;
    }
    if (
      /^\/api\/reader-image\/(?:wc_[A-Z0-9]{26}|at_[A-Za-z0-9-]{1,80}_[A-Za-z0-9-]{1,80})\/\d+$/.test(
        url.pathname,
      )
    ) {
      const parts = url.pathname.split("/");
      const image = await readerImage(parts[3], Number(parts[4]));
      res.setHeader("Content-Type", image.type);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.end(image.data);
      return true;
    } else if (url.pathname === "/api/readable")
      value = await readyToRead(url.searchParams.get("mode"));
    else if (url.pathname === "/api/universe")
      value = await universe(url.searchParams);
    else if (/^\/api\/universe\/(?:\d+|md-[a-f0-9-]{36})$/.test(url.pathname))
      value = await universeDetail(url.pathname.split("/").at(-1));
    else if (/^\/api\/chapters\/(?:\d+|md-[a-f0-9-]{36})$/.test(url.pathname))
      value = await chapters(
        url.pathname.split("/").at(-1),
        url.searchParams.get("language") || "en",
        undefined,
        url.searchParams.get("source") || "auto",
      );
    else if (/^\/api\/pages\/[A-Za-z0-9_-]+$/.test(url.pathname))
      value = await chapterPages(url.pathname.split("/").at(-1));
    else if (url.pathname === "/api/health")
      value = { ok: true, service: "SoraiX", version: 2 };
    else if (url.pathname === "/api/home") value = await home();
    else if (url.pathname === "/api/watchable") {
      const paginated =
        url.searchParams.has("page") || url.searchParams.has("q");
      const filters = new URLSearchParams(url.searchParams);
      filters.set("limit", "6");
      const catalog = paginated ? await browse(filters) : null;
      const data = catalog
        ? null
        : await graphql(
            `query($ids:[Int]){Page(perPage:50){media(idMal_in:$ids,type:ANIME,isAdult:false){${mediaFields}}}}`,
            { ids: [52991, 38000, 40748, 20, 21, 16498] },
          );
      const items = [];
      // Bounded concurrency; every featured title must have a real episode list.
      const candidates = catalog
        ? catalog.items
        : data.Page.media.map(normalize);
      let failures = 0;
      for (let i = 0; i < candidates.length; i += 2) {
        const results = await Promise.allSettled(
          candidates.slice(i, i + 2).map(async (a) => {
            const library =
              url.searchParams.get("audio") === "hi"
                ? await hindiLibrary(a.id, a)
                : await availableMedia(a.id, a);
            return library.episodes.length
              ? {
                  ...a,
                  playableEpisodes: library.episodes.length,
                  firstEpisode: library.episodes[0].number,
                  playbackProvider: library.provider || "Hosted",
                  availableLanguages: [
                    ...new Set(
                      library.episodes.flatMap(
                        (e) => e.availableLanguages || [],
                      ),
                    ),
                  ],
                }
              : null;
          }),
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) items.push(r.value);
          if (r.status === "rejected") failures++;
        }
      }
      if (!items.length && failures)
        throw new ApiError(
          "Featured episode sources are unavailable. Please retry.",
          503,
        );
      value = {
        items,
        pageInfo: catalog?.pageInfo,
        partial: failures > 0,
        fetchedAt: new Date().toISOString(),
      };
    } else if (url.pathname === "/api/catalog")
      value = await browse(url.searchParams);
    else if (url.pathname === "/api/genres") value = { genres };
    else if (url.pathname === "/api/schedule")
      value = await schedule(url.searchParams);
    else if (url.pathname === "/api/random") {
      const p = new URLSearchParams({
        page: String(1 + Math.floor(Math.random() * 20)),
        limit: "30",
      });
      const data = await browse(p);
      value = {
        anime: data.items[Math.floor(Math.random() * data.items.length)],
      };
    } else if (/^\/api\/anime\/[^/]+$/.test(url.pathname))
      value = await detail(decodeURIComponent(url.pathname.split("/").at(-1)));
    else if (/^\/api\/media\/(?:al)?\d+$/.test(url.pathname))
      value = await availableMedia(url.pathname.split("/").at(-1));
    else if (/^\/api\/stream\/(?:al)?\d+\/\d+(?:\.\d+)?$/.test(url.pathname)) {
      const parts = url.pathname.split("/");
      value = await resolveMedia(
        parts[3],
        Number(parts[4]),
        url.searchParams.get("language") || "sub",
      );
    } else throw new ApiError("API route not found.", 404);
    res.end(JSON.stringify(value));
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    res.statusCode = status;
    if (status === 429) res.setHeader("Retry-After", "60");
    res.end(
      JSON.stringify({
        error:
          error instanceof ApiError
            ? error.message
            : "The server could not complete this request.",
      }),
    );
  }
  return true;
}
