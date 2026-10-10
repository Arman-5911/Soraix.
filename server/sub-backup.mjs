import { ApiError } from "./anilist.mjs";

// Public partner API and player protocol: https://ani.pm/developers
const ORIGIN = "https://ani.pm";
const cache = new Map(),
  pending = new Map();
export function normalizeSubBackup(data, id, language = "sub") {
  if (!["sub", "dub"].includes(language))
    throw new ApiError("Invalid backup audio.", 400);
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
      row.available?.[language] !== true
    )
      continue;
    let url;
    try {
      url = new URL(row.embed?.[language]);
    } catch {
      continue;
    }
    if (
      url.origin !== ORIGIN ||
      url.username ||
      url.password ||
      url.pathname !==
        `/embed/ani/${Number(data.anilistId)}/${number}/${language}`
    )
      continue;
    url.search = "";
    url.hash = "";
    url.searchParams.set("autonext", "0");
    url.searchParams.set("episodes", "0");
    url.searchParams.set("subtitles", "en");
    const servers = [
      {
        name: language === "dub" ? "Ani.pm · English DUB" : "Ani.pm · SUB",
        url: url.href,
        protocol: "anipm",
      },
    ];
    if (row.available[language === "dub" ? "dubHard" : "subHard"] === true) {
      url.searchParams.set("hardsub", "1");
      servers.push({
        name:
          language === "dub"
            ? "Ani.pm · English DUB (burned-in captions)"
            : "Ani.pm · Burned-in SUB",
        url: url.href,
        protocol: "anipm",
      });
    }
    seen.add(number);
    episodes.push({
      number,
      title: row.title || `Episode ${number}`,
      provider: "audio",
      availableLanguages: [language],
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
    const sub = normalizeSubBackup(data.data, key);
    const dub = normalizeSubBackup(data.data, key, "dub");
    const episodes = new Map(sub.episodes.map((e) => [e.number, e]));
    for (const e of dub.episodes) {
      const existing = episodes.get(e.number);
      episodes.set(e.number, {
        ...(existing || e),
        availableLanguages: existing ? ["sub", "dub"] : ["dub"],
        backupServers: existing?.backupServers || [],
        dubBackupServers: e.backupServers,
      });
    }
    const value = {
      ...sub,
      episodes: [...episodes.values()].sort((a, b) => a.number - b.number),
    };
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    cache.set(key, { value, until: Date.now() + 300000 });
    return value;
  })().finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
export async function subBackupServers(id, number, language = "sub") {
  const library = await subBackupLibrary(id);
  return (
    library.episodes.find((e) => e.number === number)?.[
      language === "dub" ? "dubBackupServers" : "backupServers"
    ] || []
  );
}
