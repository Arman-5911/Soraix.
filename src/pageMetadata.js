const descriptions = {
  movies: "Discover anime movies on SoraiX. Compare ratings, explore genres and find your next film.",
  tv: "Explore anime TV series on SoraiX, from completed stories to currently airing shows.",
  "top-airing": "Explore currently airing anime on SoraiX and follow the shows releasing new episodes.",
  "most-popular": "Browse popular anime on SoraiX and discover series and movies for your watchlist.",
  completed: "Find completed anime on SoraiX and choose your next finished series to watch.",
  schedule: "Follow upcoming anime broadcasts with the SoraiX release schedule.",
  genres: "Explore anime by genre on SoraiX, including action, comedy, fantasy and more.",
  filter: "Search and filter the SoraiX anime catalogue by genre, year, format, rating and release status.",
  watchable: "Find listed episodes on SoraiX with SUB, English DUB and Hindi DUB availability from connected sources.",
};
export function pageDescription(pathname, mode = "anime") {
  const parts = pathname.split("/").filter(Boolean);
  const readable = value => value.replaceAll("-", " ");
  if (parts[0] === "genre" && parts[1]) return `Explore ${readable(parts[1])} ${mode} on SoraiX. Browse titles, compare ratings and discover stories in this genre.`;
  if (mode !== "anime") return `Explore ${mode} on SoraiX${parts.length ? ` — ${readable(parts[0])}` : ""}. Discover titles, related adaptations and keep your progress in your local library.`;
  return descriptions[parts[0]] || (parts.length
    ? `${readable(parts[0])} on SoraiX. Explore anime and manage your local viewing experience.`
    : "Discover anime series and movies on SoraiX. Explore genres, track broadcasts and save your next favorite story.");
}
