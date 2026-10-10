import React from "react";
import { Compass, ArrowUpRight, BookOpen, Play, CalendarDays, Sparkles } from "lucide-react";
import { pageDescription } from "./pageMetadata.js";
const h = React.createElement;
export const landingPaths = ["/", "/movies", "/tv", "/top-airing", "/most-popular", "/completed", "/genres", "/schedule"];
export const genreNames = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mahou Shoujo", "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];
export const genrePath = genre => "/genre/" + genre.toLowerCase();
export function landingTitle(path) {
  if (path === "/") return "Discover anime and comics on SoraiX";
  const name = decodeURIComponent(path.replace(/^\/genre\//, "").replace(/^\//, "")).replaceAll("-", " ");
  return `${name[0]?.toUpperCase() || ""}${name.slice(1)} anime on SoraiX`;
}
export function hasLanding(path) {
  try { return landingPaths.includes(path) || genreNames.some(g => genrePath(g) === decodeURI(path)); }
  catch { return false; }
}
export function LandingContent({ pathname, mode = "anime" }) {
  if (!hasLanding(pathname)) return null;
  const reading = ["manga", "manhwa", "manhua"].includes(mode);
  const label = mode[0].toUpperCase() + mode.slice(1);
  const links = reading
    ? [["/search", `Explore ${label}`, Compass], ["/watchlist", "My library", BookOpen], ["/history", "Continue reading", Sparkles]]
    : mode === "donghua"
      ? [["/search", "Explore Donghua", Compass], ["/watchlist", "My watchlist", Play], ["/history", "Continue watching", Sparkles]]
      : [["/movies", "Anime movies", Play], ["/tv", "Anime series", Sparkles], ["/genres", "All genres", Compass], ["/schedule", "Release schedule", CalendarDays]];
  const title = mode === "anime" ? landingTitle(pathname) : `Your next ${mode} story starts here`;
  const description = reading
    ? `Discover ${mode}, save your favorites and pick up from your last chapter. Your library and reading progress stay with you in this browser.`
    : mode === "donghua"
      ? "Discover Chinese animation, save your next series and return to the episodes you love."
      : pageDescription(decodeURI(pathname));
  return h("section", { className: "landing-overview", "aria-labelledby": "landing-heading" },
    h("div", { className: "landing-intro" },
      h("span", { className: "landing-emblem", "aria-hidden": true }, h(reading ? BookOpen : Compass, { size: 26, strokeWidth: 1.5 })),
      h("div", null,
        h("span", { className: "landing-eyebrow" }, `THE SORAIX GUIDE / ${label}`),
        h("h2", { id: "landing-heading" }, title),
        h("p", null, description))),
    h("nav", { className: "landing-links", "aria-label": "Explore the catalogue" },
      ...links.map(([href, text, Icon]) => h("a", { key: href, href },
        h(Icon, { size: 18, "aria-hidden": true }), h("span", null, text), h(ArrowUpRight, { size: 16, className: "landing-arrow", "aria-hidden": true })))),
    pathname === "/genres" && mode === "anime"
      ? h("ul", { className: "landing-genres" }, ...genreNames.map(g => h("li", { key: g }, h("a", { href: genrePath(g) }, g)))) : null);
}
