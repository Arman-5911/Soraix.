import { ApiError } from "./anilist.mjs";

import { discoverHindi, readHindi as read } from "./hindi-discovery.mjs";
export const hindiLibrary = discoverHindi;

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
export async function resolveHindi(id, number) {
  const library = await hindiLibrary(id);
  if (!library.episodes.some((e) => e.number === number))
    throw new ApiError("Hindi dub is unavailable for this episode.", 404);
  const page = await read(
    library.episodes.find((e) => e.number === number).hindiPage,
  );
  const embed = extractVidmoly(page);
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
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".vmeas.cloud") ||
    !url.pathname.endsWith(".m3u8")
  )
    throw new ApiError("Hindi stream host is unsupported.", 502);
  const manifest = await read(url.href);
  if (
    !manifest.startsWith("#EXTM3U") ||
    !/TYPE=AUDIO[^\n]*LANGUAGE="hi"/.test(manifest)
  )
    throw new ApiError("This stream has no verified Hindi audio track.", 404);
  return {
    episode: number,
    provider: "DesiDubAnime / Vidmoly",
    resolvedAt: new Date().toISOString(),
    media: {
      provider: "direct",
      audio: "hi",
      audioTrackLanguage: "hi",
      captions: [],
      sources: [
        {
          url: url.href,
          type: "hls",
          quality: "Auto",
          language: "Hindi",
          audio: "hi",
          server: "Vidmoly",
        },
      ],
    },
  };
}
