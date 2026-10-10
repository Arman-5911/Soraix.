import { detail } from "./anilist.mjs";
import { subtitleToVtt } from "../src/subtitles.js";

const ORIGIN = "https://jimaku.cc";
const MAX_BYTES = 2 * 1024 * 1024;

async function boundedText(response) {
  if (!response.ok) throw new Error("Subtitle provider unavailable.");
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BYTES)
        throw new Error("Subtitle response is too large.");
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Jimaku's episode filter is best-effort; independently reject ambiguous files.
export function matchingEnglishFile(file, episode, movie = false) {
  if (!Number.isInteger(episode) || episode < 1) return false;
  if (!/\b(?:en|eng|english)\b/i.test(String(file.name).replace(/_/g, " ")))
    return false;
  if (!/\.(srt|vtt)$/i.test(file.name) || file.size > MAX_BYTES) return false;
  let url;
  try {
    url = new URL(file.url);
  } catch {
    return false;
  }
  if (
    url.origin !== ORIGIN ||
    url.username ||
    url.password ||
    !url.pathname.startsWith("/")
  )
    return false;
  if (movie) return episode === 1;
  const name = file.name.replace(/_/g, " ");
  // Require an explicit episode marker, not an arbitrary year/resolution number.
  const matches = [
    ...name.matchAll(/(?:\bE(?:P(?:ISODE)?)?\s*|\s-\s)(\d{1,4})(?!\d)/gi),
  ];
  return (
    matches.length === 1 &&
    Number(matches[0][1]) === episode &&
    !new RegExp(
      `(?:E(?:P)?\\s*0*${episode}|-\\s*0*${episode})\\s*[-~]\\s*\\d`,
      "i",
    ).test(name)
  );
}

export async function externalSubtitles(id, episode) {
  if (!process.env.JIMAKU_API_KEY)
    return {
      captions: [],
      status: "not_configured",
      message:
        "External subtitle lookup is not configured on this server. You can load an SRT/VTT file.",
    };
  if (!Number.isInteger(episode) || episode < 1)
    return { captions: [], status: "no_match" };
  const signal = AbortSignal.timeout(18000);
  const api = async (path) =>
    JSON.parse(
      await boundedText(
        await fetch(ORIGIN + path, {
          headers: {
            Authorization: process.env.JIMAKU_API_KEY,
            Accept: "application/json",
          },
          signal,
          redirect: "error",
        }),
      ),
    );
  const anilistId = String(id).startsWith("al")
    ? Number(String(id).slice(2))
    : (await detail(id)).anime.anilistId;
  const entries = await api(
    `/api/entries/search?anilist_id=${anilistId}&anime=true`,
  );
  for (const entry of (Array.isArray(entries) ? entries : [])
    .filter((e) => e.anilist_id === anilistId && Number.isSafeInteger(e.id))
    .slice(0, 2)) {
    const files = await api(
      `/api/entries/${entry.id}/files?episode=${episode}`,
    );
    const matches = (Array.isArray(files) ? files : []).filter((f) =>
      matchingEnglishFile(f, episode, entry.flags?.movie),
    );
    for (const file of matches.slice(0, 3)) {
      try {
        // Public download: never forward the API key to file URLs or redirects.
        const text = await boundedText(
          await fetch(file.url, { signal, redirect: "error" }),
        );
        return {
          captions: [
            {
              language: "en",
              label: "English · Jimaku",
              vtt: subtitleToVtt(text),
            },
          ],
          source: "Jimaku",
          status: "found",
        };
      } catch {
        /* Try another independently matched release. */
      }
    }
  }
  return {
    captions: [],
    source: "Jimaku",
    status: "no_match",
    message:
      "No matching English SRT/VTT was found. Try a local subtitle file.",
  };
}
