import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiHandler } from "./api.mjs";
try {
  process.loadEnvFile();
} catch {}
const root = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (await apiHandler(req, res)) return;
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    let file = path.resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      if (!(await fs.stat(file)).isFile()) file = path.join(root, "index.html");
    } catch {
      if (path.extname(pathname)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      file = path.join(root, "index.html");
    }
    const body = await fs.readFile(file);
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Cache-Control",
      file.includes(path.sep + "assets" + path.sep)
        ? "public,max-age=31536000,immutable"
        : "no-cache",
    );
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(500);
    res.end(
      "Build the application with npm run build before starting the production server.",
    );
  }
});
server.listen(Number(process.env.PORT) || 5173, "0.0.0.0", () =>
  console.log(
    `SoraiX live server: http://localhost:${process.env.PORT || 5173}`,
  ),
);
