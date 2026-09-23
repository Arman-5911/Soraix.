import React from "react";
import { Link } from "react-router-dom";
import { useResource, NetworkState } from "../services/live";
export function WatchableCollection() {
  const live = useResource("/watchable");
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
      <div className="direct-collection-grid">
        {live.data.items.map((a) => (
          <Link
            className="direct-collection-card"
            key={a.id}
            to={`/watch/${a.slug}?ep=1`}
          >
            <img src={a.banner || a.poster} alt="" loading="lazy" />
            <span className="direct-collection-label">IN-SITE PLAYER</span>
            <div>
              <h3>{a.title.english}</h3>
              <p>{a.playableEpisodes} listed episodes · SUB</p>
              <span>Watch now →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
export default function Watchable() {
  return (
    <div className="page">
      <span className="eyebrow">STAY IN YOUR WORLD</span>
      <h1>Watch on SoraiX</h1>
      <p>
        Full episodes play in the SoraiX player. Search the full catalogue for
        more titles; available episodes and audio depend on the source.
      </p>
      <WatchableCollection />
    </div>
  );
}
