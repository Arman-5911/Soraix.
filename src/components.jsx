import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  SlidersHorizontal,
  Shuffle,
  Bookmark,
  Menu,
  X,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  Play,
  Plus,
  Check,
  Star,
  Mic,
  CalendarDays,
  History,
  Settings,
  ArrowRight,
  Clock,
  Command,
} from "lucide-react";
import { useApp } from "./store";
import { ModeSwitcher, useUniverse, modeBrand } from "./universe";
import { anime, getTrendingAnime, getPopularAnime } from "./services/catalog";
import { request, useResource, NetworkState } from "./services/live";
export const IconButton = ({ label, children, ...props }) => (
  <button className="icon-button" aria-label={label} title={label} {...props}>
    {children}
  </button>
);
export function Logo() {
  const { mode } = useUniverse();
  return (
    <Link to="/" className="logo" aria-label={`${modeBrand(mode)} home`}>
      <svg viewBox="0 0 32 38" aria-hidden="true">
        <path d="M21 1 2 22h14l-5 15L31 14H17z" fill="currentColor" />
      </svg>
      <span>
        SoraiX{" "}
        <small className="brand-mode">
          {mode[0].toUpperCase() + mode.slice(1)}
        </small>
        <i />
      </span>
    </Link>
  );
}
export function Poster({ a, ...props }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={a.poster}
      alt={a.title.english}
      loading="lazy"
      className={loaded ? "loaded" : ""}
      onLoad={() => setLoaded(true)}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "/fallback.svg";
        setLoaded(true);
      }}
      {...props}
    />
  );
}
export function Badges({ a }) {
  return (
    <span className="badges">
      <span title="Format">{a.type}</span>
      <span title="Total episodes">
        {a.totalEpisodes ? `${a.totalEpisodes} EP` : "TBA"}
      </span>
    </span>
  );
}
export function AnimeCard({ a, rank }) {
  const { title, watchlist, toggleWatchlist } = useApp();
  return (
    <article className={"anime-card " + (rank ? "ranked" : "")}>
      <div className="poster-wrap">
        <Link to={"/anime/" + a.slug}>
          <Poster a={a} />
          <div className="poster-shade" />
          <span className="quality">
            {a.status === "Currently Airing" ? "AIRING" : a.type}
          </span>
          <Badges a={a} />
          <span className="hover-play">
            <Play fill="currentColor" size={23} />
          </span>
        </Link>
        <button
          className={"save-card " + (watchlist.includes(a.id) ? "saved" : "")}
          onClick={() => toggleWatchlist(a.id)}
          aria-label={
            (watchlist.includes(a.id) ? "Remove " : "Save ") + title(a)
          }
        >
          {watchlist.includes(a.id) ? <Check size={16} /> : <Plus size={16} />}
        </button>
      </div>
      <div className="card-caption">
        {rank && (
          <span className="rank-number">{String(rank).padStart(2, "0")}</span>
        )}
        <div>
          <Link className="card-title" to={"/anime/" + a.slug}>
            {title(a)}
          </Link>
          <p>
            {a.type}
            <i /> {a.year}
            <span className="card-score">
              <Star size={11} fill="currentColor" />
              {a.score?.toFixed(1) || "—"}
            </span>
          </p>
        </div>
      </div>
      <div className="card-preview">
        <span className="eyebrow">
          {a.type} · {a.year} · {a.score || "Unrated"} ★
        </span>
        <h3>{title(a)}</h3>
        <p>{a.description.slice(0, 190)}…</p>
        <small>{a.genres.slice(0, 3).join(" · ")}</small>
        <Link className="button primary small" to={"/watch/" + a.slug}>
          <Play size={14} />{" "}
          {a.playableEpisodes ? "Watch now" : "Check availability"}
        </Link>
      </div>
    </article>
  );
}
export function Section({ name, subtitle, items, to, ranked = false }) {
  const ref = useRef(null);
  const drag = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!ranked || !element) return;
    const wheel = (event) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const canScroll =
        event.deltaY > 0
          ? element.scrollLeft < element.scrollWidth - element.clientWidth - 1
          : element.scrollLeft > 0;
      if (canScroll) {
        event.preventDefault();
        element.scrollLeft += event.deltaY;
      }
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [ranked]);
  return (
    <section className="anime-section">
      <div className="section-head">
        <div>
          <h2>
            {name}
            {name === "Trending now" && (
              <span className="live-label">
                <i /> LIVE
              </span>
            )}
          </h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="section-actions">
          {to && (
            <Link to={to}>
              View all <ArrowUpRight size={15} />
            </Link>
          )}
          {ranked && (
            <>
              <IconButton
                label="Previous trending anime"
                onClick={() =>
                  ref.current.scrollBy({ left: -500, behavior: "smooth" })
                }
              >
                <ChevronLeft size={17} />
              </IconButton>
              <IconButton
                label="Next trending anime"
                onClick={() =>
                  ref.current.scrollBy({ left: 500, behavior: "smooth" })
                }
              >
                <ChevronRight size={17} />
              </IconButton>
            </>
          )}
        </div>
      </div>
      <div
        ref={ref}
        className={ranked ? "trending-track" : "anime-grid"}
        onDragStart={ranked ? (e) => e.preventDefault() : undefined}
        onPointerDown={
          ranked
            ? (e) => {
                if (e.pointerType === "mouse")
                  drag.current = {
                    x: e.clientX,
                    scroll: ref.current.scrollLeft,
                  };
              }
            : undefined
        }
        onPointerMove={
          ranked
            ? (e) => {
                if (drag.current && Math.abs(e.clientX - drag.current.x) > 8) {
                  ref.current.scrollLeft =
                    drag.current.scroll - (e.clientX - drag.current.x);
                  ref.current.dataset.dragging = "true";
                }
              }
            : undefined
        }
        onPointerUp={() => {
          drag.current = null;
          setTimeout(() => {
            if (ref.current) ref.current.dataset.dragging = "false";
          }, 0);
        }}
        onPointerLeave={() => {
          drag.current = null;
        }}
        onClickCapture={(e) => {
          if (ref.current?.dataset.dragging === "true") {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {items.map((a, i) => (
          <AnimeCard key={a.id + "-" + i} a={a} rank={ranked ? i + 1 : null} />
        ))}
      </div>
    </section>
  );
}
export const navItems = [
  ["Home", "/"],
  ["Watch on SoraiX", "/watchable"],
  ["Movies", "/movies"],
  ["TV Series", "/tv"],
  ["Most Popular", "/most-popular"],
  ["Top Airing", "/top-airing"],
  ["Schedule", "/schedule"],
];
export function Header() {
  const { language, setLanguage, watchlist, theme, setTheme, notify } =
    useApp();
  const [menu, setMenu] = useState(false),
    [search, setSearch] = useState(false),
    [settings, setSettings] = useState(false);
  const location = useLocation(),
    navigate = useNavigate();
  const [randomBusy, setRandomBusy] = useState(false);
  const randomAnime = async () => {
    if (randomBusy) return;
    setRandomBusy(true);
    try {
      const data = await request("/random", { force: true });
      if (data.anime) navigate("/anime/" + data.anime.slug);
      else notify("No anime was returned. Please try again.");
    } catch (error) {
      notify(error.message);
    } finally {
      setRandomBusy(false);
    }
  };
  useEffect(() => {
    setMenu(false);
    setSearch(false);
    setSettings(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const fn = (e) => {
      if (
        (e.key === "/" &&
          !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) ||
        ((e.ctrlKey || e.metaKey) && e.key === "k")
      ) {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === "Escape") {
        setSearch(false);
        setMenu(false);
        setSettings(false);
      }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <IconButton
            label="Open navigation"
            onClick={() => setMenu(true)}
            className="icon-button mobile-menu"
          >
            <Menu size={22} />
          </IconButton>
          <Logo />
          <ModeSwitcher />
          <nav className="desktop-nav">
            {navItems.slice(0, 3).map(([name, url]) => (
              <Link
                key={url}
                className={location.pathname === url ? "active" : ""}
                to={url}
              >
                {name}
              </Link>
            ))}
            <Link
              className={location.pathname === "/top-airing" ? "active" : ""}
              to="/top-airing"
            >
              Explore <span className="nav-dot" />
            </Link>
          </nav>
          <button className="header-search" onClick={() => setSearch(true)}>
            <Search size={17} />
            <span>Search your next adventure...</span>
            <kbd>⌘ K</kbd>
          </button>
          <Link
            className="header-filter"
            to="/filter"
            aria-label="Advanced filters"
          >
            <SlidersHorizontal size={18} />
          </Link>
          <div className="header-tools">
            <IconButton
              label="Random anime"
              onClick={randomAnime}
              disabled={randomBusy}
            >
              <Shuffle size={19} />
            </IconButton>
            <button
              className="language-toggle"
              onClick={() => setLanguage(language === "EN" ? "JP" : "EN")}
            >
              {language}
              <span>/ {language === "EN" ? "JP" : "EN"}</span>
            </button>
            <IconButton
              label="Appearance settings"
              onClick={() => setSettings(!settings)}
            >
              <Settings size={18} />
            </IconButton>
            <Link className="watchlist-button" to="/watchlist">
              <Bookmark size={17} />
              <span>Watchlist</span>
              {watchlist.length > 0 && <b>{watchlist.length}</b>}
            </Link>
          </div>
        </div>
        {settings && (
          <div className="settings-panel">
            <h3>Make yourself at home</h3>
            <p>Choose your atmosphere</p>
            {["midnight", "dim"].map((t) => (
              <button
                className={theme === t ? "selected" : ""}
                key={t}
                onClick={() => setTheme(t)}
              >
                {t === "midnight" ? "Midnight black" : "Soft charcoal"}{" "}
                {theme === t && <Check size={14} />}
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="subnav">
        <nav>
          {navItems.slice(3).map(([name, url]) => (
            <Link
              key={url}
              className={location.pathname === url ? "active" : ""}
              to={url}
            >
              {name}
            </Link>
          ))}
          <Link to="/recently-updated">Recently Updated</Link>
          <Link to="/recently-added">Recently Added</Link>
          <Link to="/completed">Completed</Link>
          <Link to="/genres">Genres</Link>
        </nav>
        <span>
          <i /> A whole world of anime. Yours to explore.
        </span>
      </div>
      {menu && (
        <Modal
          label="Navigation menu"
          className="drawer-modal"
          close={() => setMenu(false)}
        >
          <nav
            className="drawer"
            aria-label="Mobile navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <Logo />
              <ModeSwitcher />
              <IconButton label="Close menu" onClick={() => setMenu(false)}>
                <X />
              </IconButton>
            </div>
            {[
              ...navItems,
              ["Recently Updated", "/recently-updated"],
              ["Recently Added", "/recently-added"],
              ["Completed", "/completed"],
              ["Genres", "/genres"],
              ["Watchlist", "/watchlist"],
              ["History", "/history"],
            ].map(([name, url]) => (
              <Link to={url} key={url}>
                {name}
                <ChevronRight size={16} />
              </Link>
            ))}
            <button
              onClick={() => {
                setMenu(false);
                setSearch(true);
              }}
            >
              <Search size={18} /> Search anime
            </button>
            <button onClick={randomAnime} disabled={randomBusy}>
              <Shuffle size={18} /> Random anime
            </button>
            <button
              onClick={() =>
                setTheme(theme === "midnight" ? "dim" : "midnight")
              }
            >
              <Settings size={18} /> Switch to{" "}
              {theme === "midnight" ? "soft charcoal" : "midnight"}
            </button>
          </nav>
        </Modal>
      )}
      {search && <SearchModal close={() => setSearch(false)} />}
    </>
  );
}
export function Modal({ children, close, label, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("input,button,a,select")?.focus();
    const key = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = ref.current.querySelectorAll(
          'button:not([disabled]),a,input,select,textarea,[tabindex="0"]',
        );
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = body;
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        ref={ref}
        className={"modal " + className}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
function SearchModal({ close }) {
  const { title, recent, setRecent } = useApp(),
    [q, setQ] = useState(""),
    [query, setQuery] = useState(""),
    [index, setIndex] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q);
      setIndex(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const live = useResource(
    "/catalog?limit=6&" +
      (query ? "q=" + encodeURIComponent(query) : "sort=Trending"),
  );
  const results = live.data?.items || [];
  const submit = (value = q) => {
    if (!value.trim()) return;
    setRecent((v) => [value, ...v.filter((s) => s !== value)].slice(0, 8));
    navigate("/search?q=" + encodeURIComponent(value));
    close();
  };
  return (
    <Modal close={close} label="Search SoraiX" className="search-modal">
      <div className="search-modal-input">
        <Search />
        <input
          aria-label="Search anime"
          placeholder="Search anime, genres, new worlds..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter") {
              if (results[index]) {
                if (q.trim())
                  setRecent((v) =>
                    [q.trim(), ...v.filter((s) => s !== q.trim())].slice(0, 8),
                  );
                navigate("/anime/" + results[index].slug);
                close();
              } else submit();
            }
          }}
        />
        <IconButton label="Close search" onClick={close}>
          <X size={20} />
        </IconButton>
      </div>
      {!q && recent.length > 0 && (
        <div className="recent-searches">
          <small>RECENT SEARCHES</small>
          <button onClick={() => setRecent([])}>Clear history</button>
          <div>
            {recent.map((s) => (
              <button key={s} onClick={() => submit(s)}>
                <History size={12} />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="search-label">
        {query ? "MATCHING WORLDS" : "TRENDING SEARCHES"}
        <span>↑ ↓ to navigate · Enter to open</span>
      </div>
      <div className="search-results">
        {(live.loading || live.error) && (
          <NetworkState resource={live} compact />
        )}
        {results.map((a, i) => (
          <Link
            className={index === i ? "highlighted" : ""}
            to={"/anime/" + a.slug}
            key={a.id + "-" + i}
            onMouseEnter={() => setIndex(i)}
            onClick={() => {
              if (q.trim())
                setRecent((v) =>
                  [q.trim(), ...v.filter((s) => s !== q.trim())].slice(0, 8),
                );
              close();
            }}
          >
            <Poster a={a} />
            <div>
              <strong>{title(a)}</strong>
              <small>
                {a.type} · {a.year} · {a.totalEpisodes || "TBA"} episodes
              </small>
            </div>
            <ArrowUpRight size={17} />
          </Link>
        ))}
        {!results.length && !live.loading && !live.error && (
          <Empty
            title="No anime found."
            text="Try another keyword or browse genres."
          />
        )}
      </div>
      <div className="search-bottom">
        <button onClick={() => submit()}>
          View all results <ArrowRight size={15} />
        </button>
        <Link to="/filter">
          <SlidersHorizontal size={14} /> Advanced filters
        </Link>
      </div>
      <div className="quick-links">
        {[
          ["Home", "/"],
          ["Watch on SoraiX", "/watchable"],
          ["Movies", "/movies"],
          ["TV", "/tv"],
          ["Watchlist", "/watchlist"],
          ["History", "/history"],
        ].map(([t, p]) => (
          <Link to={p} key={p}>
            {t}
          </Link>
        ))}
      </div>
    </Modal>
  );
}
export function Empty({ title, text, icon: Icon = Search, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={30} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Footer() {
  return (
    <footer>
      <div className="footer-top">
        <div>
          <Logo />
          <ModeSwitcher />
          <p>
            A world beyond ordinary.
            <br />
            Find your next story with SoraiX.
          </p>
        </div>
        <div>
          <h4>DISCOVER</h4>
          <Link to="/movies">Movies</Link>
          <Link to="/tv">TV Series</Link>
          <Link to="/top-airing">Top Airing</Link>
          <Link to="/genres">Genres</Link>
        </div>
        <div>
          <h4>YOUR SPACE</h4>
          <Link to="/watchlist">My Watchlist</Link>
          <Link to="/history">Watch History</Link>
          <Link to="/schedule">Release Schedule</Link>
          <Link to="/filter">Advanced Search</Link>
        </div>
        <div>
          <h4>THE FINE PRINT</h4>
          <Link to="/about">About SoraiX</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/copyright">Copyright</Link>
          <Link to="/terms">Terms of Use</Link>
        </div>
        <div className="footer-note">
          <span className="footer-symbol">✧</span>
          <h3>Made for the love of anime.</h3>
          <p>No accounts. Just great stories.</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} SoraiX. All rights reserved.</span>
        <span>
          Metadata & artwork belong to their respective rights holders. Video
          availability depends on the connected source.
        </span>
        <span>
          Enjoy the journey <span className="purple">✦</span>
        </span>
      </div>
    </footer>
  );
}
export function Skeleton() {
  return (
    <div className="page skeleton-page">
      <div className="skeleton skeleton-title" />
      <div className="anime-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="skeleton skeleton-poster" key={i} />
        ))}
      </div>
    </div>
  );
}
