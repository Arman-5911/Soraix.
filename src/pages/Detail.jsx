import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Play,
  Plus,
  Check,
  Share2,
  Star,
  ArrowRight,
  Copy,
  ExternalLink,
} from "lucide-react";
import {
  getAnimeDetails,
  getRecommendations,
  anime,
} from "../services/catalog";
import { useApp } from "../store";
import { RelatedMedia } from "../universe";
import { Poster, Section, Modal, IconButton } from "../components";
import Info from "./Info";
import { useAnime, NetworkState, Freshness } from "../services/live";
export default function Detail() {
  const { slug } = useParams(),
    live = useAnime(slug),
    a = live.data?.anime,
    { title, watchlist, toggleWatchlist, notify } = useApp();
  const [share, setShare] = useState(false),
    [expanded, setExpanded] = useState(false);
  if (!a) return <NetworkState resource={live} />;
  const related = live.data.related || [];
  const url = window.location.href;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      notify("Link copied. Share a new world.");
    } catch {
      notify("Copy the link from your browser’s address bar.");
    }
  };
  return (
    <>
      <div className="home-content">
        <Freshness resource={live} />
      </div>
      <section className="detail-hero">
        <div
          className="detail-backdrop"
          style={{ backgroundImage: `url("${a.banner || a.poster}")` }}
        />
        <div className="detail-content">
          <div className="detail-poster">
            <Poster a={a} />
          </div>
          <div className="detail-copy">
            <div className="breadcrumb">
              <Link to="/">Home</Link> /{" "}
              <Link to={a.type === "Movie" ? "/movies" : "/tv"}>
                {a.type === "Movie" ? "Movies" : "TV Series"}
              </Link>{" "}
              / <span>Details</span>
            </div>
            <span className="eyebrow">YOUR NEXT GREAT STORY</span>
            <h1>{title(a)}</h1>
            <p className="native-title">
              {a.title.native} · {a.title.romaji}
            </p>
            <div className="hero-meta">
              <span className="hero-rating">
                <Star size={15} fill="currentColor" /> {a.score || "Unrated"}
              </span>
              <i />
              <span>{a.year}</span>
              <i />
              <span>{a.type}</span>
              <i />
              <span>{a.totalEpisodes || "TBA"} episodes</span>
            </div>
            <p className="detail-description">
              {expanded
                ? a.description
                : a.description.slice(0, 350) +
                  (a.description.length > 350 ? "…" : "")}
              {a.description.length > 350 && (
                <button onClick={() => setExpanded(!expanded)}>
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}
            </p>
            <div className="hero-genres">
              {a.genres.map((g) => (
                <Link to={"/genre/" + g.toLowerCase()} key={g}>
                  {g}
                </Link>
              ))}
            </div>
            <div className="hero-buttons">
              <Link className="button primary" to={"/watch/" + a.slug}>
                <Play size={17} fill="currentColor" />{" "}
                {a.playableEpisodes ? "Start watching" : "Check availability"}
              </Link>
              <button
                className="button secondary"
                onClick={() => toggleWatchlist(a.id)}
              >
                {watchlist.includes(a.id) ? (
                  <Check size={17} />
                ) : (
                  <Plus size={17} />
                )}{" "}
                {watchlist.includes(a.id)
                  ? "In your watchlist"
                  : "Add to watchlist"}
              </button>
              <IconButton
                label="Share this anime"
                onClick={() => setShare(true)}
              >
                <Share2 size={19} />
              </IconButton>
            </div>
          </div>
        </div>
      </section>
      <div className="page detail-body">
        <div className="detail-facts">
          <h2>Behind the story</h2>
          <dl>
            {[
              ["Japanese", a.title.native],
              ["Also known as", a.synonyms.join(", ") || "—"],
              ["Status", a.status],
              ["Premiered", a.season + " " + a.year],
              [
                "Aired",
                a.releaseDate
                  ? new Date(a.releaseDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "TBA",
              ],
              ["Duration", a.duration],
              ["Studio", a.studios.join(", ") || "Unlisted"],
              ["Producers", a.producers.join(", ") || "Unlisted"],
              ["Episodes", a.totalEpisodes || "Not announced"],
              ["Audio & subtitles", "See official streaming provider"],
              ["Metadata", "AniList · live"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <a
            className="text-link"
            href={a.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            View source & character credits <ExternalLink size={14} />
          </a>
        </div>
        <div className="detail-recommendations">
          {a.characters?.length > 0 && (
            <section className="characters-section">
              <div className="section-head">
                <div>
                  <h2>The faces of the story</h2>
                  <p>Meet the main characters.</p>
                </div>
              </div>
              <div className="characters-grid">
                {a.characters.map((c) => (
                  <article key={c.id}>
                    <img
                      src={c.image}
                      alt={c.name}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/fallback.svg";
                      }}
                    />
                    <strong>{c.name}</strong>
                    <small>Main character</small>
                  </article>
                ))}
              </div>
            </section>
          )}
          {related.length > 0 && (
            <Section
              name="More from this world"
              subtitle="Related seasons and stories."
              items={related.slice(0, 4)}
            />
          )}
          <RelatedMedia id={a.anilistId} />
          <Section
            name="Your next chapter"
            subtitle="Because one great story leads to another."
            items={getRecommendations(a.id).slice(0, 8)}
          />
        </div>
      </div>
      {share && (
        <Modal label="Share this anime" close={() => setShare(false)}>
          <h2>Good stories are better shared.</h2>
          <p>{title(a)}</p>
          <input
            className="share-url"
            aria-label="Share URL"
            readOnly
            value={url}
          />
          <div className="share-options">
            <button className="button primary" onClick={copy}>
              <Copy size={16} /> Copy link
            </button>
            {navigator.share && (
              <button
                className="button secondary"
                onClick={async () => {
                  try {
                    await navigator.share({ title: title(a), url });
                  } catch {}
                }}
              >
                Share to an app
              </button>
            )}
            {[
              [
                "WhatsApp",
                "https://wa.me/?text=" +
                  encodeURIComponent(title(a) + " " + url),
              ],
              [
                "Telegram",
                "https://t.me/share/url?url=" + encodeURIComponent(url),
              ],
              [
                "X / Twitter",
                "https://twitter.com/intent/tweet?url=" +
                  encodeURIComponent(url),
              ],
              [
                "Facebook",
                "https://www.facebook.com/sharer/sharer.php?u=" +
                  encodeURIComponent(url),
              ],
            ].map(([label, href]) => (
              <a
                key={label}
                className="button secondary"
                href={href}
                target="_blank"
                rel="noreferrer"
              >
                {label}
                <ArrowRight size={14} />
              </a>
            ))}
          </div>
          <button className="text-link" onClick={() => setShare(false)}>
            Close
          </button>
        </Modal>
      )}
    </>
  );
}
