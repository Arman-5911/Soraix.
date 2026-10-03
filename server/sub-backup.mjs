import { ApiError } from "./anilist.mjs";

// Public partner API and player protocol: https://ani.pm/developers
const ORIGIN = "https://ani.pm";
const cache = new Map(),
  pending = new Map();
export function normalizeSubBackup(data, id) {
  const value = String(id);
  const isAni = /^al\d+$/.test(value);
  if (
    !(isAni
      ? Number(data?.anilistId) === Number(value.slice(2))
      : Number(data?.malId) === Number(value))
  )
    throw new ApiError("Backup provider returned a different title.", 502);
  const seen = new Set();
  const episodes = [];
  for (const row of Array.isArray(data.episodeList) ? data.episodeList : []) {
    const number = Number(row.number);
    if (
      !Number.isFinite(number) ||
      number <= 0 ||
      seen.has(number) ||
      row.available?.sub !== true
    )
      continue;
    let url;
    try {
      url = new URL(row.embed?.sub);
    } catch {
      continue;
    }
    if (
      url.origin !== ORIGIN ||
      url.username ||
      url.password ||
      url.pathname !== `/embed/ani/${Number(data.anilistId)}/${number}/sub`
    )
      continue;
    url.search = "";
    url.hash = "";
    url.searchParams.set("autonext", "0");
    url.searchParams.set("episodes", "0");
    url.searchParams.set("subtitles", "en");
    const servers = [
      { name: "Ani.pm · SUB", url: url.href, protocol: "anipm" },
    ];
    if (row.available.subHard === true) {
      url.searchParams.set("hardsub", "1");
      servers.push({
        name: "Ani.pm · Burned-in SUB",
        url: url.href,
        protocol: "anipm",
      });
    }
    seen.add(number);
    episodes.push({
      number,
      title: row.title || `Episode ${number}`,
      provider: "audio",
      availableLanguages: ["sub"],
      backupServers: servers,
    });
  }
  return {
    episodes: episodes.sort((a, b) => a.number - b.number),
    provider: "Ani.pm",
  };
}
export async function subBackupLibrary(id) {
  if (
    process.env.SUB_BACKUP_PROVIDER === "none" ||
    process.env.STREAMING_PROVIDER === "none"
  )
    return { episodes: [] };
  const key = String(id);
  if (!/^(?:al)?[1-9]\d*$/.test(key))
    throw new ApiError("Invalid anime identifier.", 400);
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.value;
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    const providerId = key.startsWith("al") ? key.slice(2) : `mal-${key}`;
    const response = await fetch(
      `${ORIGIN}/api/partner/v1/series/${providerId}`,
      { signal: AbortSignal.timeout(10000), redirect: "error" },
    );
    if (response.status === 404) return { episodes: [] };
    if (!response.ok)
      throw new ApiError("SUB backup is temporarily unavailable.", 502);
    const data = await response.json();
    const value = normalizeSubBackup(data.data, key);
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    cache.set(key, { value, until: Date.now() + 300000 });
    return value;
  })().finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
export async function subBackupServers(id, number) {
  const library = await subBackupLibrary(id);
  return library.episodes.find((e) => e.number === number)?.backupServers || [];
}
