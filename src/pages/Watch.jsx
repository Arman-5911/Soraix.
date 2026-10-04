import React, { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Play,
  Plus,
  Check,
  Grid2X2,
  List,
  Search,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { useApp } from "../store";
import {
  useAnime,
  useResource,
  NetworkState,
  Freshness,
} from "../services/live";
import { IconButton, Section } from "../components";
import Discussion from "../Discussion";
import DirectEpisode from "../DirectEpisode";
import HostedPlayer from "../HostedPlayer";
import { exitPlayerFullscreen } from "../playerFullscreen";
import usePlayerControls from "../usePlayerControls";

export default function Watch() {
  const { slug } = useParams();
  const live = useAnime(slug);
  const a = live.data?.anime;
  const media = useResource(a ? "/media/" + a.id : null);
  if (!a) return <NetworkState resource={live} />;
  return <WatchSession key={a.id} a={a} live={live} media={media} />;
}
function WatchSession({ a, live, media }) {
  const { title, watchlist, toggleWatchlist } = useApp();
  const fullscreenRef = useRef(null);
  useEffect(() => {
    const target = fullscreenRef.current;
    const escape = (event) => {
      if (
        event.key === "Escape" &&
        target?.classList.contains("player-expanded")
      )
        exitPlayerFullscreen(target);
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      exitPlayerFullscreen(target);
    };
  }, []);
  const [nextPlayback, setNextPlayback] = useState(null);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(""),
    [grid, setGrid] = useState(true),
    [lights, setLights] = useState(false),
    [trailer, setTrailer] = useState(false),
    [page, setPage] = useState(0);
  const episodes = (media.data?.episodes || []).map((item) => ({
    key: String(item.number),
    number: item.number,
    title: item.title,
    media: item,
  }));
  const requested = params.get("ep") || params.get("episode");
  const selected = requested
    ? episodes.find((e) => e.key === requested)
    : episodes[0];
  const selectedIndex = episodes.findIndex((e) => e.key === selected?.key);
  const controlsHidden = usePlayerControls(fullscreenRef, selected?.key);
  useEffect(() => {
    if (!query && selectedIndex >= 0) setPage(Math.floor(selectedIndex / 60));
  }, [requested, selectedIndex]);
  const filtered = episodes.filter(
    (e) =>
      !query ||
      String(e.number || "").includes(query) ||
      e.title.toLowerCase().includes(query.toLowerCase()),
  );
  const lastPage = Math.max(0, Math.ceil(filtered.length / 60) - 1);
  const activePage = Math.min(page, lastPage);
  const choose = (entry, continuePlayback = false) => {
    if (!entry) return;
    setNextPlayback(
      continuePlayback
        ? { episode: entry.key, position: 0, playing: true }
        : null,
    );
    setParams({
      ...(params.get("audio") ? { audio: params.get("audio") } : {}),
      ...(entry.number ? { ep: String(entry.number) } : { episode: entry.key }),
    });
    setTrailer(false);
  };
  useEffect(() => {
    document.body.classList.toggle("theater-mode", lights);
    return () => document.body.classList.remove("theater-mode");
  }, [lights]);
  const Player = ["direct", "audio"].includes(selected?.media?.provider)
    ? DirectEpisode
    : HostedPlayer;
  return (
    <div className={"page watch-page " + (lights ? "lights-off" : "")}>
      <div className="breadcrumb">
        <Link to="/">Home</Link> /{" "}
        <Link to={"/anime/" + a.slug}>{title(a)}</Link> / Watch
      </div>
      <div className="watch-title">
        <div>
          <span className="eyebrow">THE STORY CONTINUES</span>
          <h1>{title(a)}</h1>
          <p>
            {selected?.title || "Episode availability"} <span>·</span> Full
            episode availability
          </p>
        </div>
        <button
          className="button secondary small"
          onClick={() => toggleWatchlist(a.id)}
        >
          {watchlist.includes(a.id) ? <Check size={16} /> : <Plus size={16} />}{" "}
          Watchlist
        </button>
      </div>
      <Freshness resource={live} />
      {live.error && <NetworkState resource={live} compact />}
      <div className="watch-layout">
        <div className="player-column">
          <div className="watch-player-session" ref={fullscreenRef}>
            {controlsHidden && <button type="button" className="player-controls-wake" aria-label="Show player controls" />}
            <button
              className="exit-player-fullscreen"
              onClick={() => exitPlayerFullscreen(fullscreenRef.current)}
            >
              Exit fullscreen
            </button>
            {media.loading || media.error ? (
              <NetworkState resource={media} />
            ) : selected?.media ? (
              <Player
                key={selected.key}
                fullscreenRef={fullscreenRef}
                initialPlayback={
                  nextPlayback?.episode === selected.key ? nextPlayback : null
                }
                anime={a}
                episode={selected}
                onPrevious={
                  episodes[selectedIndex - 1]?.media
                    ? () => choose(episodes[selectedIndex - 1], true)
                    : null
                }
                onNext={
                  episodes[selectedIndex + 1]?.media
                    ? () => choose(episodes[selectedIndex + 1], true)
                    : null
                }
              />
            ) : (
              <div
                className="official-screen"
                style={{
                  backgroundImage: `linear-gradient(0deg,#0b0b10f5,#0b0b10b0),url("${a.banner || a.poster}")`,
                }}
              >
                {trailer && a.trailer ? (
                  <iframe
                    className="official-trailer"
                    src={`https://www.youtube-nocookie.com/embed/${a.trailer.id}?autoplay=1`}
                    title={title(a) + " — Official trailer"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <div className="official-screen-copy">
                    <span className="official-play-icon">
                      <Play size={27} />
                    </span>
                    <span className="eyebrow">IN-SITE PLAYBACK</span>
                    <h2>No in-site episode source available yet</h2>
                    <p>
                      This title is in the catalogue, but its full episodes are
                      not currently available on SoraiX.
                    </p>
                    <Link className="button primary" to="/watchable">
                      Browse playable episodes
                    </Link>
                    {a.trailer && (
                      <button
                        className="button secondary small"
                        onClick={() => setTrailer(true)}
                      >
                        <Play size={14} /> Watch official trailer
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="player-options">
            <button onClick={() => setLights(!lights)}>
              <Lightbulb size={16} /> Lights {lights ? "on" : "off"}
            </button>
            {trailer && (
              <button onClick={() => setTrailer(false)}>
                Back to episodes
              </button>
            )}
          </div>
          {requested && !selected && (
            <div className="availability-note">
              This episode is not listed by the available providers. Choose an
              episode from the list.
            </div>
          )}
          <div className="server-panel">
            <div>
              <span className="server-status" />
              <div>
                <strong>
                  {selected?.media
                    ? "Full episode playback on SoraiX"
                    : "Episode source unavailable"}
                </strong>
                <small>
                  {selected?.media
                    ? "Playback progress is saved in this browser."
                    : "Browse Watch on SoraiX for available full episodes."}
                </small>
              </div>
            </div>
          </div>
          {episodes.length > 1 && (
            <div className="episode-navigation">
              <button
                className="button secondary small"
                disabled={selectedIndex <= 0}
                onClick={() => choose(episodes[selectedIndex - 1])}
              >
                <ChevronLeft size={16} /> Previous episode
              </button>
              <span>
                {selected?.number ? "EP " + selected.number : "Select episode"}
              </span>
              <button
                className="button primary small"
                disabled={
                  selectedIndex < 0 || selectedIndex >= episodes.length - 1
                }
                onClick={() => choose(episodes[selectedIndex + 1])}
              >
                Next episode <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
        <aside className="episode-panel">
          <div className="section-head">
            <h2>
              Episodes <span>{episodes.length}</span>
            </h2>
            <IconButton
              label={grid ? "Show episode list" : "Show episode grid"}
              onClick={() => setGrid(!grid)}
            >
              {grid ? <List size={18} /> : <Grid2X2 size={18} />}
            </IconButton>
          </div>
          <div className="episode-search">
            <Search size={16} />
            <input
              placeholder="Episode number or title"
              aria-label="Search episode number"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className={"episode-buttons " + (!grid ? "list" : "")}>
            {filtered.slice(activePage * 60, (activePage + 1) * 60).map((e) => (
              <button
                key={e.key}
                title={e.title}
                className={selected?.key === e.key ? "active" : ""}
                aria-current={selected?.key === e.key ? "true" : undefined}
                onClick={() => choose(e)}
              >
                {grid
                  ? e.number
                    ? String(e.number).padStart(2, "0")
                    : "↗"
                  : e.title}
              </button>
            ))}
          </div>
          {!filtered.length && (
            <p className="muted">
              {episodes.length
                ? "No matching episodes."
                : "No playable episodes are available for this title yet."}
            </p>
          )}
          {lastPage > 0 && (
            <div className="episode-pagination">
              <button
                disabled={activePage === 0}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous episode page"
              >
                ←
              </button>
              <span>
                {activePage + 1} / {lastPage + 1}
              </span>
              <button
                disabled={activePage === lastPage}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next episode page"
              >
                →
              </button>
            </div>
          )}
          <div className="episode-legend">
            <i /> Available full episodes
          </div>
        </aside>
      </div>
      {a.nextAiringEpisode && (
        <div className="availability-note">
          Next broadcast: episode {a.nextAiringEpisode.episode} ·{" "}
          {new Date(a.nextAiringEpisode.airingAt * 1000).toLocaleString()}
        </div>
      )}
      <div className="watch-information">
        <h2>About the story</h2>
        <p>
          {a.description.slice(0, 500)}
          {a.description.length > 500 ? "…" : ""}
        </p>
        <Link to={"/anime/" + a.slug}>
          Full details <ChevronRight size={15} />
        </Link>
      </div>
      <Discussion key={a.id} animeId={a.id} />
      {!!a.recommendations?.length && (
        <Section
          name="Stay a little longer"
          subtitle="Another world is waiting."
          items={a.recommendations.slice(0, 6)}
        />
      )}
    </div>
  );
}
