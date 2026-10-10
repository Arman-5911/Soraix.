export function artworkUrl(url, width = 320) {
  try {
    const u = new URL(url);
    if (u.origin !== "https://s4.anilist.co" || u.search || u.hash ||
        !/^\/file\/anilistcdn\/media\/anime\/(?:cover\/(?:small|medium|large)|banner)\/[A-Za-z0-9_.-]+\.(?:png|jpe?g|webp)$/i.test(u.pathname)) return url;
    return `/api/artwork?width=${width}&url=${encodeURIComponent(url)}`;
  } catch { return url; }
}
export function artworkSrcSet(url) {
  return artworkUrl(url) !== url ? [160, 320, 460, 640].map(w => `${artworkUrl(url, w)} ${w}w`).join(", ") : undefined;
}
