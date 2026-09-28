import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useLocal, useApp } from "./store";
import { getAnimeDetails } from "./services/catalog";
import { useResource, NetworkState, useSavedTitles } from "./services/live";
import "./universe.css";
import ThemePicker from "./ThemePicker";
export const MODES = ["anime", "manga", "manhwa", "manhua", "donghua"];
const Context = createContext(null);
const label = (s) => s[0].toUpperCase() + s.slice(1);
export const modeBrand = (mode) => `SoraiX ${label(mode)}`;
export function UniverseProvider({ children }) {
  const [saved, setMode] = useLocal("content-mode", "anime");
  const [library, setLibrary] = useLocal("reading-library", []);
  const [history, setHistory] = useLocal("reading-history", []);
  const mode = MODES.includes(saved) ? saved : "anime";
  const toggle = (item) =>
    setLibrary((old) =>
      old.some((a) => a.anilistId === item.anilistId)
        ? old.filter((a) => a.anilistId !== item.anilistId)
        : [{ ...item }, ...old],
    );
  const record = (item, chapter, page, total, language) =>
    setHistory((old) =>
      [
        { item, chapter, page, total, language, updatedAt: Date.now() },
        ...old.filter((a) => a.item.anilistId !== item.anilistId),
      ].slice(0, 200),
    );
  return (
    <Context.Provider
      value={{ mode, setMode, library, toggle, history, record }}
    >
      {children}
    </Context.Provider>
  );
}
export const useUniverse = () => useContext(Context);
export function ModeSwitcher() {
  const { mode, setMode } = useUniverse();
  const navigate = useNavigate();
  return (
    <div className="mode-switcher">
      <select
        aria-label="Content mode"
        value={mode}
        onChange={(e) => {
          setMode(e.target.value);
          navigate("/");
        }}
      >
        {MODES.map((m) => (
          <option key={m} value={m}>
            {label(m)}
          </option>
        ))}
      </select>
    </div>
  );
}
export function MediaLink({ item, children, ...props }) {
  const { setMode } = useUniverse();
  return (
    <Link
      {...props}
      to={
        item.mode === "anime"
          ? `/anime/${item.slug}`
          : `/media/${item.anilistId}`
      }
      onClick={() => setMode(item.mode)}
    >
      {children}
    </Link>
  );
}
function Cards({ items = [] }) {
  return (
    <div className="universe-grid">
      {items.map((a) => (
        <MediaLink item={a} key={a.anilistId} className="universe-card">
          <div>
            <img src={a.poster} alt="" loading="lazy" />
            <span>{label(a.mode)}</span>
          </div>
          <h3>{a.title.english}</h3>
          <p>
            {a.score ? `★ ${a.score} · ` : ""}
            {a.year || "TBA"} ·{" "}
            {a.mode === "donghua"
              ? `${a.totalEpisodes || "?"} episodes`
              : `${a.chapters || "?"} chapters`}
          </p>
        </MediaLink>
      ))}
    </div>
  );
}
export function UniverseHeader() {
  const { mode } = useUniverse();
  return (
    <header className="universe-header">
      <Link to="/" className="logo" aria-label={`${modeBrand(mode)} home`}>
        ϟ SoraiX <small className="brand-mode">{label(mode)}</small>
      </Link>
      <ModeSwitcher />
      <ThemePicker />
      <nav>
        <Link to="/">Discover</Link>
        <Link to="/search">Search {label(mode)}</Link>
        <Link to="/watchlist">
          {mode === "donghua" ? "Watchlist" : "My Library"}
        </Link>
        <Link to="/history">History</Link>
      </nav>
    </header>
  );
}
export function ReadingHistory({ full = false }) {
  const { history, mode } = useUniverse();
  const rows = history
    .filter((h) => h.item.mode === mode)
    .slice(0, full ? 200 : 6);
  return (
    <section className="universe-section">
      <h2>{full ? "Reading history" : "Continue Reading"}</h2>
      {!rows.length ? (
        <p>Your reading progress will appear here.</p>
      ) : (
        <div className="reading-history">
          {rows.map((h) => (
            <Link
              key={h.item.anilistId}
              to={`/read/${h.item.anilistId}/${h.chapter.id}?language=${h.language || "en"}`}
            >
              <img src={h.item.poster} alt="" />
              <div>
                <strong>{h.item.title.english}</strong>
                <p>
                  {h.chapter.title} · Page {h.page + 1} / {h.total}
                </p>
                <progress value={h.page + 1} max={h.total} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
export function UniverseLibrary() {
  const { library, mode } = useUniverse();
  return (
    <div className="page universe">
      <h1>My {label(mode)} Library</h1>
      <Cards items={library.filter((a) => a.mode === mode)} />
      {!library.some((a) => a.mode === mode) && (
        <p>Save a title from its detail page to begin your collection.</p>
      )}
    </div>
  );
}
export function DonghuaHistory() {
  const { history } = useApp();
  useSavedTitles(history.map((h) => h.id));
  const entries = history
    .map((h) => ({ ...h, item: getAnimeDetails(h.id) }))
    .filter((h) => h.item?.country === "CN");
  return (
    <section className="page universe">
      <h2>Continue Watching Donghua</h2>
      {entries.length ? (
        <div className="reading-history">
          {entries.map((h) => (
            <Link key={h.id} to={`/watch/${h.item.slug}?ep=${h.episode}`}>
              <img src={h.item.poster} alt="" />
              <div>
                <strong>{h.item.title.english}</strong>
                <p>
                  Episode {h.episode} · {Math.floor(h.position / 60)} minutes
                  watched
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p>Your Donghua viewing progress will appear here.</p>
      )}
    </section>
  );
}
export function UniverseHome() {
  const { mode, library } = useUniverse();
  const live = useResource(`/universe?mode=${mode}&sort=trending`);
  const popular = useResource(`/universe?mode=${mode}&sort=popular`);
  const seed = library.find((item) => item.mode === mode);
  const recommended = useResource(
    seed ? `/universe/${seed.anilistId}` : `/universe?mode=${mode}&sort=rated`,
  );
  const top = live.data?.items[0];
  return (
    <div className="page universe" key={mode}>
      {!live.data ? (
        <NetworkState resource={live} />
      ) : (
        <>
          <section
            className="universe-hero"
            style={{
              backgroundImage: `linear-gradient(90deg,#100e1bf2,#100e1b55),url("${top?.banner || top?.poster}")`,
            }}
          >
            <span className="eyebrow">YOUR {mode.toUpperCase()} UNIVERSE</span>
            <h1>{top?.title.english || `Discover ${label(mode)}`}</h1>
            <p>{top?.description.slice(0, 240)}</p>
            {top && (
              <MediaLink className="button primary" item={top}>
                {mode === "donghua" ? "Explore episodes" : "Explore chapters"} →
              </MediaLink>
            )}
          </section>
          {mode !== "donghua" ? (
            <>
              <ReadingHistory />
              <ReadyToRead mode={mode} />
            </>
          ) : (
            <DonghuaHistory />
          )}
          <section className="universe-section">
            <div className="section-head">
              <h2>Trending {label(mode)}</h2>
              <Link to="/search">Explore all →</Link>
            </div>
            <Cards items={live.data.items.slice(0, 12)} />
          </section>
          <section className="universe-section">
            <h2>Popular in {label(mode)}</h2>
            {popular.data ? (
              <Cards items={popular.data.items.slice(0, 12)} />
            ) : (
              <NetworkState resource={popular} />
            )}
          </section>
          <section className="universe-section">
            <h2>
              {seed
                ? `Because you saved ${seed.title.english}`
                : `Recommended ${label(mode)}`}
            </h2>
            {recommended.data ? (
              <Cards
                items={(
                  recommended.data.recommendations ||
                  recommended.data.items ||
                  []
                )
                  .filter((a) => a.mode === mode)
                  .slice(0, 12)}
              />
            ) : (
              <NetworkState resource={recommended} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
export function ReadyToRead({ mode }) {
  const live = useResource(
    `/universe?mode=${mode}&source=chapters&sort=popular`,
    { refreshOnFocus: false },
  );
  return (
    <section className="universe-section">
      <div className="section-head">
        <div>
          <h2>Reading catalogue</h2>
          <p>
            Browse the chapter source directly. Open any title for its available
            chapters.
          </p>
        </div>
        <Link to="/search">Browse all titles ?</Link>
      </div>
      {live.data ? (
        <>
          <Cards items={live.data.items.slice(0, 12)} />
          <p>
            {live.data.pageInfo?.total?.toLocaleString()} source titles ?
            Chapter coverage varies by title and language.
          </p>
        </>
      ) : (
        <NetworkState resource={live} />
      )}
    </section>
  );
}
export function UniverseBrowse() {
  const { mode } = useUniverse();
  const [params, setParams] = useSearchParams();
  const live = useResource(
    `/universe?mode=${mode}&${params}&source=${mode === "donghua" ? "metadata" : "chapters"}`,
  );
  const page = Number(params.get("page")) || 1;
  return (
    <div className="page universe">
      <h1>Explore {label(mode)}</h1>
      <form
        className="universe-filters"
        key={mode + params.toString()}
        onSubmit={(e) => {
          e.preventDefault();
          setParams(new URLSearchParams(new FormData(e.currentTarget)));
        }}
      >
        <input
          name="q"
          defaultValue={params.get("q") || ""}
          placeholder={`Search ${label(mode)}…`}
          aria-label={`Search ${mode}`}
        />
        <select
          name="sort"
          defaultValue={params.get("sort") || "trending"}
          aria-label="Sort"
        >
          <option value="trending">Trending</option>
          <option value="popular">Most popular</option>
          <option value="rated">Top rated</option>
          <option value="new">Newest</option>
        </select>
        <select
          name="genre"
          defaultValue={params.get("genre") || ""}
          aria-label="Genre"
        >
          {[
            "",
            "Action",
            "Adventure",
            "Comedy",
            "Drama",
            "Fantasy",
            "Romance",
            "Sci-Fi",
            "Slice of Life",
          ].map((g) => (
            <option key={g} value={g}>
              {g || "All genres"}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={params.get("status") || ""}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          <option value="RELEASING">Ongoing</option>
          <option value="FINISHED">Completed</option>
          <option value="NOT_YET_RELEASED">Upcoming</option>
        </select>
        <button className="button primary">Apply filters</button>
      </form>
      {live.data ? (
        <>
          <Cards items={live.data.items} />
          {!live.data.items.length && (
            <p>No matching titles. Try another search.</p>
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
              disabled={!live.data.pageInfo.hasNextPage}
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
export function RelatedMedia({ id }) {
  const live = useResource(id ? `/universe/${id}` : null);
  return live.data?.related?.length ? (
    <section className="universe-section">
      <h2>Connected stories & adaptations</h2>
      <Cards items={live.data.related} />
    </section>
  ) : null;
}
export function UniverseDetail() {
  const { id } = useParams();
  const live = useResource(`/universe/${id}`);
  const { setMode, library, toggle, history } = useUniverse();
  const [language, setLanguage] = useState("en");
  const [source, setSource] = useState("auto");
  const item = live.data?.item;
  const books = useResource(
    item && item.mode !== "donghua" && item.mode !== "anime"
      ? `/chapters/${id}?language=${language}&source=${source}`
      : null,
  );
  useEffect(() => {
    if (item) {
      setMode(item.mode);
      document.title = `${modeBrand(item.mode)} | ${item.title.english}`;
    }
  }, [item]);
  if (!item)
    return (
      <div className="page">
        <NetworkState resource={live} />
      </div>
    );
  const progress = history.find((h) => h.item.anilistId === item.anilistId);
  return (
    <div className="page universe">
      <section className="book-detail">
        <img src={item.poster} alt={item.title.english} />
        <div>
          <span className="eyebrow">
            {label(item.mode)} · {item.year} · {item.status}
          </span>
          <h1>{item.title.english}</h1>
          <p>{item.description}</p>
          <p>{item.genres.join(" · ")}</p>
          {["anime", "donghua"].includes(item.mode) ? (
            <>
              <button className="button secondary" onClick={() => toggle(item)}>
                {library.some((a) => a.anilistId === item.anilistId)
                  ? "Remove from library"
                  : "Save to library"}
              </button>
              <Link className="button primary" to={`/watch/${item.slug}`}>
                Watch episodes
              </Link>
            </>
          ) : (
            <>
              <button className="button secondary" onClick={() => toggle(item)}>
                {library.some((a) => a.anilistId === item.anilistId)
                  ? "Remove from library"
                  : "Save to library"}
              </button>
              {progress && (
                <Link
                  className="button primary"
                  to={`/read/${id}/${progress.chapter.id}?language=${progress.language || "en"}`}
                >
                  Continue Reading
                </Link>
              )}
              {!!books.data?.chapters.length && (
                <Link
                  className="button primary"
                  to={`/read/${id}/${books.data.chapters[0].id}?language=${language}&source=${books.data.source || "mangadex"}`}
                >
                  Read now
                </Link>
              )}
              {books.loading && <p role="status">Finding chapter sources…</p>}
            </>
          )}
        </div>
      </section>
      {!["anime", "donghua"].includes(item.mode) && (
        <section className="universe-section">
          <h2>Chapters</h2>
          <label>
            Reading source{" "}
            <select
              aria-label="Reading source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              {[
                ["auto", "Auto · combine available chapters"],
                ["mangadex", "MangaDex"],
                ["atsumaru", "Atsumaru · English"],
                ["weebcentral", "WeebCentral · English"],
              ].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {books.data?.sources && (
            <p>
              {books.data.sources
                .map(
                  (s) =>
                    `${s.id}: ${s.status === "unavailable" ? "temporarily unavailable" : s.count + " chapters"}`,
                )
                .join(" · ")}
            </p>
          )}
          {books.data?.provider && (
            <p>
              Source: {books.data.provider} · {books.data.chapters.length}{" "}
              in-site chapters
            </p>
          )}
          <select
            aria-label="Chapter language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {[
              ["en", "English"],
              ["hi", "Hindi"],
              ["ja", "Japanese"],
              ["ko", "Korean"],
              ["zh", "Chinese"],
              ["es", "Spanish"],
              ["fr", "French"],
            ].map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          {!books.data ? (
            <NetworkState resource={books} />
          ) : books.data.chapters.length ? (
            <div className="chapter-list">
              {books.data.chapters.map((c) => (
                <Link
                  key={c.id}
                  to={`/read/${id}/${c.id}?language=${language}&source=${books.data.source || "mangadex"}`}
                >
                  {c.title}
                  <span>Read →</span>
                </Link>
              ))}
            </div>
          ) : (
            <p>
              No readable chapters are available from the connected provider in
              this language. You can still save this title to your library.
              {books.data?.availableLanguages?.length
                ? ` Source languages: ${books.data.availableLanguages.join(", ")}.`
                : ""}
            </p>
          )}
          {books.data?.truncated && (
            <p>
              This source has more than 10,000 chapter uploads. The earliest
              available chapters are shown.
            </p>
          )}
        </section>
      )}
      <section className="universe-section">
        <h2>Connected stories & adaptations</h2>
        <Cards items={live.data.related} />
      </section>
      <section className="universe-section">
        <h2>You may also like</h2>
        <Cards
          items={live.data.recommendations.filter((a) => a.mode === item.mode)}
        />
      </section>
    </div>
  );
}
export function Reader() {
  const { id, chapterId } = useParams();
  return (
    <ReaderSession key={`${id}-${chapterId}`} id={id} chapterId={chapterId} />
  );
}
function ReaderSession({ id, chapterId }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const language = params.get("language") || "en";
  const source = params.get("source") || "auto";
  const { history, record, setMode } = useUniverse();
  const chapters = useResource(
    `/chapters/${id}?language=${language}&source=${source}`,
  );
  const entry = chapters.data?.chapters.find(
    (c) =>
      c.id === chapterId || c.alternatives?.some((a) => a.id === chapterId),
  );
  const chapter =
    entry?.id === chapterId
      ? entry
      : entry?.alternatives?.find((a) => a.id === chapterId);
  const [failedPages, setFailedPages] = useState(false);
  const [imageRevision, setImageRevision] = useState(0);
  const live = useResource(chapter ? `/pages/${chapterId}` : null, {
    refreshOnFocus: false,
  });
  const [layout, setLayout] = useLocal("reader-layout", "vertical");
  const [direction, setDirection] = useLocal("reader-direction", "ltr");
  const [width, setWidth] = useLocal("reader-width", 850);
  const saved = history.find(
    (h) => String(h.item.anilistId) === id && h.chapter.id === chapterId,
  );
  const [page, setPage] = useState(saved?.page || 0);
  const pages = live.data?.pages || [];
  const restored = useRef(false);
  const effective = ["vertical", "single", "double"].includes(layout)
    ? layout
    : "vertical";
  const current = Math.min(page, Math.max(0, pages.length - 1));
  const index =
    chapters.data?.chapters.findIndex((c) => c.id === entry?.id) ?? -1;
  const goChapter = (delta) => {
    const c = chapters.data?.chapters[index + delta];
    if (c)
      navigate(`/read/${id}/${c.id}?language=${language}&source=${source}`);
  };
  useEffect(() => {
    if (chapters.data) setMode(chapters.data.item.mode);
  }, [chapters.data?.item.mode]);
  useEffect(() => {
    if (pages.length && chapter)
      record(chapters.data.item, chapter, current, pages.length, language);
  }, [current, pages.length, chapterId]);
  useEffect(() => {
    if (!pages.length || effective !== "vertical") return;
    const nodes = [...document.querySelectorAll("[data-reader-page]")];
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setPage(Number(visible[0].target.dataset.readerPage));
      },
      { rootMargin: "-10% 0px -45% 0px", threshold: 0 },
    );
    const ready = nodes.slice(0, current + 1).map((image) =>
      image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          }),
    );
    Promise.all(ready).then(() => {
      if (cancelled) return;
      if (!restored.current) {
        nodes[current]?.scrollIntoView();
        restored.current = true;
      }
      nodes.forEach((n) => observer.observe(n));
    });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pages.length, effective]);
  useEffect(() => {
    const key = (e) => {
      if (/INPUT|SELECT|BUTTON|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const delta =
          (e.key === "ArrowRight" ? 1 : -1) *
          (direction === "rtl" ? -1 : 1) *
          (effective === "double" ? 2 : 1);
        if (effective === "vertical") {
          document
            .querySelector(
              `[data-reader-page="${Math.max(0, Math.min(pages.length - 1, current + delta))}"]`,
            )
            ?.scrollIntoView();
        }
        setPage((p) => Math.max(0, Math.min(pages.length - 1, p + delta)));
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [pages.length, direction, effective, current]);
  return (
    <div className="reader">
      <div className="reader-toolbar">
        <Link to={`/media/${id}`}>← Title</Link>
        <strong>{chapter?.title || "Reader"}</strong>
        <span>{chapter?.provider || chapters.data?.provider || source}</span>
        <button
          onClick={() => {
            setFailedPages(false);
            setImageRevision((v) => v + 1);
            live.retry();
          }}
        >
          Reload pages
        </button>
        {!!entry?.alternatives?.length && (
          <select
            aria-label="Chapter source"
            value={chapterId}
            onChange={(e) =>
              navigate(
                `/read/${id}/${e.target.value}?language=${language}&source=auto`,
              )
            }
          >
            {[entry, ...entry.alternatives].map((c) => (
              <option key={c.id} value={c.id}>
                {c.provider || c.source}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Reading layout"
          value={effective}
          onChange={(e) => {
            restored.current = false;
            setLayout(e.target.value);
          }}
        >
          <option value="vertical">Vertical scroll</option>
          <option value="single">Single page</option>
          <option value="double">Double page</option>
        </select>
        <select
          aria-label="Reading direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
        >
          <option value="ltr">Left to right</option>
          <option value="rtl">Right to left</option>
        </select>
        <label>
          Width{" "}
          <input
            aria-label="Reader width"
            type="range"
            min="400"
            max="1500"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </label>
        <select
          aria-label="Select chapter"
          value={entry?.id || chapterId}
          onChange={(e) =>
            navigate(
              `/read/${id}/${e.target.value}?language=${language}&source=${source}`,
            )
          }
        >
          {chapters.data?.chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      {(failedPages || live.error) && (
        <p className="empty" role="status">
          Some pages could not load. Reload pages
          {entry?.alternatives?.length
            ? " or choose another Chapter source above."
            : "."}{" "}
          <Link to={`/media/${id}`}>See all reading sources</Link>
        </p>
      )}
      {!chapters.data ? (
        <NetworkState resource={chapters} />
      ) : !chapter ? (
        <p className="empty">
          This chapter is not available in the selected language.
        </p>
      ) : !live.data ? (
        <NetworkState resource={live} />
      ) : !pages.length ? (
        <p className="empty">
          This chapter has no in-site pages available. Choose another chapter.
        </p>
      ) : (
        <>
          <div
            className={`reader-pages ${effective}`}
            style={{ maxWidth: width, direction }}
          >
            {(effective === "vertical"
              ? pages
              : pages.slice(current, current + (effective === "double" ? 2 : 1))
            ).map((url, i) => {
              const number = effective === "vertical" ? i : current + i;
              return (
                <img
                  key={`${url}-${imageRevision}`}
                  data-reader-page={number}
                  src={url}
                  alt={`Page ${number + 1}`}
                  loading={number <= current + 1 ? "eager" : "lazy"}
                  onError={(e) => {
                    setFailedPages(true);
                    e.currentTarget.alt = `Page ${number + 1} could not load. Reload chapter to retry.`;
                  }}
                />
              );
            })}
          </div>
          <div className="reader-bottom">
            <button disabled={index <= 0} onClick={() => goChapter(-1)}>
              Previous chapter
            </button>
            <button
              disabled={!current}
              onClick={() => {
                const n = Math.max(
                  0,
                  current - (effective === "double" ? 2 : 1),
                );
                setPage(n);
                document
                  .querySelector(`[data-reader-page="${n}"]`)
                  ?.scrollIntoView();
              }}
            >
              Previous page
            </button>
            <span>
              {current + 1} / {pages.length}
            </span>
            <button
              disabled={current >= pages.length - 1}
              onClick={() => {
                const n = Math.min(
                  pages.length - 1,
                  current + (effective === "double" ? 2 : 1),
                );
                setPage(n);
                document
                  .querySelector(`[data-reader-page="${n}"]`)
                  ?.scrollIntoView();
              }}
            >
              Next page
            </button>
            <button
              disabled={index >= chapters.data.chapters.length - 1}
              onClick={() => goChapter(1)}
            >
              Next chapter
            </button>
          </div>
        </>
      )}
    </div>
  );
}
