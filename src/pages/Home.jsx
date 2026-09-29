import GlassWidgets from "../GlassWidgets";
import { WatchableCollection } from "./Watchable";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Star,
  CalendarDays,
  Clock,
  Flame,
  Compass,
  Bookmark,
  Sparkles,
} from "lucide-react";
import { useApp } from "../store";
import { Section, IconButton, Poster, Badges } from "../components";
import {
  anime,
  homeData,
  genres,
  getSpotlightAnime,
  getTrendingAnime,
  getTopAiring,
  getPopularAnime,
  getRecentlyUpdated,
  getAnimeDetails,
} from "../services/catalog";
import {
  useResource,
  useSavedTitles,
  NetworkState,
  Freshness,
} from "../services/live";
export function ContinueWatching() {
  const { history, setHistory, title } = useApp();
  useSavedTitles(history.slice(0, 4).map((h) => h.id));
  const entries = history.filter((h) => getAnimeDetails(h.id)).slice(0, 4);
  if (!entries.length) return null;
  return (
    <section className="continue-section">
      <div className="section-head">
        <div>
          <h2>Pick up where you left off</h2>
          <p>Your next chapter is waiting.</p>
        </div>
        <Link to="/history">
          Watch history <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="continue-grid">
        {entries.map((h) => {
          const a = getAnimeDetails(h.id);
          return (
            <article className="continue-card" key={h.id}>
              <Link to={`/watch/${a.slug}?ep=${h.episode}`}>
                <img src={a.banner || a.poster} alt={title(a)} />
                <span className="continue-play">
                  <Play size={22} fill="currentColor" />
                </span>
                <div className="continue-copy">
                  <strong>{title(a)}</strong>
                  <small>
                    Episode {h.episode} ·{" "}
                    {Math.max(0, Math.ceil((h.duration - h.position) / 60))} min
                    left
                  </small>
                </div>
                <div className="progress">
                  <i
                    style={{
                      width: `${h.duration ? Math.min(100, (h.position / h.duration) * 100) : 0}%`,
                    }}
                  />
                </div>
              </Link>
              <button
                onClick={() =>
                  setHistory((v) => v.filter((x) => x.id !== h.id))
                }
                aria-label={"Remove " + title(a) + " from history"}
              >
                ×
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
function Hero() {
  const slides = getSpotlightAnime();
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false);
  const { title, watchlist, toggleWatchlist } = useApp();
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7500);
    return () => clearInterval(t);
  }, [paused, slides.length]);
  const a = slides[index];
  if (!a) return null;
  const change = (delta) => {
    setIndex((i) => (i + delta + slides.length) % slides.length);
    setPaused(true);
  };
  const frieren = a.id === 52991;
  return (
    <section
      className="hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      aria-label="Featured anime"
    >
      <div
        key={a.id}
        className="hero-art"
        style={{ backgroundImage: `url("${a.banner || a.poster}")` }}
      />
      <div className="hero-gradient" />
      <div className="hero-grain" />
      <div className="hero-content" key={"text" + a.id}>
        <div className="spotlight-label">
          <span>✦</span> THE SPOTLIGHT <i /> <span>0{index + 1}</span>
        </div>
        <div className="hero-kicker">
          {frieren
            ? "BEYOND THE JOURNEY. BEYOND TIME."
            : a.genres.slice(0, 3).join(" · ").toUpperCase()}
        </div>
        <h1>
          {frieren && isEnglish(title(a)) ? (
            <>
              <span>
                Frieren<span className="title-period">.</span>
              </span>
              <span className="hero-subtitle">Beyond Journey’s End</span>
            </>
          ) : (
            title(a)
          )}
        </h1>
        <div className="hero-meta">
          <span className="hero-rating">
            <Star size={14} fill="currentColor" /> {a.score}
          </span>
          <i />
          <span>{a.type === "TV" ? "TV Series" : a.type}</span>
          <i />
          <span>{a.year}</span>
          <i />
          <span>{a.totalEpisodes || "TBA"} Episodes</span>
        </div>
        <p className="hero-description">
          {frieren
            ? "The adventure ends. A new journey begins. An elven mage discovers what it means to live, long after the heroes have saved the world."
            : a.description.slice(0, 185) + "…"}
        </p>
        <div className="hero-genres">
          {a.genres.slice(0, 3).map((g) => (
            <Link to={"/genre/" + g.toLowerCase()} key={g}>
              {g}
            </Link>
          ))}
        </div>
        <div className="hero-buttons">
          <Link className="button primary" to={"/watch/" + a.slug}>
            <Play size={17} fill="currentColor" />{" "}
            {a.playableEpisodes ? "Watch now" : "Check availability"}{" "}
            <ArrowRight size={17} />
          </Link>
          <Link className="button glass" to={"/anime/" + a.slug}>
            View details <ChevronRight size={17} />
          </Link>
          <IconButton
            label={
              watchlist.includes(a.id)
                ? "Remove from watchlist"
                : "Add to watchlist"
            }
            onClick={() => toggleWatchlist(a.id)}
          >
            {watchlist.includes(a.id) ? (
              <Check size={21} />
            ) : (
              <Plus size={21} />
            )}
          </IconButton>
        </div>
      </div>
      <div className="hero-bottom">
        <div className="hero-pagination">
          {slides.map((s, i) => (
            <button
              key={s.id}
              className={i === index ? "active" : ""}
              aria-label={"Show spotlight " + (i + 1)}
              onClick={() => {
                setIndex(i);
                setPaused(true);
              }}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <i />
            </button>
          ))}
        </div>
        <span className="hero-caption">
          {frieren
            ? "Some journeys stay with you forever."
            : "Every story opens a new world."}
        </span>
        <div className="hero-arrows">
          <IconButton label="Previous spotlight" onClick={() => change(-1)}>
            <ChevronLeft size={19} />
          </IconButton>
          <IconButton label="Next spotlight" onClick={() => change(1)}>
            <ChevronRight size={19} />
          </IconButton>
        </div>
      </div>
      <div className="hero-watermark">ソライ</div>
    </section>
  );
}
const isEnglish = (t) => t.startsWith("Frieren");
function TopTen() {
  const [tab, setTab] = useState("Trending");
  const { title } = useApp();
  const list =
    tab === "Trending"
      ? getTrendingAnime()
      : tab === "Popular"
        ? getPopularAnime()
        : homeData.rated || [];
  return (
    <aside className="top-ten">
      <div className="section-head">
        <h2>
          Top 10 <Flame size={19} />
        </h2>
        <span className="tiny-muted">ANILIST LIVE</span>
      </div>
      <div className="segmented">
        {["Trending", "Popular", "Rated"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "active" : ""}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="top-list">
        {list.slice(0, 10).map((a, i) => (
          <Link to={"/anime/" + a.slug} key={a.id}>
            <span className={"top-rank " + (i < 3 ? "accent" : "")}>
              {String(i + 1).padStart(2, "0")}
              {i < 3 && <i />}
            </span>
            <Poster a={a} />
            <div>
              <strong>{title(a)}</strong>
              <span className="top-meta">
                {a.type} <i /> <Star size={10} fill="currentColor" />{" "}
                {a.score || "—"}
              </span>
              <Badges a={a} />
            </div>
          </Link>
        ))}
      </div>
      <Link className="aside-view" to="/most-popular">
        Explore the full ranking <ArrowRight size={14} />
      </Link>
    </aside>
  );
}
function GenrePanel() {
  return (
    <div className="genre-panel">
      <div className="section-head">
        <h2>Find your vibe</h2>
        <Compass size={19} />
      </div>
      <p>A genre for every mood.</p>
      <div className="genre-cloud">
        {genres.slice(0, 15).map((g, i) => (
          <Link
            key={g}
            className={"genre-color-" + (i % 4)}
            to={"/genre/" + g.toLowerCase()}
          >
            {g}
          </Link>
        ))}
      </div>
      <Link className="aside-view" to="/genres">
        Explore all genres <ArrowRight size={14} />
      </Link>
    </div>
  );
}
export default function Home() {
  const [tab, setTab] = useState("All");
  const live = useResource("/home", { interval: 120000 });
  if (!live.data) return <NetworkState resource={live} />;
  const updated = getRecentlyUpdated().filter(
    (a) =>
      tab === "All" ||
      (tab === "TV Series" ? a.type === "TV" : a.type === "Movie"),
  );
  return (
    <>
      <Hero />
      <GlassWidgets />
      <div className="home-content">
        <Freshness resource={live} />
        {live.error && <NetworkState resource={live} compact />}
      </div>
      <div className="home-content">
        <div className="discovery-strip">
          <div>
            <span className="strip-icon">
              <Sparkles size={17} />
            </span>
            <span>Your next obsession starts here.</span>
            <span className="muted">Fresh worlds. Unforgettable stories.</span>
          </div>
          <Link to="/filter">
            Find your anime <ArrowUpRight size={15} />
          </Link>
        </div>
        <WatchableCollection />
        <Section
          name="Trending now"
          subtitle="The stories everyone’s talking about."
          items={getTrendingAnime()}
          ranked
          to="/most-popular"
        />
        <ContinueWatching />
        <div className="home-columns">
          <div className="home-main">
            <div className="updates-head">
              <div>
                <h2>
                  Fresh off the screen
                  <span className="heading-dot" />
                </h2>
                <p>Fresh details from the anime world.</p>
              </div>
              <div className="small-tabs">
                {["All", "TV Series", "Movies"].map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "active" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Section
              name="Recently updated"
              items={updated.slice(0, 10)}
              to="/recently-updated"
            />
            <Link className="schedule-banner" to="/schedule">
              <div className="schedule-banner-icon">
                <CalendarDays size={31} />
              </div>
              <div>
                <span>NEVER MISS A MOMENT</span>
                <h3>Your week, in anime.</h3>
                <p>Keep up with the stories you love.</p>
              </div>
              <span className="schedule-link">
                View schedule <ArrowRight size={16} />
              </span>
            </Link>
            <Section
              name="The essentials"
              subtitle="Extraordinary stories. A place on every watchlist."
              items={getPopularAnime().slice(0, 5)}
              to="/most-popular"
            />
            <Section
              name="Currently on air"
              subtitle="Follow the story as it unfolds."
              items={getTopAiring().slice(0, 5)}
              to="/top-airing"
            />
            <Section
              name="A story, complete"
              subtitle="Your next all-night adventure."
              items={(homeData.completed || []).slice(0, 5)}
              to="/completed"
            />
          </div>
          <div className="home-sidebar">
            <TopTen />
            <GenrePanel />
            <div className="watchlist-promo">
              <Bookmark size={24} />
              <span>YOUR OWN LITTLE UNIVERSE</span>
              <h3>
                Good stories.
                <br />
                Saved for later.
              </h3>
              <p>
                Your watchlist goes wherever your curiosity takes you. No
                account needed.
              </p>
              <Link className="button secondary" to="/watchlist">
                Open my watchlist <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </div>
        <Section
          name="Movie night, sorted"
          subtitle="Big feelings. Beautiful worlds. One sitting."
          items={homeData.movies || []}
          to="/movies"
        />
        <div className="closing-banner">
          <span>✦</span>
          <div>
            <h2>There’s always another world to discover.</h2>
            <p>Explore the catalogue. Find the story that finds you.</p>
          </div>
          <Link className="button secondary" to="/filter">
            Explore all anime <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </>
  );
}
