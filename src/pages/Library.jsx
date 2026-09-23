import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Bookmark, History, Trash2, Play } from "lucide-react";
import { getAnimeDetails } from "../services/catalog";
import { useApp } from "../store";
import { AnimeCard, Empty, Poster } from "../components";
import { useSavedTitles, NetworkState } from "../services/live";
export default function Library() {
  const isHistory = useLocation().pathname === "/history";
  const { watchlist, setWatchlist, history, setHistory, title, notify } =
    useApp();
  const live = useSavedTitles(isHistory ? history.map((h) => h.id) : watchlist);
  const items = (isHistory ? history : watchlist).filter((x) =>
    getAnimeDetails(isHistory ? x.id : x),
  );
  return (
    <div className="page library-page">
      <div className="page-intro">
        <span className="eyebrow">YOUR OWN LITTLE UNIVERSE</span>
        <h1>{isHistory ? "The journey so far." : "Good stories, saved."}</h1>
        <p>
          {isHistory
            ? "Pick up right where your adventure paused."
            : "A little collection of worlds you want to get lost in."}
        </p>
      </div>
      <div className="library-tabs">
        <Link className={!isHistory ? "active" : ""} to="/watchlist">
          <Bookmark size={17} /> My watchlist <span>{watchlist.length}</span>
        </Link>
        <Link className={isHistory ? "active" : ""} to="/history">
          <History size={17} /> Watch history <span>{history.length}</span>
        </Link>
        {items.length > 0 && (
          <button
            onClick={() => {
              isHistory ? setHistory([]) : setWatchlist([]);
              notify(isHistory ? "Watch history cleared" : "Watchlist cleared");
            }}
          >
            <Trash2 size={15} /> Clear {isHistory ? "history" : "watchlist"}
          </button>
        )}
      </div>
      <div className="local-note">
        <span>✦</span> Your collection is saved on this browser. No account
        needed.
      </div>
      {(live.loading || live.error) && <NetworkState resource={live} compact />}
      {!items.length && !live.loading && !live.error ? (
        <Empty
          icon={isHistory ? History : Bookmark}
          title={
            isHistory
              ? "Every adventure starts somewhere."
              : "Your SoraiX Watchlist is empty."
          }
          text={
            isHistory
              ? "Start watching an episode and it will appear here."
              : "Find an anime and tap the plus to save it here."
          }
        >
          <Link className="button primary" to="/filter">
            Discover your next story
          </Link>
        </Empty>
      ) : isHistory ? (
        <div className="history-list">
          {items.map((h) => {
            const a = getAnimeDetails(h.id);
            return (
              <article key={h.id}>
                <Link to={"/watch/" + a.slug + "?ep=" + h.episode}>
                  <Poster a={a} />
                </Link>
                <div>
                  <Link to={"/anime/" + a.slug}>
                    <h3>{title(a)}</h3>
                  </Link>
                  <p>
                    Episode {h.episode} ·{" "}
                    {new Date(h.timestamp).toLocaleDateString()} ·{" "}
                    {Math.max(0, Math.ceil((h.duration - h.position) / 60))} min
                    left
                  </p>
                  <div className="progress">
                    <i
                      style={{
                        width: `${h.duration ? Math.min(100, (h.position / h.duration) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <Link
                  className="button primary small"
                  to={"/watch/" + a.slug + "?ep=" + h.episode}
                >
                  <Play size={14} /> Continue
                </Link>
                <button
                  className="icon-button"
                  aria-label={"Remove " + title(a) + " from history"}
                  onClick={() => {
                    setHistory((v) => v.filter((x) => x.id !== h.id));
                    notify("Removed from history");
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="anime-grid catalogue-grid">
          {items.map((id) => (
            <AnimeCard key={id} a={getAnimeDetails(id)} />
          ))}
        </div>
      )}
    </div>
  );
}
