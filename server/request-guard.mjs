import { isIP } from "node:net";

export function clientAddress(req) {
  // Only trust forwarding headers when running behind Vercel's managed edge.
  const forwarded =
    process.env.VERCEL === "1" ? req.headers?.["x-forwarded-for"] : null;
  const address =
    typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
  return isIP(address) ? address : req.socket?.remoteAddress || "unknown";
}

export function createRateLimiter({ now = Date.now, maxEntries = 10000 } = {}) {
  const entries = new Map();
  return (ip, group, limit) => {
    const time = now(),
      key = `${group}:${ip}`;
    let entry = entries.get(key);
    if (!entry || entry.until <= time) {
      if (entries.size >= maxEntries) {
        for (const [k, value] of entries)
          if (value.until <= time) entries.delete(k);
        // Do not evict active limits (which would allow a rotation bypass).
        if (entries.size >= maxEntries) return { allowed: false, retry: 60 };
      }
      entry = { count: 0, until: time + 60000 };
      entries.set(key, entry);
    }
    entry.count++;
    return {
      allowed: entry.count <= limit,
      retry: Math.max(1, Math.ceil((entry.until - time) / 1000)),
    };
  };
}
const limitRequest = createRateLimiter();
export function guardApi(req, res, url) {
  const reject = (status, error) => {
    res.statusCode = status;
    res.end(JSON.stringify({ error }));
    return false;
  };
  if ((req.url || "").length > 12000)
    return reject(414, "Request URL is too long.");
  if ([...url.searchParams].length > 30)
    return reject(400, "Too many query parameters.");
  // Same-origin browser clients need no CORS exceptions or credential sharing.
  if (req.headers?.["sec-fetch-site"] === "cross-site")
    return reject(403, "Cross-site API requests are not allowed.");
  const media = /^\/api\/(dub-media|reader-image|artwork)(?:\/|$)/.test(url.pathname);
  const expensive =
    /^\/api\/(watchable|stream|subtitles|media|chapters|pages)(?:\/|$)/.test(
      url.pathname,
    );
  const group = media ? "media" : expensive ? "discovery" : "catalogue";
  const limit = media ? 900 : expensive ? 60 : 180;
  const result = limitRequest(clientAddress(req), group, limit);
  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retry));
    return reject(429, "Too many requests. Please wait and retry.");
  }
  return true;
}

export function restrictedPath(pathname) {
  return (
    pathname
      .split(/[\\/]/)
      .some((part) => part.startsWith(".") && part !== ".well-known") ||
    /(?:^|\/)(?:node_modules|private|server|tests)(?:\/|$)/i.test(pathname) ||
    /\.(?:pem|key|p12|pfx|sql|sqlite|db|bak|map)$/i.test(pathname)
  );
}
