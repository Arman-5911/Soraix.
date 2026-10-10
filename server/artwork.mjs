import sharp from "sharp";
import { ApiError } from "./anilist.mjs";
const widths = new Set([160, 320, 460, 640, 960, 1280]);
const cache = new Map();
const pending = new Map();
let bytes = 0;
export function artworkRequest(raw, width) {
  let url;
  try { url = new URL(raw); } catch { throw new ApiError("Invalid artwork URL.", 400); }
  if (url.origin !== "https://s4.anilist.co" || url.username || url.password || url.search || url.hash ||
      !/^\/file\/anilistcdn\/media\/anime\/(?:cover\/(?:small|medium|large)|banner)\/[A-Za-z0-9_.-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname) || !widths.has(width))
    throw new ApiError("Unsupported artwork request.", 400);
  return url;
}
export async function optimizedArtwork(raw, width) {
  const url = artworkRequest(raw, width), key = `${width}:${url.href}`;
  const old = cache.get(key);
  if (old && old.until > Date.now()) return old.body;
  if (old) { bytes -= old.body.length; cache.delete(key); }
  if (pending.has(key)) return pending.get(key);
  if (pending.size >= 4) throw new ApiError("Artwork service is busy. Use the original image.", 503);
  const job = (async () => {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!response.ok || !/^image\/(?:png|jpeg|webp)/i.test(response.headers.get("content-type") || "")) throw new ApiError("Artwork unavailable.", 502);
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) throw new ApiError("Artwork is too large.", 413);
      chunks.push(chunk);
    }
    const body = await sharp(Buffer.concat(chunks), { limitInputPixels: 24000000, animated: false })
      .rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    while (cache.size && (bytes + body.length > 24 * 1024 * 1024 || cache.size >= 150)) {
      const first = cache.keys().next().value;
      bytes -= cache.get(first).body.length; cache.delete(first);
    }
    cache.set(key, { body, until: Date.now() + 3600000 }); bytes += body.length;
    return body;
  })().finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}
