import { directLibrary, resolveEpisode } from "./streaming.mjs";
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
  if (!process.env.VIDEO_LIBRARY_PATH)
    return { episodes: [], configured: false };
  let library;
  try {
    library = JSON.parse(
      await fs.readFile(process.env.VIDEO_LIBRARY_PATH, "utf8"),
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
        }))
        .filter((c) => c.url),
    }))
    .filter((e) => e.sources.length);
  return {
    episodes: episodes.sort((a, b) => a.number - b.number),
    configured: true,
  };
}
export async function availableMedia(id, anime) {
  const local = await mediaLibrary(id);
  if (local.episodes.length) return local;
  return directLibrary(id, anime);
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
    if (url.pathname === "/api/home") value = await home();
    else if (url.pathname === "/api/watchable") {
      const data = await graphql(
        `query($ids:[Int]){Page(perPage:50){media(idMal_in:$ids,type:ANIME,isAdult:false){${mediaFields}}}}`,
        { ids: [52991, 38000, 40748, 20, 21, 16498] },
      );
      const items = [];
      // Bounded concurrency; every featured title must have a real episode list.
      const candidates = data.Page.media.map(normalize);
      for (let i = 0; i < candidates.length; i += 2) {
        const results = await Promise.allSettled(
          candidates.slice(i, i + 2).map(async (a) => {
            const library = await availableMedia(a.id, a);
            return library.episodes.length
              ? {
                  ...a,
                  playableEpisodes: library.episodes.length,
                  playbackProvider: library.provider || "Hosted",
                }
              : null;
          }),
        );
        for (const r of results)
          if (r.status === "fulfilled" && r.value) items.push(r.value);
      }
      if (!items.length)
        throw new ApiError(
          "Featured episode sources are unavailable. Please retry.",
          503,
        );
      value = {
        items,
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
      value = await resolveEpisode(
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
