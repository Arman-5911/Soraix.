import React, { useState, useEffect } from "react";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Search,
  SlidersHorizontal,
  X,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Compass,
} from "lucide-react";
import { genres } from "../services/catalog";
import { AnimeCard, Empty } from "../components";
import { useResource, NetworkState, Freshness } from "../services/live";
const labels = {
  "/movies": "Movie night starts here.",
  "/tv": "One more episode.",
  "/most-popular": "Everyone’s next obsession.",
  "/top-airing": "The story is still unfolding.",
  "/completed": "Every chapter. All yours.",
  "/recently-updated": "Fresh off the screen.",
  "/recently-added": "New worlds to discover.",
  "/filter": "Find your kind of extraordinary.",
  "/most-favorite": "Stories worth keeping.",
  "/new-releases": "A new chapter begins.",
  "/ova": "Beyond the main story.",
  "/ona": "Original stories, online.",
  "/specials": "A little something special.",
};
const fields = {
  type: ["TV", "Movie", "OVA", "ONA", "Special", "Music"],
  status: ["Finished", "Currently Airing", "Upcoming"],

  season: ["Winter", "Spring", "Summer", "Fall"],
  year: Array.from({ length: 60 }, (_, i) => new Date().getFullYear() + 1 - i),
  rating: ["9", "8", "7", "6", "5"],
};
export default function Browse() {
  const { pathname } = useLocation(),
    { genre } = useParams(),
    [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(pathname === "/filter"),
    [query, setQuery] = useState(params.get("q") || "");
  const urlQuery = params.get("q") || "";
  useEffect(() => setQuery(urlQuery), [urlQuery]);
  useEffect(() => setShowFilters(pathname === "/filter"), [pathname]);
  const selectedGenres = (params.get("genres") || "")
    .split(",")
    .filter(Boolean);
  const filters = Object.fromEntries(params);
  filters.genres = genre ? [genre, ...selectedGenres] : selectedGenres;
  if (pathname === "/movies") filters.type = "Movie";
  if (pathname === "/tv") filters.type = "TV";
  if (pathname === "/ova") filters.type = "OVA";
  if (pathname === "/ona") filters.type = "ONA";
  if (pathname === "/specials") filters.type = "Special";
  if (pathname === "/top-airing") filters.status = "Currently Airing";
  if (pathname === "/completed") filters.status = "Finished";
  if (
    ["/recently-added", "/recently-updated", "/new-releases"].includes(
      pathname,
    ) &&
    !filters.sort
  )
    filters.sort = "Release Date";
  const update = (key, value) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    p.delete("page");
    setParams(p);
  };
  if (pathname === "/most-favorite" && !filters.sort)
    filters.sort = "Most Favorite";
  if (pathname === "/recently-updated" && !params.get("sort"))
    filters.sort = "Recently Updated";
  if (pathname === "/recently-added" && !params.get("sort"))
    filters.sort = "Recently Added";
  const queryParams = new URLSearchParams({
    ...filters,
    genres: filters.genres.join(","),
  });
  const live = useResource(
    pathname === "/genres" ? null : "/catalog?" + queryParams.toString(),
  );
  const results = live.data?.items || [];
  const totalPages = live.data?.pageInfo?.lastPage || 1;
  const page = Math.max(1, parseInt(params.get("page")) || 1);
  const hasNext = !!live.data?.pageInfo?.hasNextPage;
  const slice = results;
  const pageNumbers = Array.from({ length: 7 }, (_, i) => page - 3 + i).filter(
    (n) => n > 0 && n <= Math.max(page + (hasNext ? 1 : 0), totalPages),
  );
  const setPage = (p) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    setParams(next);
  };
  if (pathname === "/genres")
    return (
      <div className="page">
        <div className="page-intro">
          <span className="eyebrow">EXPLORE YOUR CURIOSITY</span>
          <h1>A world for every mood.</h1>
          <p>From quiet moments to impossible adventures. Where will you go?</p>
        </div>
        <div className="genre-directory">
          {genres.map((g, i) => (
            <Link
              style={{ "--genre-hue": `${245 + i * 13}` }}
              to={"/genre/" + g.toLowerCase()}
              key={g}
            >
              <span className="genre-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Compass />
              <h2>{g}</h2>
              <span>
                Explore titles <ArrowRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  return (
    <div className="page browse-page">
      <div className="page-intro">
        <span className="eyebrow">THE SORAIX COLLECTION</span>
        <h1>
          {genre
            ? genre.replace(/\b\w/g, (c) => c.toUpperCase()) + " anime"
            : pathname === "/search"
              ? `Search results for “${params.get("q") || ""}”`
              : labels[pathname] || "Discover something new."}
        </h1>
        <p>Your next favorite story is closer than you think.</p>
      </div>
      <form
        className="catalog-search"
        onSubmit={(e) => {
          e.preventDefault();
          update("q", query);
        }}
      >
        <Search size={20} />
        <input
          aria-label="Search catalogue"
          placeholder="Search anime, Japanese titles, genres..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="button primary small" type="submit">
          Search <ArrowRight size={16} />
        </button>
      </form>
      <div className="collection-types">
        {[
          ["All anime", "/filter"],
          ["TV Series", "/tv"],
          ["Movies", "/movies"],
          ["OVA", "/ova"],
          ["ONA", "/ona"],
          ["Specials", "/specials"],
        ].map(([label, url]) => (
          <Link className={pathname === url ? "active" : ""} to={url} key={url}>
            {label}
          </Link>
        ))}
      </div>
      <div className="catalog-toolbar">
        <span>
          <b>{live.data?.pageInfo?.total ?? "?"}</b> matching anime
        </span>
        <div>
          <button
            className={
              "button secondary small " + (showFilters ? "chosen" : "")
            }
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={15} /> Filters
          </button>
          <select
            aria-label="Sort anime"
            value={filters.sort || "Most Popular"}
            onChange={(e) => update("sort", e.target.value)}
          >
            {[
              "Default",
              "Most Popular",
              "Trending",
              "Most Favorite",
              "Name A-Z",
              "Score",
              "Release Date",
              "Recently Updated",
              "Recently Added",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      {pathname === "/most-popular" && (
        <div className="period-tabs">
          <span>Live rankings</span>
          {[
            ["Trending", "Trending"],
            ["Top rated", "Score"],
            ["Favorites", "Most Favorite"],
            ["All time", "Most Popular"],
          ].map(([t, s]) => (
            <button
              className={params.get("period") === t ? "selected" : ""}
              key={t}
              onClick={() => {
                const p = new URLSearchParams(params);
                p.set("period", t);
                p.set("sort", s);
                p.delete("page");
                setParams(p);
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {showFilters && (
        <section className="filter-panel" aria-label="Advanced filters">
          <div className="filter-fields">
            {Object.entries(fields).map(([key, options]) => (
              <label key={key}>
                {key === "rating" ? "Minimum score" : key}
                <select
                  aria-label={key === "rating" ? "Minimum score" : key}
                  value={params.get(key) || ""}
                  onChange={(e) => update(key, e.target.value)}
                >
                  <option value="">Any {key}</option>
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                      {key === "rating" ? "+" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="filter-genres">
            <span>Genres</span>
            <div>
              {genres.map((g) => (
                <button
                  key={g}
                  className={selectedGenres.includes(g) ? "selected" : ""}
                  onClick={() =>
                    update(
                      "genres",
                      (selectedGenres.includes(g)
                        ? selectedGenres.filter((x) => x !== g)
                        : [...selectedGenres, g]
                      ).join(","),
                    )
                  }
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-bottom">
            <p>Filters search the live catalogue.</p>
            <button
              onClick={() => {
                setParams({});
                setQuery("");
              }}
            >
              Reset filters
            </button>
            <button
              className="button primary small"
              onClick={() => setShowFilters(false)}
            >
              Show {results.length} results <ArrowRight size={15} />
            </button>
          </div>
          <small className="muted">
            Language availability is listed by each official streaming provider.
          </small>
        </section>
      )}
      {[...params].some(([k]) => !["page", "sort", "period"].includes(k)) && (
        <div className="filter-chips">
          {[...params]
            .filter(([k]) => !["page", "sort", "period"].includes(k))
            .map(([k, v]) => (
              <button key={k} onClick={() => update(k, "")}>
                {k}: {v}
                <X size={13} />
              </button>
            ))}
          <button
            onClick={() => {
              setParams({});
              setQuery("");
            }}
          >
            Clear all
          </button>
        </div>
      )}
      <Freshness resource={live} />
      {live.loading || live.error ? (
        <NetworkState resource={live} />
      ) : slice.length ? (
        <div className="anime-grid catalogue-grid">
          {slice.map((a) => (
            <AnimeCard a={a} key={a.id} />
          ))}
        </div>
      ) : (
        <Empty
          title="No anime found."
          text="Try another keyword or broaden your filters."
        >
          <button
            className="button primary"
            onClick={() => {
              setParams({});
              setQuery("");
            }}
          >
            Reset search
          </button>
          <Link className="button secondary" to="/genres">
            Browse genres
          </Link>
        </Empty>
      )}
      {!live.loading && !live.error && (page > 1 || hasNext) && (
        <nav className="pagination" aria-label="Catalogue pages">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={17} />
          </button>
          {pageNumbers.map((n) => (
            <button
              className={n === page ? "active" : ""}
              aria-current={n === page ? "page" : undefined}
              onClick={() => setPage(n)}
              key={n}
            >
              {n}
            </button>
          ))}
          <button
            disabled={!hasNext}
            onClick={() => setPage(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={17} />
          </button>
        </nav>
      )}
    </div>
  );
}
