import { ApiError } from "./anilist.mjs";
const origin = "https://atsu.moe";
const cache = new Map();
const key = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
async function api(path) {
  const saved = cache.get(path);
  if (saved?.expires > Date.now()) return saved.data;
  const r = await fetch(origin + path, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new ApiError("Atsumaru is temporarily unavailable.", 502);
  const data = await r.json();
  if (cache.size >= 200) cache.delete(cache.keys().next().value);
  cache.set(path, { data, expires: Date.now() + 180000 });
  return data;
}
export function matchAtsumaru(item, documents) {
  const names = new Set(
    [...Object.values(item.title || {}), ...(item.synonyms || [])]
      .filter(Boolean)
      .map(key),
  );
  const matches = documents.filter(
    (d) =>
      !d.isAdult &&
      (!d.medium || d.medium === "Comic") &&
      (!item.year || !d.year || Number(item.year) === Number(d.year)) &&
      /^[A-Za-z0-9-]{1,80}$/.test(d.id) &&
      [d.title, d.englishTitle, ...(d.otherNames || [])].some((t) =>
        names.has(key(t)),
      ),
  );
  const primary = new Set(
    Object.values(item.title || {})
      .filter(Boolean)
      .map(key),
  );
  const exact = matches.filter((d) =>
    [d.title, d.englishTitle].some((t) => primary.has(key(t))),
  );
  if (exact.length === 1) return exact[0];
  return exact.length === 0 && matches.length === 1 ? matches[0] : null;
}
export function atsuChapters(manga, rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!/^[A-Za-z0-9-]{1,80}$/.test(row.id) || row.pageCount === 0) continue;
    const number = row.number == null ? null : String(row.number);
    const c = {
      id: `at_${manga}_${row.id}`,
      number,
      title: row.title || `Chapter ${number}`,
      source: "atsumaru",
      provider: "Atsumaru",
      alternatives: [],
    };
    const k = number ?? row.id;
    const old = groups.get(k);
    if (old) old.alternatives.push({ ...c, alternatives: undefined });
    else groups.set(k, c);
  }
  return [...groups.values()].sort(
    (a, b) => (Number(a.number) || 0) - (Number(b.number) || 0),
  );
}
export async function atsuLibrary(item, language) {
  if (language !== "en")
    return { chapters: [], provider: "Atsumaru", language };
  for (const title of [
    ...new Set([item.title.english, item.title.romaji].filter(Boolean)),
  ]) {
    const q = new URLSearchParams({
      q: title,
      query_by: "title,englishTitle,otherNames,authors",
      per_page: "40",
      page: "1",
    });
    const results = await api("/collections/manga/documents/search?" + q);
    const book = matchAtsumaru(
      item,
      (results.hits || []).map((h) => h.document),
    );
    if (!book) continue;
    const list = await api(
      "/api/manga/allChapters?mangaId=" + encodeURIComponent(book.id),
    );
    return {
      chapters: atsuChapters(book.id, list.chapters || []),
      provider: "Atsumaru",
      language,
      availableLanguages: ["en"],
    };
  }
  return { chapters: [], provider: "Atsumaru", language };
}
export async function atsuPages(id) {
  const match = /^at_([A-Za-z0-9-]{1,80})_([A-Za-z0-9-]{1,80})$/.exec(id);
  if (!match) throw new ApiError("Invalid chapter ID.", 400);
  const result = await api(
    "/api/read/chapter?" +
      new URLSearchParams({ mangaId: match[1], chapterId: match[2] }),
  );
  const pages = (result.readChapter?.pages || []).map((p) => {
    const value = String(p.image || "");
    const url = new URL(
      value.startsWith("/") || value.startsWith("https:")
        ? value
        : "/static/" + value,
      "https://cdn.atsu.moe",
    );
    if (
      url.origin !== "https://cdn.atsu.moe" ||
      !url.pathname.startsWith("/static/") ||
      url.username ||
      url.password
    )
      throw new ApiError("Unsupported page host.", 502);
    return url.href;
  });
  if (!pages.length)
    throw new ApiError("No readable pages on this source.", 404);
  return { pages, provider: "Atsumaru" };
}
