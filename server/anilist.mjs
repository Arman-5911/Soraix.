const endpoint = "https://graphql.anilist.co";
const cache = new Map();
const pending = new Map();
let nextRequest = 0;
let cooldownUntil = 0;
export class ApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}
export async function graphql(query, variables = {}, ttl = 120_000) {
  const key = JSON.stringify([query, variables]);
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return saved.value;
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    if (Date.now() < cooldownUntil)
      throw new ApiError(
        "The anime provider is busy. Please retry in a minute.",
        429,
      );
    const start = Math.max(Date.now(), nextRequest);
    nextRequest = start + 2200;
    if (start - Date.now() > 20_000)
      throw new ApiError(
        "Too many catalogue requests. Please try again shortly.",
        429,
      );
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, start - Date.now())),
    );
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ApiError(
        "The live anime provider could not be reached. Please retry.",
        503,
      );
    }
    if (response.status === 429) {
      cooldownUntil =
        Date.now() +
        Math.min(300, Number(response.headers.get("retry-after")) || 60) * 1000;
      throw new ApiError(
        "The anime provider is rate-limiting requests. Please retry in a minute.",
        429,
      );
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError("The anime provider returned an invalid response.");
    }
    if (!response.ok || payload.errors?.length) {
      const missing =
        response.status === 404 ||
        payload.errors?.some((e) => e.status === 404);
      throw new ApiError(
        missing
          ? "This anime could not be found."
          : "The anime provider could not complete this request.",
        missing ? 404 : 502,
      );
    }
    const value = { ...payload.data, fetchedAt: new Date().toISOString() };
    if (cache.size >= 500) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: Date.now() + ttl });
    return value;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}
export const mediaFields = `id idMal type countryOfOrigin title { english romaji native } synonyms description(asHtml:false) coverImage { extraLarge large color } bannerImage format status startDate {year month day} season seasonYear duration episodes averageScore popularity favourites trending updatedAt genres isAdult studios(isMain:true) {nodes {name}} nextAiringEpisode { episode airingAt } siteUrl`;
export function safeUrl(value) {
  try {
    const u = new URL(value);
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
      return null;
    u.protocol = "https:";
    return u.href;
  } catch {
    return null;
  }
}
export function normalize(media) {
  const id = media.idMal || `al${media.id}`;
  const english =
    media.title?.english || media.title?.romaji || "Untitled anime";
  const date = media.startDate;
  const releaseDate = date?.year
    ? `${date.year}-${String(date.month || 1).padStart(2, "0")}-${String(date.day || 1).padStart(2, "0")}`
    : null;
  const description = (media.description || "No synopsis is available yet.")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  const episodes = (media.streamingEpisodes || [])
    .map((e, i) => ({
      id: `${id}-${i}`,
      number:
        Number(e.title?.match(/(?:Episode|Ep\.?)[\s-]*(\d+)/i)?.[1]) || null,
      title: e.title || "Watch episode",
      thumbnail: safeUrl(e.thumbnail),
      url: safeUrl(e.url),
      site: e.site || "Official provider",
    }))
    .filter((e) => e.url);
  return {
    id,
    anilistId: media.id,
    country: media.countryOfOrigin,
    playableEpisodes: 0,
    slug:
      english
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      id,
    title: {
      english,
      romaji: media.title?.romaji || english,
      native: media.title?.native || "",
    },
    synonyms: media.synonyms || [],
    description,
    poster:
      safeUrl(media.coverImage?.extraLarge || media.coverImage?.large) ||
      "/fallback.svg",
    banner: safeUrl(media.bannerImage),
    color: media.coverImage?.color,
    type:
      { MOVIE: "Movie", TV_SHORT: "TV", SPECIAL: "Special", MUSIC: "Music" }[
        media.format
      ] ||
      media.format ||
      "TV",
    status:
      {
        RELEASING: "Currently Airing",
        NOT_YET_RELEASED: "Upcoming",
        FINISHED: "Finished",
        CANCELLED: "Cancelled",
        HIATUS: "On hiatus",
      }[media.status] || "Unknown",
    releaseDate,
    year: media.seasonYear || date?.year || null,
    season: media.season?.toLowerCase() || null,
    duration: media.duration ? `${media.duration} min` : "Unknown",
    totalEpisodes: media.episodes || null,
    subEpisodes: null,
    dubEpisodes: null,
    genres: media.genres || [],
    studios: media.studios?.nodes?.map((s) => s.name) || [],
    producers: [],
    score: media.averageScore ? media.averageScore / 10 : null,
    popularity: media.popularity || 0,
    favourites: media.favourites || 0,
    trending: media.trending || 0,
    updatedAt: media.updatedAt,
    nextAiringEpisode: media.nextAiringEpisode,
    sourceUrl: safeUrl(media.siteUrl),
    streamingEpisodes: episodes,
    externalLinks: (media.externalLinks || [])
      .filter((e) => e.type === "STREAMING" && safeUrl(e.url))
      .map((e) => ({
        site: e.site,
        url: safeUrl(e.url),
        language: e.language,
      })),
    trailer:
      media.trailer?.site === "youtube" && /^[\w-]{11}$/.test(media.trailer.id)
        ? { id: media.trailer.id, site: "youtube" }
        : null,
    characters:
      media.characters?.nodes?.map((c) => ({
        id: c.id,
        name: c.name.full,
        image: safeUrl(c.image?.medium),
      })) || [],
  };
}
export const genres = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
];
export function browseVariables(params) {
  const num = (key, min, max) => {
    const x = Number(params.get(key));
    return params.has(key) && Number.isFinite(x) && x >= min && x <= max
      ? x
      : undefined;
  };
  const sortMap = {
    "Most Popular": "POPULARITY_DESC",
    "Most Favorite": "FAVOURITES_DESC",
    Trending: "TRENDING_DESC",
    "Name A-Z": "TITLE_ROMAJI",
    Score: "SCORE_DESC",
    "Release Date": "START_DATE_DESC",
    "Recently Updated": "UPDATED_AT_DESC",
    "Recently Added": "ID_DESC",
    Default: "POPULARITY_DESC",
  };
  const format = {
    TV: "TV",
    Movie: "MOVIE",
    OVA: "OVA",
    ONA: "ONA",
    Special: "SPECIAL",
    Music: "MUSIC",
  }[params.get("type")];
  const status = {
    Finished: "FINISHED",
    "Currently Airing": "RELEASING",
    Upcoming: "NOT_YET_RELEASED",
  }[params.get("status")];
  const selected = (params.get("genres") || "")
    .split(",")
    .filter(Boolean)
    .map((g) => genres.find((x) => x.toLowerCase() === g.toLowerCase()));
  if (selected.some((g) => !g))
    throw new ApiError("Choose a supported genre.", 400);
  const season = params.get("season")?.toUpperCase();
  const rating = num("rating", 0, 10);
  return {
    page: Math.floor(num("page", 1, 5000) || 1),
    perPage: Math.floor(num("limit", 1, 50) || 18),
    search: params.get("q")?.trim().slice(0, 150) || undefined,
    format,
    status,
    season: ["WINTER", "SPRING", "SUMMER", "FALL"].includes(season)
      ? season
      : undefined,
    year: num("year", 1940, new Date().getFullYear() + 5),
    genres: selected.length ? selected : undefined,
    minScore: rating == null ? undefined : Math.ceil(rating * 10) - 1,
    sort: [sortMap[params.get("sort")] || "POPULARITY_DESC"],
  };
}
export async function browse(params) {
  const variables = browseVariables(params);
  if (variables.search && !variables.genres) {
    const genre = genres.find(
      (g) => g.toLowerCase() === variables.search.toLowerCase(),
    );
    if (genre) {
      variables.genres = [genre];
      delete variables.search;
    }
  }
  const result = await graphql(
    `query($page:Int,$perPage:Int,$search:String,$format:MediaFormat,$status:MediaStatus,$season:MediaSeason,$year:Int,$genres:[String],$minScore:Int,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{currentPage hasNextPage total lastPage} media(type:ANIME,isAdult:false,search:$search,format:$format,status:$status,season:$season,seasonYear:$year,genre_in:$genres,averageScore_greater:$minScore,sort:$sort){${mediaFields}}}}`,
    variables,
  );
  return {
    items: result.Page.media.map(normalize),
    pageInfo: result.Page.pageInfo,
    fetchedAt: result.fetchedAt,
  };
}
export async function home() {
  const result = await graphql(
    `query { trending:Page(perPage:12){media(type:ANIME,isAdult:false,sort:TRENDING_DESC){${mediaFields}}} popular:Page(perPage:15){media(type:ANIME,isAdult:false,sort:POPULARITY_DESC){${mediaFields}}} airing:Page(perPage:10){media(type:ANIME,isAdult:false,status:RELEASING,sort:TRENDING_DESC){${mediaFields}}} updated:Page(perPage:12){media(type:ANIME,isAdult:false,sort:UPDATED_AT_DESC){${mediaFields}}} movies:Page(perPage:6){media(type:ANIME,isAdult:false,format:MOVIE,sort:POPULARITY_DESC){${mediaFields}}} rated:Page(perPage:10){media(type:ANIME,isAdult:false,sort:SCORE_DESC){${mediaFields}}} completed:Page(perPage:6){media(type:ANIME,isAdult:false,status:FINISHED,sort:POPULARITY_DESC){${mediaFields}}} }`,
  );
  return Object.fromEntries([
    ...[
      "trending",
      "popular",
      "airing",
      "updated",
      "movies",
      "rated",
      "completed",
    ].map((key) => [key, result[key].media.map(normalize)]),
    ["fetchedAt", result.fetchedAt],
  ]);
}
export function parseAnimeId(value) {
  const id = String(value).match(/(?:^|-)(al\d+|\d+)$/)?.[1];
  if (
    !id ||
    Number(id.replace("al", "")) > 2147483647 ||
    Number(id.replace("al", "")) < 1
  )
    throw new ApiError("Invalid anime identifier.", 400);
  return id.startsWith("al")
    ? { id: Number(id.slice(2)) }
    : { mal: Number(id) };
}
export async function detail(value) {
  const result = await graphql(
    `query($id:Int,$mal:Int){Media(id:$id,idMal:$mal,type:ANIME,isAdult:false){${mediaFields} externalLinks{site url type language} streamingEpisodes{title thumbnail url site} trailer{id site} characters(perPage:8,role:MAIN,sort:RELEVANCE){nodes{id name{full} image{medium}}} relations{edges{relationType node{${mediaFields}}}} recommendations(perPage:12,sort:RATING_DESC){nodes{mediaRecommendation{${mediaFields}}}}}}`,
    parseAnimeId(value),
    300_000,
  );
  const raw = result.Media;
  if (!raw) throw new ApiError("This anime could not be found.", 404);
  return {
    anime: normalize(raw),
    related: raw.relations.edges
      .filter((e) => e.node && !e.node.isAdult && e.node.type === "ANIME")
      .map((e) => ({ ...normalize(e.node), relationType: e.relationType })),
    recommendations: raw.recommendations.nodes
      .filter(
        (n) =>
          n.mediaRecommendation &&
          !n.mediaRecommendation.isAdult &&
          n.mediaRecommendation.type === "ANIME",
      )
      .map((n) => normalize(n.mediaRecommendation)),
    fetchedAt: result.fetchedAt,
  };
}
export async function schedule(params) {
  const from = Number(params.get("from")),
    to = Number(params.get("to"));
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 1 ||
    to <= from ||
    to - from > 8 * 86400
  )
    throw new ApiError(
      "Choose a valid schedule interval of up to one week.",
      400,
    );
  let page = 1,
    more = true,
    rows = [],
    fetchedAt;
  while (more && page <= 20) {
    const r = await graphql(
      `query($from:Int,$to:Int,$page:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage} airingSchedules(airingAt_greater:$from,airingAt_lesser:$to,sort:TIME){id episode airingAt media{${mediaFields}}}}}`,
      { from: from - 1, to, page },
      60_000,
    );
    rows.push(
      ...r.Page.airingSchedules
        .filter((x) => x.media && !x.media.isAdult)
        .map((x) => ({
          id: x.id,
          episode: x.episode,
          airingAt: x.airingAt,
          anime: normalize(x.media),
        })),
    );
    more = r.Page.pageInfo.hasNextPage;
    fetchedAt = r.fetchedAt;
    page++;
  }
  return { items: rows, fetchedAt, truncated: more };
}
