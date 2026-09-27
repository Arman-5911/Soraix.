import { load } from "cheerio";
import { ApiError } from "./anilist.mjs";
const origins = { weebcentral: "https://weebcentral.com" };
const cache = new Map(),
  pending = new Map();
const key = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
async function html(url) {
  const old = cache.get(url);
  if (old?.until > Date.now()) return old.value;
  if (pending.has(url)) return pending.get(url);
  const task = (async () => {
    let r;
    try {
      r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    } catch {
      throw new ApiError(
        "Reading source is unreachable. Try another source.",
        503,
      );
    }
    if (!r.ok)
      throw new ApiError(
        "Reading source is unavailable. Try another source.",
        502,
      );
    const value = await r.text();
    if (cache.size > 350) cache.delete(cache.keys().next().value);
    cache.set(url, { value, until: Date.now() + 300000 });
    return value;
  })();
  pending.set(url, task);
  try {
    return await task;
  } finally {
    pending.delete(url);
  }
}
export function matchingSeries(markup, item, source) {
  const $ = load(markup),
    names = new Set(
      [...Object.values(item.title || {}), ...(item.synonyms || [])]
        .filter(Boolean)
        .map(key),
    ),
    matches = new Set();
  $("a[href]").each((_, el) => {
    const a = $(el);
    if (!names.has(key(a.text().trim()))) return;
    try {
      const u = new URL(a.attr("href"), origins[source]);
      const pattern = /^\/series\/[A-Z0-9]{26}\/[^/]+$/;
      if (u.origin === origins[source] && pattern.test(u.pathname))
        matches.add(u.href);
    } catch {}
  });
  return matches.size === 1 ? [...matches][0] : null;
}
export function sourceChapters(markup, source) {
  const $ = load(markup),
    chapters = new Map();
  $("a[href]").each((_, el) => {
    const a = $(el);
    let u;
    try {
      u = new URL(a.attr("href"), origins[source]);
    } catch {
      return;
    }
    if (u.origin !== origins[source]) return;
    const valid = /^\/chapters\/[A-Z0-9]{26}$/.test(u.pathname);
    const number = a.text().match(/Chapter\s+(\d+(?:\.\d+)?)/i)?.[1];
    if (!valid || !number) return;
    const id = "wc_" + u.pathname.split("/").at(-1);
    if (!chapters.has(id))
      chapters.set(id, { id, number, title: `Chapter ${number}`, source });
  });
  return [...chapters.values()].sort(
    (a, b) => Number(a.number) - Number(b.number),
  );
}
export function searchTitles(item) {
  return [
    ...new Set(
      [
        item.title?.english,
        item.title?.romaji,
        ...(item.synonyms || []),
      ].filter(Boolean),
    ),
  ].slice(0, 6);
}
export async function alternativeChapters(item, source, language) {
  if (!origins[source]) throw new ApiError("Unknown reading source.", 400);
  if (language !== "en")
    return { chapters: [], provider: "WeebCentral", language };
  const names = searchTitles(item);
  // Two small parallel batches keep alias fallback within serverless time limits.
  for (let offset = 0; offset < names.length; offset += 3) {
    const matches = await Promise.allSettled(
      names.slice(offset, offset + 3).map(async (name) => {
        const search = `/search/data?text=${encodeURIComponent(name)}`;
        return matchingSeries(
          await html(origins[source] + search),
          item,
          source,
        );
      }),
    );
    const urls = [
      ...new Set(
        matches
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value)
          .filter(Boolean),
      ),
    ];
    if (urls.length > 1)
      return {
        chapters: [],
        provider: "WeebCentral",
        language,
        ambiguous: true,
      };
    if (matches.every((r) => r.status === "rejected")) throw matches[0].reason;
    const url = urls[0];
    if (!url) continue;
    const list =
      source === "weebcentral"
        ? `${origins[source]}/series/${new URL(url).pathname.split("/")[2]}/full-chapter-list`
        : url;
    return {
      chapters: sourceChapters(await html(list), source),
      provider: "WeebCentral",
      language,
      availableLanguages: ["en"],
    };
  }
  return { chapters: [], provider: "WeebCentral", language };
}
export async function alternativePages(id, direct = false) {
  let url, source;
  if (/^wc_[A-Z0-9]{26}$/.test(id)) {
    source = "weebcentral";
    url = `${origins[source]}/chapters/${id.slice(3)}/images?is_prev=False&reading_style=long_strip&current_page=1`;
  } else throw new ApiError("Invalid chapter ID.", 400);
  const $ = load(await html(url));
  const pages = $("img")
    .map((_, el) => $(el).attr("data-src") || $(el).attr("src"))
    .get()
    .filter((value) => {
      try {
        const u = new URL(value);
        return (
          u.protocol === "https:" &&
          ["hot.planeptune.us", "official.lowee.us"].includes(u.hostname) &&
          !u.port &&
          !u.username &&
          !u.password
        );
      } catch {
        return false;
      }
    });
  if (!pages.length)
    throw new ApiError(
      "This source returned no readable pages. Choose another source.",
      502,
    );
  return {
    pages: direct
      ? pages
      : pages.map((_, index) => `/api/reader-image/${id}/${index}`),
    provider: "WeebCentral",
  };
}
export async function readerImage(id, index) {
  if (!/^wc_[A-Z0-9]{26}$/.test(id) || !Number.isInteger(index) || index < 0)
    throw new ApiError("Invalid chapter page.", 400);
  const { pages } = await alternativePages(id, true);
  if (!pages[index]) throw new ApiError("Page not found.", 404);
  const r = await fetch(pages[index], {
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!r.ok) throw new ApiError("The page source is unavailable.", 502);
  const chunks = [];
  let size = 0;
  for await (const chunk of r.body) {
    size += chunk.length;
    if (size > 4 * 1024 * 1024) {
      throw new ApiError("This page exceeds the delivery size limit.", 413);
    }
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks);
  const type =
    data[0] === 255 && data[1] === 216
      ? "image/jpeg"
      : data
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : data.subarray(0, 4).toString() === "RIFF" &&
            data.subarray(8, 12).toString() === "WEBP"
          ? "image/webp"
          : null;
  if (!type) throw new ApiError("The source did not return an image.", 502);
  return { data, type };
}
