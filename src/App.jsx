import React, { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, useLocation, Link } from "react-router-dom";
import { Header, Footer, Skeleton } from "./components";
import { getAnimeDetails } from "./services/catalog";
import { useAnime } from "./services/live";
const Watchable = lazy(() => import("./pages/Watchable"));
const Home = lazy(() => import("./pages/Home"));
const Browse = lazy(() => import("./pages/Browse"));
const Detail = lazy(() => import("./pages/Detail"));
const Watch = lazy(() => import("./pages/Watch"));
const Library = lazy(() => import("./pages/Library"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Info = lazy(() => import("./pages/Info"));
export default function App() {
  const location = useLocation();
  const slug = /^\/(anime|watch)\//.test(location.pathname)
    ? location.pathname.split("/")[2]
    : null;
  const liveAnime = useAnime(slug);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    const slug = location.pathname.split("/")[2];
    const a = liveAnime.data?.anime || getAnimeDetails(slug);
    const label = a
      ? a.title.english
      : location.pathname === "/"
        ? "A world beyond ordinary"
        : location.pathname
            .slice(1)
            .replaceAll("-", " ")
            .replace(/\b\w/g, (s) => s.toUpperCase());
    document.title = label + " | SoraiX";
    const description = a
      ? a.description.slice(0, 155)
      : "Discover extraordinary anime, save your watchlist, and find your next favorite story. All on SoraiX.";
    const meta = (property, content) => {
      let el = document.head.querySelector(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.append(el);
      }
      el.content = content;
    };
    document.querySelector('meta[name="description"]').content = description;
    meta("og:title", document.title);
    meta("og:description", description);
    meta(
      "og:image",
      a?.banner || a?.poster || window.location.origin + "/favicon.svg",
    );
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = window.location.origin + location.pathname;
    document.querySelector("#anime-schema")?.remove();
    if (a) {
      const script = document.createElement("script");
      script.id = "anime-schema";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": a.type === "Movie" ? "Movie" : "TVSeries",
        name: a.title.english,
        image: a.poster,
        description: a.description,
        genre: a.genres,
        datePublished: a.releaseDate,
      });
      document.head.append(script);
    }
  }, [location.pathname, location.search, liveAnime.data]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      {!online && (
        <div className="offline-notice" role="status">
          You’re offline. Your local watchlist is still here; live data and
          streaming need a connection.
        </div>
      )}
      <main id="main">
        <Suspense key={location.pathname} fallback={<Skeleton />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="watchable" element={<Watchable />} />
            {[
              "search",
              "movies",
              "tv",
              "most-popular",
              "top-airing",
              "recently-updated",
              "recently-added",
              "completed",
              "filter",
              "genres",
              "genre/:genre",
              "ova",
              "ona",
              "specials",
              "most-favorite",
              "new-releases",
            ].map((path) => (
              <Route key={path} path={path} element={<Browse />} />
            ))}
            <Route path="anime/:slug" element={<Detail />} />
            <Route path="watch/:slug" element={<Watch />} />
            <Route path="watchlist" element={<Library />} />
            <Route path="history" element={<Library />} />
            <Route path="schedule" element={<Schedule />} />
            {["about", "contact", "privacy", "copyright", "terms"].map(
              (path) => (
                <Route key={path} path={path} element={<Info />} />
              ),
            )}
            <Route path="*" element={<Info notFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
