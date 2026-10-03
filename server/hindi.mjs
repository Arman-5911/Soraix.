import { load } from "cheerio";
import { ApiError } from "./anilist.mjs";
import { deliveryUrl, dubUrl } from "./dub-delivery.mjs";

import {
  discoverHindi,
  discoverEnglish,
  readHindi as read,
} from "./hindi-discovery.mjs";
export const hindiLibrary = discoverHindi;
export const englishLibrary = discoverEnglish;

export function extractVidmoly(html) {
  for (const match of html.matchAll(/data-embed-id="[^"]*:([^"\s]+)"/g)) {
    try {
      const url = new URL(Buffer.from(match[1], "base64").toString("utf8"));
      if (
        url.protocol === "https:" &&
        url.hostname === "vidmoly.org" &&
        /^\/embed-[a-z0-9]+\.html$/.test(url.pathname)
      )
        return url.href;
    } catch {}
  }
  return null;
}
export function extractDubServers(html, language = "hi", englishOnly = false) {
  const $ = load(html),
    servers = new Map();
  const hosts = new Set([
    "filesforever.link",
    "desidubanime.p2pplay.pro",
    "player.abyssplayer.com",
    "play.abyssplayer.com",
    "vidmoly.org",
  ]);
  $("[data-embed-id]").each((_, el) => {
    const node = $(el);
    try {
      const decoded = Buffer.from(
        node.attr("data-embed-id").split(":")[1] || "",
        "base64",
      )
        .toString("utf8")
        .trim();
      // Some published options contain an iframe, not a bare URL.
      // Extract only its src; never render provider HTML in our page.
      const url = new URL(
        decoded.startsWith("<")
          ? load(decoded)("iframe").first().attr("src")
          : decoded,
      );
      const name = node.text().trim() || url.hostname;
      const english = /\b(english|eng)\b/i.test(name);
      if (language === "dub" && !english && !englishOnly) return;
      if (language === "hi" && english && !/\b(hindi|multi)\b/i.test(name))
        return;
      if (
        url.protocol !== "https:" ||
        !hosts.has(url.hostname) ||
        url.port ||
        url.username ||
        url.password
      )
        return;
      if (!servers.has(url.href))
        servers.set(url.href, {
          url: url.href,
          name,
        });
    } catch {}
  });
  return [...servers.values()];
}
export async function resolveHindi(id, number, language = "hi") {
  if (!["hi", "dub"].includes(language))
    throw new ApiError("Invalid dub language.", 400);
  const track = language === "dub" ? "en" : "hi";
  const library = await (language === "dub"
    ? englishLibrary(id)
    : hindiLibrary(id));
  if (!library.episodes.some((e) => e.number === number))
    throw new ApiError(`${track === "en" ? "English" : "Hindi"} dub is not available for this episode.`, 404);
  const page = await read(
    library.episodes.find((e) => e.number === number).hindiPage,
  );
  const embed = extractVidmoly(page);
  const entry = library.episodes.find((e) => e.number === number);
  const servers = extractDubServers(
    page,
    language,
    language === "dub" && !entry.availableLanguages.includes("hi"),
  );
  try {
    if (!embed)
      throw new ApiError(
        "No compatible Hindi server is available for this episode.",
        404,
      );
    const html = await read(embed);
    const source = html.match(
      /sources:\s*\[\s*\{\s*file:\s*['"]([^'"]+)['"]/,
    )?.[1];
    let url;
    try {
      url = new URL(source);
    } catch {
      throw new ApiError("Hindi server returned no stream.", 502);
    }
    dubUrl(url.href);
    if (!url.pathname.endsWith(".m3u8"))
      throw new ApiError("Hindi stream host is unsupported.", 502);
    const manifest = await read(url.href);
    if (
      !manifest.startsWith("#EXTM3U") ||
      !new RegExp(`TYPE=AUDIO[^\\n]*LANGUAGE="${track}"`).test(manifest)
    )
      throw new ApiError("This stream has no verified Hindi audio track.", 404);
    if (language === "dub" && !servers.some((server) => server.url === embed)) {
      servers.push({
        name: "Vidmoly · English / multi-audio",
        url: embed,
        audioSelection: "manual",
      });
    }
    return {
      episode: number,
      provider: "DesiDubAnime / Vidmoly",
      resolvedAt: new Date().toISOString(),
      media: {
        provider: "direct",
        audio: language,
        audioTrackLanguage: track,
        captions: [],
        servers,
        sources: [
          {
            url: deliveryUrl(url.href),
            type: "hls",
            quality: "Auto",
            language: track === "en" ? "English" : "Hindi",
            audio: language,
            server: "Vidmoly",
          },
        ],
      },
    };
  } catch (error) {
    if (servers.length)
      return {
        episode: number,
        provider: "DesiDubAnime",
        resolvedAt: new Date().toISOString(),
        media: {
          provider: "direct",
          audio: language,
          sources: [],
          servers,
          directError:
            "Native playback is unavailable. You can retry or choose an external player.",
        },
      };
    throw new ApiError(
      `${track === "en" ? "English" : "Hindi"} direct playback is unavailable for this episode. Retry later or choose another audio version.`,
      error.status || 502,
    );
  }
}
