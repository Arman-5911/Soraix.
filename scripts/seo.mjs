import { genreNames, genrePath } from "../src/landingContent.js";
import fs from "node:fs/promises";
try {
  process.loadEnvFile();
} catch {}
const base = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://soraix.vercel.app")
).replace(/\/$/, "");
const paths = [
  "/",
  "/movies",
  "/tv",
  "/top-airing",
  "/most-popular",
  "/recently-updated",
  "/recently-added",
  "/completed",
  "/genres",
  "/schedule",
  "/about",
  ...genreNames.map(genrePath),
];
await fs.writeFile(
  "public/sitemap.xml",
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((p) => `  <url><loc>${base}${encodeURI(p)}</loc></url>`).join("\n") +
    "\n</urlset>\n",
);
await fs.writeFile(
  "public/robots.txt",
  `User-agent: *\nAllow: /\nDisallow: /watch/\nDisallow: /history\nDisallow: /watchlist\nSitemap: ${base}/sitemap.xml\n`,
);
console.log("Generated sitemap for", base);
