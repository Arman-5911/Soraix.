import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useResource, NetworkState } from "./services/live";
import { useUniverse } from "./universe";

export default function ReadListen() {
  const [params, setParams] = useSearchParams();
  const kind = ["manga", "manhwa", "manhua"].includes(params.get("kind"))
    ? params.get("kind")
    : "manga";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const { setMode } = useUniverse();
  const live = useResource(
    `/universe?mode=${kind}&source=chapters&q=${encodeURIComponent(params.get("q") || "")}&page=${page}&sort=popular`,
  );
  return (
    <div className="page universe listen-hub">
      <span className="eyebrow">SORAIX · READ &amp; LISTEN</span>
      <h1>Your next story, with a voice.</h1>
      <p>
        Find a manga, manhwa or manhua, open a chapter, and read its pictures
        alongside audio.
      </p>
      <div className="listen-features">
        <article>
          <h2>Free read-aloud</h2>
          <p>
            Extract page text on your device and listen with available browser
            voices. OCR reads the original language; it does not translate or
            explain the story.
          </p>
        </article>
        <article>
          <h2>AI explanation</h2>
          <p>
            Use your Gemini API key to explain the pictures in Hindi, English or
            another supported language. Provider usage limits and charges apply.
          </p>
        </article>
      </div>
      <form
        className="universe-filters"
        key={params.toString()}
        onSubmit={(e) => {
          e.preventDefault();
          setParams(new URLSearchParams(new FormData(e.currentTarget)));
        }}
      >
        <input
          name="q"
          aria-label="Find a story"
          placeholder="Search your favourite title"
          defaultValue={params.get("q") || ""}
        />
        <select name="kind" aria-label="Story type" defaultValue={kind}>
          <option value="manga">Manga</option>
          <option value="manhwa">Manhwa</option>
          <option value="manhua">Manhua</option>
        </select>
        <button className="button primary">Find chapters</button>
      </form>
      {live.data ? (
        <>
          <div className="universe-grid">
            {live.data.items.map((item) => (
              <Link
                className="universe-card"
                key={item.anilistId}
                to={`/media/${item.anilistId}?listen=1`}
                onClick={() => {
                  setMode(item.mode);
                }}
              >
                <div>
                  <img src={item.poster} alt="" loading="lazy" />
                  <span>{item.mode}</span>
                </div>
                <h3>{item.title.english}</h3>
                <p>View chapters →</p>
              </Link>
            ))}
          </div>
          {!live.data.items.length && (
            <p>No matching stories found. Try another title or story type.</p>
          )}
          <div className="library-pagination">
            <button
              disabled={page <= 1}
              onClick={() =>
                setParams((p) => {
                  p.set("page", String(page - 1));
                  return p;
                })
              }
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={!live.data.pageInfo?.hasNextPage}
              onClick={() =>
                setParams((p) => {
                  p.set("page", String(page + 1));
                  return p;
                })
              }
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <NetworkState resource={live} />
      )}
    </div>
  );
}
