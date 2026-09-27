import { ApiError, graphql, mediaFields, normalize } from "./anilist.mjs";
import { alternativeChapters, alternativePages } from "./reading-sources.mjs";
export const modes = {
  anime: ["ANIME", null],
  donghua: ["ANIME", "CN"],
  manga: ["MANGA", "JP"],
  manhwa: ["MANGA", "KR"],
  manhua: ["MANGA", "CN"],
};
export const contentMode = (a) =>
  a.type === "ANIME"
    ? a.countryOfOrigin === "CN"
      ? "donghua"
      : "anime"
    : { KR: "manhwa", CN: "manhua" }[a.countryOfOrigin] || "manga";
const fields = `${mediaFields} countryOfOrigin chapters volumes`;
const entry = (a) => ({
  ...normalize(a),
  ...(a.type === "MANGA"
    ? {
        status:
          {
            RELEASING: "Ongoing",
            FINISHED: "Completed",
            NOT_YET_RELEASED: "Upcoming",
            HIATUS: "On hiatus",
            CANCELLED: "Cancelled",
          }[a.status] || "Unknown",
      }
    : {}),
  mode: contentMode(a),
  chapters: a.chapters,
  volumes: a.volumes,
});
export async function universe(params) {
  const mode = params.get("mode") || "manga";
  if (!modes[mode]) throw new ApiError("Unknown content mode.", 400);
  if (
    params.get("source") === "chapters" &&
    ["manga", "manhwa", "manhua"].includes(mode)
  )
    return readingCatalog(params);
  const [type, country] = modes[mode];
  const variables = {
    type,
    country,
    exclude: type === "MANGA" ? "NOVEL" : undefined,
    page: Math.min(500, Math.max(1, Number(params.get("page")) || 1)),
    search: params.get("q")?.slice(0, 120) || undefined,
    genre: params.get("genre") || undefined,
    status: ["FINISHED", "RELEASING", "NOT_YET_RELEASED"].includes(
      params.get("status"),
    )
      ? params.get("status")
      : undefined,
    sort:
      {
        trending: "TRENDING_DESC",
        popular: "POPULARITY_DESC",
        rated: "SCORE_DESC",
        new: "START_DATE_DESC",
      }[params.get("sort")] || "TRENDING_DESC",
  };
  const result = await graphql(
    `query($type:MediaType,$country:CountryCode,$page:Int,$search:String,$genre:String,$status:MediaStatus,$sort:[MediaSort],$exclude:MediaFormat){Page(page:$page,perPage:24){pageInfo{hasNextPage currentPage} media(type:$type,countryOfOrigin:$country,search:$search,genre:$genre,status:$status,sort:$sort,format_not:$exclude,isAdult:false){${fields}}}}`,
    variables,
  );
  return {
    items: result.Page.media.map(entry),
    pageInfo: result.Page.pageInfo,
  };
}
export async function universeDetail(id) {
  if (/^md-[a-f0-9-]{36}$/.test(id)) {
    const book = (await md(`/manga/${id.slice(3)}?includes[]=cover_art`)).data;
    const item = sourceBook(book);
    let related = [],
      recommendations = [];
    if (/^\d+$/.test(book.attributes.links?.al || "")) {
      try {
        const linked = await universeDetail(book.attributes.links.al);
        related = linked.related;
        recommendations = linked.recommendations;
      } catch {}
    }
    return { item, related, recommendations };
  }
  if (!/^\d+$/.test(id)) throw new ApiError("Invalid media ID.", 400);
  const r = await graphql(
    `query($id:Int){Media(id:$id,isAdult:false){${fields} relations{edges{relationType node{${fields}}}} recommendations(perPage:12,sort:RATING_DESC){nodes{mediaRecommendation{${fields}}}}}}`,
    { id: Number(id) },
  );
  if (!r.Media) throw new ApiError("Title not found.", 404);
  return {
    item: entry(r.Media),
    related: r.Media.relations.edges
      .filter((e) => e.node && !e.node.isAdult)
      .map((e) => ({ ...entry(e.node), relation: e.relationType })),
    recommendations: r.Media.recommendations.nodes
      .filter((e) => e.mediaRecommendation && !e.mediaRecommendation.isAdult)
      .map((e) => entry(e.mediaRecommendation)),
  };
}
const mdCache = new Map();
export function sourceBook(book) {
  const a = book.attributes;
  const title =
    a.title.en ||
    a.altTitles?.find((t) => t.en)?.en ||
    Object.values(a.title)[0];
  const cover = book.relationships?.find((r) => r.type === "cover_art")
    ?.attributes?.fileName;
  const mode =
    { ko: "manhwa", zh: "manhua", "zh-hk": "manhua" }[a.originalLanguage] ||
    "manga";
  return {
    id: `md-${book.id}`,
    anilistId: `md-${book.id}`,
    sourceId: book.id,
    mode,
    slug: `md-${book.id}`,
    title: { english: title, romaji: Object.values(a.title)[0] },
    synonyms: (a.altTitles || []).flatMap((titles) => Object.values(titles)),
    description:
      a.description?.en ||
      Object.values(a.description || {})[0] ||
      "No synopsis available.",
    poster: cover
      ? `https://uploads.mangadex.org/covers/${book.id}/${encodeURIComponent(cover)}.256.jpg`
      : "/fallback.svg",
    year: a.year,
    status: a.status,
    genres: (a.tags || []).map((t) => t.attributes.name.en),
    chapters: null,
    provider: "MangaDex",
  };
}
export async function readingCatalog(params) {
  const mode = params.get("mode");
  if (!["manga", "manhwa", "manhua"].includes(mode))
    throw new ApiError("Invalid reading mode.", 400);
  const page = Math.min(
    416,
    Math.max(1, Math.floor(Number(params.get("page")) || 1)),
  );
  const query = new URLSearchParams({
    limit: "24",
    offset: String((page - 1) * 24),
    hasAvailableChapters: "true",
    "availableTranslatedLanguage[]": "en",
    "includes[]": "cover_art",
  });
  query.append(
    "originalLanguage[]",
    { manga: "ja", manhwa: "ko", manhua: "zh" }[mode],
  );
  if (mode === "manhua") query.append("originalLanguage[]", "zh-hk");
  query.append("contentRating[]", "safe");
  query.append("contentRating[]", "suggestive");
  if (params.get("q")) {
    query.set("title", params.get("q").slice(0, 120));
    // A title can have no MangaDex uploads but readable chapters elsewhere.
    query.delete("hasAvailableChapters");
    query.delete("availableTranslatedLanguage[]");
  }
  const sort =
    {
      rated: "rating",
      new: "createdAt",
      trending: "followedCount",
      popular: "followedCount",
    }[params.get("sort")] || "followedCount";
  query.set(`order[${sort}]`, "desc");
  const status = { FINISHED: "completed", RELEASING: "ongoing" }[
    params.get("status")
  ];
  if (status) query.append("status[]", status);
  if (params.get("genre")) {
    const tags = await md("/manga/tag");
    const tag = tags.data.find(
      (t) =>
        t.attributes.name.en.toLowerCase() ===
        params.get("genre").toLowerCase(),
    );
    if (tag) query.append("includedTags[]", tag.id);
    else
      return {
        items: [],
        pageInfo: { currentPage: page, hasNextPage: false, total: 0 },
      };
  }
  const result = await md("/manga?" + query);
  return {
    items: result.data.map(sourceBook),
    provider: "MangaDex",
    pageInfo: {
      currentPage: page,
      total: result.total,
      hasNextPage: page < 416 && page * 24 < result.total,
    },
  };
}
async function md(path) {
  const old = mdCache.get(path);
  if (old?.until > Date.now()) return old.value;
  let r;
  try {
    r = await fetch("https://api.mangadex.org" + path, {
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(
      "The chapter provider is unavailable. Please retry.",
      503,
    );
  }
  if (!r.ok)
    throw new ApiError(
      "The chapter provider is unavailable. Please retry.",
      502,
    );
  const value = await r.json();
  if (value.result !== "ok")
    throw new ApiError("Chapter provider returned an invalid response.", 502);
  if (mdCache.size > 200) mdCache.delete(mdCache.keys().next().value);
  mdCache.set(path, { value, until: Date.now() + 60000 });
  return value;
}
const titleKey = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export function matchBook(item, candidates) {
  const linked = candidates.filter(
    (c) => String(c.attributes.links?.al) === String(item.anilistId),
  );
  if (linked.length === 1) return linked[0];
  const names = new Set(
    [...Object.values(item.title), ...(item.synonyms || [])]
      .filter(Boolean)
      .map(titleKey),
  );
  const language = { manga: "ja", manhwa: "ko", manhua: "zh" }[item.mode];
  const exact = candidates.filter(
    (c) =>
      !c.attributes.links?.al &&
      c.attributes.originalLanguage === language &&
      (!c.attributes.year || !item.year || c.attributes.year === item.year) &&
      [
        ...Object.values(c.attributes.title),
        ...(c.attributes.altTitles || []).flatMap(Object.values),
      ].some((t) => names.has(titleKey(t))),
  );
  return exact.length === 1 ? exact[0] : null;
}
export function readableChapters(rows) {
  const entries = new Map();
  for (const row of rows) {
    const a = row.attributes;
    if (!a || a.externalUrl || a.isUnavailable || !(a.pages > 0)) continue;
    const key = `${a.volume || ""}:${a.chapter ?? row.id}`;
    if (!entries.has(key))
      entries.set(key, {
        id: row.id,
        number: a.chapter,
        title: `${a.chapter === null ? "Special" : `Chapter ${a.chapter}`}${a.title ? ` · ${a.title}` : ""}`,
        pageCount: a.pages,
      });
  }
  return [...entries.values()].sort(
    (a, b) => (Number(a.number) || 0) - (Number(b.number) || 0),
  );
}
export function mergeChapterSources(results) {
  const groups = new Map();
  for (const result of results) {
    // Repeated chapter numbers can mean numbering restarted in another volume.
    const counts = new Map();
    for (const c of result.chapters) {
      if (c.number != null && String(c.number).trim() !== "")
        counts.set(Number(c.number), (counts.get(Number(c.number)) || 0) + 1);
    }
    for (const c of result.chapters) {
      const numeric =
        c.number != null &&
        String(c.number).trim() !== "" &&
        Number.isFinite(Number(c.number));
      const key =
        numeric && counts.get(Number(c.number)) === 1
          ? `number:${Number(c.number)}`
          : `id:${c.id}`;
      const version = {
        ...c,
        source: result.source,
        provider: result.provider,
      };
      const existing = groups.get(key);
      if (existing) existing.alternatives.push(version);
      else groups.set(key, { ...version, alternatives: [] });
    }
  }
  return [...groups.values()].sort(
    (a, b) => (Number(a.number) || 0) - (Number(b.number) || 0),
  );
}
export async function chapters(
  id,
  language = "en",
  knownItem,
  source = "auto",
) {
  if (!["auto", "mangadex", "weebcentral"].includes(source))
    throw new ApiError("Unknown reading source.", 400);
  if (!["en", "hi", "ja", "ko", "zh", "es", "fr"].includes(language))
    throw new ApiError("Unsupported chapter language.", 400);
  const item =
    knownItem ||
    (/^md-[a-f0-9-]{36}$/.test(id)
      ? sourceBook(
          (await md(`/manga/${id.slice(3)}?includes[]=cover_art`)).data,
        )
      : (await universeDetail(id)).item);
  if (!["manga", "manhwa", "manhua"].includes(item.mode))
    throw new ApiError("This title uses video playback.", 400);
  const ids = source === "auto" ? ["mangadex", "weebcentral"] : [source];
  const results = await Promise.allSettled(
    ids.map((s) =>
      s === "mangadex"
        ? mangaDexChapters(id, language, item)
        : alternativeChapters(item, s, language),
    ),
  );
  const sources = results.map((r, i) => ({
    id: ids[i],
    count: r.status === "fulfilled" ? r.value.chapters.length : 0,
    status: r.status === "fulfilled" ? "available" : "unavailable",
  }));
  const valid = results
    .map((r, i) =>
      r.status === "fulfilled" ? { ...r.value, source: ids[i] } : null,
    )
    .filter(Boolean)
    .sort((a, b) => b.chapters.length - a.chapters.length);
  if (!valid.length)
    throw new ApiError(
      "Reading sources are unavailable. Please retry or choose another source.",
      502,
    );
  return {
    ...valid[0],
    ...(source === "auto"
      ? {
          source: "auto",
          provider: "Combined sources",
          chapters: mergeChapterSources(valid),
          availableLanguages: [
            ...new Set(valid.flatMap((r) => r.availableLanguages || [])),
          ],
          truncated: valid.some((r) => r.truncated),
        }
      : {}),
    item,
    sources,
    partial: results.some((r) => r.status === "rejected"),
  };
}
async function mangaDexChapters(id, language = "en", knownItem) {
  if (!["en", "hi", "ja", "ko", "zh", "es", "fr"].includes(language))
    throw new ApiError("Unsupported chapter language.", 400);
  const nativeBook = /^md-[a-f0-9-]{36}$/.test(id)
    ? (await md(`/manga/${id.slice(3)}?includes[]=cover_art`)).data
    : null;
  const item =
    knownItem ||
    (nativeBook ? sourceBook(nativeBook) : (await universeDetail(id)).item);
  if (!["manga", "manhwa", "manhua"].includes(item.mode))
    throw new ApiError("This title uses video playback.", 400);
  let book = nativeBook;
  for (const title of [...new Set([item.title.english, item.title.romaji])]) {
    if (book) break;
    const query = new URLSearchParams({ title, limit: "50" });
    query.append("contentRating[]", "safe");
    query.append("contentRating[]", "suggestive");
    const r = await md("/manga?" + query);
    book = matchBook(item, r.data);
    if (book) break;
  }
  if (!book) return { item, chapters: [], language };
  const rows = [];
  let total = 0;
  for (let offset = 0; offset < 10000; offset += 500) {
    const query = new URLSearchParams({
      "translatedLanguage[]": language,
      includeExternalUrl: "0",
      includeUnavailable: "0",
      limit: "500",
      offset: String(offset),
      "order[chapter]": "asc",
    });
    const feed = await md(`/manga/${book.id}/feed?${query}`);
    rows.push(...feed.data);
    total = feed.total;
    if (!feed.data.length || rows.length >= total) break;
  }
  return {
    item,
    chapters: readableChapters(rows),
    language,
    provider: "MangaDex",
    availableLanguages: book.attributes.availableTranslatedLanguages || [],
    truncated: rows.length < total,
  };
}
export async function readyToRead(mode) {
  return readingCatalog(new URLSearchParams({ mode, sort: "popular" }));
}
export async function chapterPages(id) {
  if (id.startsWith("wc_")) return alternativePages(id);
  if (!/^[a-f0-9-]{36}$/.test(id))
    throw new ApiError("Invalid chapter ID.", 400);
  const meta = await md("/chapter/" + id);
  if (meta.data.attributes.externalUrl) return { pages: [], external: true };
  const r = await md("/at-home/server/" + id);
  const base = new URL(r.baseUrl);
  if (base.protocol !== "https:")
    throw new ApiError("Invalid page source.", 502);
  return {
    pages: r.chapter.data.map(
      (name) =>
        `${base.href.replace(/\/$/, "")}/data/${r.chapter.hash}/${encodeURIComponent(name)}`,
    ),
  };
}
