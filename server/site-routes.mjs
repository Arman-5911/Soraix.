import fs from "node:fs";
import { genreNames, genrePath } from "../src/landingContent.js";
const config = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const routes = config.rewrites.filter(r => (r.destination.endsWith("/index.html") || r.destination === "/spa.html")).map(r =>
  new RegExp("^" + r.source.split("/").map(part => part.startsWith(":") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("/") + "/?$"),
);
export const isSiteRoute = pathname => {
  if (pathname.startsWith("/genre/")) return genreNames.some(g => genrePath(g) === pathname.replace(/\/$/, ""));
  return pathname === "/" || routes.some(route => route.test(pathname));
};
