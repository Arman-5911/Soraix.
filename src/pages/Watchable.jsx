import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useResource, NetworkState } from "../services/live";
export function WatchableCollection({
  path = "/watchable",
  onPage,
  page = 1,
  audio = "",
}) {
  const live = useResource(path);
  if (!live.data) return <NetworkState resource={live} />;
  return (
    <section className="direct-collection">
      <div className="section-head">
        <div>
          <h2>Ready to watch</h2>
          <p>Full episodes. Your own player. Pick a world.</p>
        </div>
        <Link to="/filter">Explore all anime</Link>
      </div>
      {live.error && <NetworkState resource={live} compact />}
      {live.data.partial && (
        <p role="status">
          Some sources did not respond. Retry to check them again.
        </p>
      )}
      {!live.data.items.length && (
        <p>
          No playable episodes found on this page. Try another page or search.
        </p>
      )}
      <div className="direct-collection-grid">
        {live.data.items.map((a) => (
          <Link
            className="direct-collection-card"
            key={a.id}
            to={`/watch/${a.slug}?ep=${a.firstEpisode || 1}${audio === "hi" ? "&audio=hi" : ""}`}
          >
            <img src={a.banner || a.poster} alt="" loading="lazy" />
            <span className="direct-collection-label">IN-SITE PLAYER</span>
            <div>
              <h3>{a.title.english}</h3>
              <p>
                {a.playableEpisodes} listed episodes ·{" "}
                {(a.availableLanguages || ["sub"])
                  .map((l) => (l === "hi" ? "Hindi DUB" : l.toUpperCase()))
                  .join(" / ") || "Original audio"}
              </p>
              <span>Watch now →</span>
            </div>
          </Link>
        ))}
      </div>
      {onPage && (
        <div className="library-pagination">
          <button
            className="button secondary small"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className="button primary small"
            disabled={!live.data.pageInfo?.hasNextPage}
            onClick={() => onPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
export default function Watchable() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const query = params.get("q") || "";
  const audio = params.get("audio") === "hi" ? "hi" : "";
  const changePage = (number) =>
    setParams({ q: query, audio, page: String(number) });
  return (
    <div className="page">
      <span className="eyebrow">STAY IN YOUR WORLD</span>
      <h1>Watch on SoraiX</h1>
      <p>
        Full episodes play in the SoraiX player. Search the full catalogue for
        more titles; available episodes and audio depend on the source.
      </p>
      <form
        className="library-search"
        key={query}
        onSubmit={(event) => {
          event.preventDefault();
          setParams({
            q: String(new FormData(event.currentTarget).get("q") || "").trim(),
            page: "1",
            audio,
          });
        }}
      >
        <input
          aria-label="Search playable anime"
          name="q"
          defaultValue={query}
          placeholder="Search anime, seasons and movies"
        />
        <button className="button primary small" type="submit">
          Search library
        </button>
      </form>
      <div
        className="audio-options"
        role="group"
        aria-label="Library audio filter"
      >
        <button
          aria-pressed={!audio}
          className={!audio ? "active" : ""}
          onClick={() => setParams({ q: query, page: "1" })}
        >
          All audio
        </button>
        <button
          aria-pressed={audio === "hi"}
          className={audio === "hi" ? "active" : ""}
          onClick={() => setParams({ q: query, page: "1", audio: "hi" })}
        >
          Hindi DUB
        </button>
      </div>
      {audio === "hi" && (
        <p>
          Hindi listings are discovered automatically. Stream availability is
          checked when you play. Try the next page if no matching titles appear.
        </p>
      )}
      <WatchableCollection
        path={`/watchable?page=${page}&q=${encodeURIComponent(query)}&audio=${audio}`}
        audio={audio}
        page={page}
        onPage={changePage}
      />
    </div>
  );
}
