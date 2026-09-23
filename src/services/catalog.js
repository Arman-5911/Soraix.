// A live registry populated only by provider responses and previously saved titles.
export const anime = [];
export let homeData = {};
const records = new Map();
try {
  for (const a of JSON.parse(
    localStorage.getItem("soraix-catalogue-cache") || "[]",
  ))
    if (a?.id && a?.title?.english) {
      records.set(String(a.id), a);
      anime.push(a);
    }
} catch {}
export function remember(a) {
  if (!a?.id || !a?.title?.english) return;
  const old = records.get(String(a.id));
  const next = { ...old, ...a };
  if (old?.details && !a.details)
    for (const key of [
      "streamingEpisodes",
      "externalLinks",
      "characters",
      "trailer",
      "details",
      "recommendations",
      "related",
    ])
      next[key] = old[key];
  records.set(String(a.id), next);
  const index = anime.findIndex((x) => String(x.id) === String(a.id));
  if (index >= 0) anime[index] = next;
  else anime.push(next);
}
export function hydrate(value) {
  if (Array.isArray(value)) {
    value.forEach(hydrate);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (value.id && value.title?.english) {
    remember(value);
    return;
  }
  if (value.trending && value.popular) homeData = value;
  for (const item of Object.values(value)) hydrate(item);
}
export function persistTitle(id) {
  const item = getAnimeDetails(id);
  if (!item) return;
  try {
    const saved = JSON.parse(
      localStorage.getItem("soraix-catalogue-cache") || "[]",
    );
    const {
      streamingEpisodes,
      externalLinks,
      characters,
      trailer,
      details,
      recommendations,
      related,
      ...summary
    } = item;
    localStorage.setItem(
      "soraix-catalogue-cache",
      JSON.stringify(
        [summary, ...saved.filter((x) => String(x.id) !== String(id))].slice(
          0,
          300,
        ),
      ),
    );
  } catch {}
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
export const getAnimeDetails = (id) =>
  records.get(String(id)) || anime.find((a) => a.slug === id);
export const getPopularAnime = () => homeData.popular || [];
export const getTrendingAnime = () => homeData.trending || [];
export const getSpotlightAnime = () =>
  getTrendingAnime()
    .filter((a) => a.banner)
    .slice(0, 4);
export const getTopAiring = () => homeData.airing || [];
export const getRecentlyUpdated = () => homeData.updated || [];
export const getRecentlyAdded = () => homeData.updated || [];
export const getRecommendations = (id) =>
  getAnimeDetails(id)?.recommendations || [];
export const getEpisodes = (id) => getAnimeDetails(id)?.streamingEpisodes || [];
